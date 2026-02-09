const express = require('express');
const cors = require('cors');
const serviceManager = require('../../shared/services/serviceManager');
const healthMonitor = require('../../shared/services/healthMonitor');
const logger = require('../../shared/utils/logger');
const creatorHandlers = require('./handlers/creatorHandlers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services on startup
let servicesInitialized = false;

async function initializeServices() {
  try {
    await serviceManager.initialize();
    servicesInitialized = true;
    logger.info('Creator service external integrations initialized');
  } catch (error) {
    logger.error('Failed to initialize external services', { error: error.message });
    // Continue running but mark as degraded
  }
}

// Initialize services
initializeServices();

// Health check endpoint with detailed service status
app.get('/health', async (req, res) => {
  try {
    const overallHealth = await serviceManager.getOverallHealth();
    const status = overallHealth.status === 'critical' ? 503 : 200;

    res.status(status).json({
      status: overallHealth.status,
      timestamp: new Date().toISOString(),
      service: 'creator-service',
      servicesInitialized,
      externalServices: overallHealth.serviceDetails,
      monitoring: healthMonitor.getMonitoringStatus()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'creator-service',
      error: error.message,
      servicesInitialized
    });
  }
});

// Service health metrics endpoint
app.get('/health/metrics', async (req, res) => {
  try {
    const metrics = {};
    const services = healthMonitor.getRegisteredServices();

    for (const service of services) {
      const serviceMetrics = healthMonitor.getServiceMetrics(service);
      if (serviceMetrics) {
        metrics[service] = serviceMetrics;
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      metrics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Creator routes with external service integration
app.get('/creators', creatorHandlers.getCreators);
app.get('/creators/:id', creatorHandlers.getCreatorById);
app.post('/creators/ingest', creatorHandlers.ingestCreators);
app.post('/creators/embeddings', creatorHandlers.generateEmbeddings);
app.post('/creators/search', creatorHandlers.searchCreators);
app.post('/creators/embeddings/refresh', creatorHandlers.refreshEmbeddings);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Creator service error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    await serviceManager.gracefulShutdown();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

app.listen(PORT, () => {
  logger.info(`Creator Service running on port ${PORT}`);
});
const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const serviceManager = require('../../../shared/services/serviceManager');
const creatorHandlers = require('../handlers/creatorHandlers');
const logger = require('../../../shared/utils/logger');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Global error handler for serverless
app.use((err, req, res, next) => {
  logger.error('Serverless handler error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const overallHealth = await serviceManager.getOverallHealth();
    const status = overallHealth.status === 'critical' ? 503 : 200;
    
    res.status(status).json({
      status: overallHealth.status,
      timestamp: new Date().toISOString(),
      service: 'creator-service-serverless',
      environment: process.env.NODE_ENV,
      serverless: true,
      externalServices: overallHealth.serviceDetails
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'creator-service-serverless',
      error: error.message
    });
  }
});

// Creator routes
app.get('/creators', creatorHandlers.getCreators);
app.get('/creators/:id', creatorHandlers.getCreatorById);
app.post('/creators/ingest', creatorHandlers.ingestCreators);
app.post('/creators/embeddings', creatorHandlers.generateEmbeddings);
app.post('/creators/search', creatorHandlers.searchCreators);
app.post('/creators/embeddings/refresh', creatorHandlers.refreshEmbeddings);

// Initialize services for serverless
let servicesInitialized = false;
let initializationPromise = null;

async function ensureServicesInitialized() {
  if (servicesInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      await serviceManager.initialize();
      servicesInitialized = true;
      logger.info('Serverless creator service initialized');
    } catch (error) {
      logger.error('Failed to initialize serverless services', { error: error.message });
      throw error;
    }
  })();

  return initializationPromise;
}

// Middleware to ensure services are initialized
app.use(async (req, res, next) => {
  try {
    await ensureServicesInitialized();
    next();
  } catch (error) {
    res.status(503).json({
      error: 'Service initialization failed',
      message: 'External services could not be initialized'
    });
  }
});

// Warmup handler for serverless-warmup plugin
const warmupHandler = async (event, context) => {
  if (event.source === 'serverless-plugin-warmup') {
    logger.info('WarmUp - Lambda is warm!');
    return 'Lambda is warm!';
  }
  
  // Not a warmup call, continue with normal execution
  return null;
};

// Main serverless handler
const handler = serverless(app, {
  binary: false,
  request: (request, event, context) => {
    // Add serverless context to request
    request.serverless = {
      event,
      context,
      isWarmup: event.source === 'serverless-plugin-warmup'
    };
  }
});

// Wrap handler with warmup check
const wrappedHandler = async (event, context) => {
  // Handle warmup calls
  const warmupResult = await warmupHandler(event, context);
  if (warmupResult) {
    return warmupResult;
  }

  // Handle regular requests
  return handler(event, context);
};

// Individual function handlers for better scaling
const createIndividualHandler = (handlerFunction) => {
  return async (event, context) => {
    // Handle warmup calls
    const warmupResult = await warmupHandler(event, context);
    if (warmupResult) {
      return warmupResult;
    }

    try {
      await ensureServicesInitialized();
      
      // Create mock request/response objects
      const req = {
        body: JSON.parse(event.body || '{}'),
        params: event.pathParameters || {},
        query: event.queryStringParameters || {},
        headers: event.headers || {}
      };

      const res = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: '',
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.body = JSON.stringify(data);
          return this;
        }
      };

      await handlerFunction(req, res);
      
      return {
        statusCode: res.statusCode,
        headers: res.headers,
        body: res.body
      };
    } catch (error) {
      logger.error('Individual handler error', { error: error.message });
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Internal server error' })
      };
    }
  };
};

module.exports = {
  handler: wrappedHandler,
  getCreators: createIndividualHandler(creatorHandlers.getCreators),
  getCreatorById: createIndividualHandler(creatorHandlers.getCreatorById),
  ingestCreators: createIndividualHandler(creatorHandlers.ingestCreators),
  generateEmbeddings: createIndividualHandler(creatorHandlers.generateEmbeddings),
  searchCreators: createIndividualHandler(creatorHandlers.searchCreators),
  refreshEmbeddings: createIndividualHandler(creatorHandlers.refreshEmbeddings)
};
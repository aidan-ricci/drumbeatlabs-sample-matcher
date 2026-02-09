const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Add shared modules to path
const sharedPath = path.join(__dirname, '../../shared');
require('module').globalPaths.push(sharedPath);

// Import serverless-ready modules
const { initializeConnection, getConnectionManager } = require('./utils/connectionManager');
const assignmentHandlers = require('./handlers/assignmentHandlers');
const { 
  errorHandler, 
  notFoundHandler, 
  asyncHandler 
} = require('./middleware/errorHandler');
const {
  validateAssignmentCreation,
  validatePagination,
  validateObjectId,
  validateSearchQuery,
  validateMatchResults,
  validateStatus,
  sanitizeRequest,
  validateRateLimit
} = require('./middleware/validation');
const logger = require('../../shared/utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Global middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request sanitization and security
app.use(sanitizeRequest);

// Rate limiting (configurable for different endpoints)
app.use('/assignments', validateRateLimit({ windowMs: 60000, max: 100 }));

// Health check endpoint (no authentication required)
app.get('/health', asyncHandler(async (req, res) => {
  try {
    const connectionManager = getConnectionManager();
    const healthCheck = await connectionManager.healthCheck();
    
    const status = healthCheck.status === 'healthy' ? 'healthy' : 'unhealthy';
    
    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      service: 'assignment-service',
      database: healthCheck,
      serverless: {
        ready: process.env.SERVERLESS_READY === 'true',
        coldStart: !connectionManager.getStatus().isConnected
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'assignment-service',
      error: error.message
    });
  }
}));

// Assignment CRUD endpoints using serverless-ready handlers

// Create assignment
app.post('/assignments', 
  validateAssignmentCreation, 
  asyncHandler(async (req, res) => {
    const result = await assignmentHandlers.createAssignment(req.body);
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }
    
    res.status(201).json(result);
  })
);

// Get assignment by ID
app.get('/assignments/:id', 
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const result = await assignmentHandlers.getAssignmentById(req.params.id);
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }
    
    res.json(result);
  })
);

// Get assignment history for user
app.get('/assignments/history/:userId', 
  validatePagination,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const options = {
      limit: req.query.limit,
      skip: req.query.skip,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    
    const result = await assignmentHandlers.getAssignmentHistory(userId, options);
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }
    
    res.json(result);
  })
);

// Update assignment with match results
app.patch('/assignments/:id/matches', 
  validateObjectId('id'),
  validateMatchResults,
  asyncHandler(async (req, res) => {
    const result = await assignmentHandlers.updateAssignmentMatches(
      req.params.id, 
      req.body.matchResults
    );
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }
    
    res.json(result);
  })
);

// Update assignment status
app.patch('/assignments/:id/status', 
  validateObjectId('id'),
  validateStatus,
  asyncHandler(async (req, res) => {
    const result = await assignmentHandlers.updateAssignmentStatus(
      req.params.id, 
      req.body.status
    );
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }
    
    res.json(result);
  })
);

// Search assignments
app.get('/assignments/search', 
  validateSearchQuery,
  validatePagination,
  asyncHandler(async (req, res) => {
    const options = {
      limit: req.query.limit,
      skip: req.query.skip
    };
    
    const result = await assignmentHandlers.searchAssignments(req.query.q, options);
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }
    
    res.json(result);
  })
);

// Get assignment statistics
app.get('/assignments/stats/:userId?', 
  asyncHandler(async (req, res) => {
    const result = await assignmentHandlers.getAssignmentStats(req.params.userId);
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }
    
    res.json(result);
  })
);

// List assignments (general endpoint)
app.get('/assignments', 
  validatePagination,
  asyncHandler(async (req, res) => {
    const options = {
      limit: req.query.limit,
      skip: req.query.skip
    };
    
    const result = await assignmentHandlers.listAssignments(options);
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }
    
    res.json(result);
  })
);

// Delete assignment
app.delete('/assignments/:id', 
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const result = await assignmentHandlers.deleteAssignment(req.params.id);
    
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }
    
    res.json(result);
  })
);

// Error handling middleware
app.use(errorHandler);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Initialize database and start server
async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/creator-assignment-matcher';
    
    logger.info('Initializing database connection...');
    await initializeConnection(mongoUri);
    
    app.listen(PORT, () => {
      logger.info(`Assignment Service running on port ${PORT}`, {
        serverless: process.env.SERVERLESS_READY === 'true',
        environment: process.env.NODE_ENV || 'development'
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown with connection cleanup
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    const connectionManager = getConnectionManager();
    
    // In serverless mode, we might want to keep connections alive
    if (process.env.SERVERLESS_READY !== 'true') {
      await connectionManager.disconnect();
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
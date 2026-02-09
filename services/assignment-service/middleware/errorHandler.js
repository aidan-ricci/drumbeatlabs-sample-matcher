const logger = require('../../../shared/utils/logger');

/**
 * Comprehensive error handling middleware for serverless-ready architecture
 */

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Database connection error handler
 * @param {Error} error - Database error
 * @returns {Object} Standardized error response
 */
function handleDatabaseError(error) {
  logger.error('Database error:', error);

  // MongoDB connection errors
  if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
    return {
      statusCode: 503,
      success: false,
      error: 'Database temporarily unavailable',
      code: 'DATABASE_UNAVAILABLE',
      timestamp: new Date().toISOString()
    };
  }

  // MongoDB validation errors
  if (error.name === 'ValidationError') {
    return {
      statusCode: 400,
      success: false,
      error: 'Data validation failed',
      code: 'VALIDATION_ERROR',
      details: Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      })),
      timestamp: new Date().toISOString()
    };
  }

  // MongoDB duplicate key errors
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return {
      statusCode: 409,
      success: false,
      error: `Duplicate value for field: ${field}`,
      code: 'DUPLICATE_KEY',
      field,
      timestamp: new Date().toISOString()
    };
  }

  // MongoDB cast errors (invalid ObjectId, etc.)
  if (error.name === 'CastError') {
    return {
      statusCode: 400,
      success: false,
      error: `Invalid ${error.path}: ${error.value}`,
      code: 'INVALID_FORMAT',
      field: error.path,
      timestamp: new Date().toISOString()
    };
  }

  // Generic database error
  return {
    statusCode: 500,
    success: false,
    error: 'Database operation failed',
    code: 'DATABASE_ERROR',
    timestamp: new Date().toISOString()
  };
}

/**
 * Application-specific error handler
 * @param {Error} error - Application error
 * @returns {Object} Standardized error response
 */
function handleApplicationError(error) {
  logger.error('Application error:', error);

  // Rate limiting errors
  if (error.name === 'RateLimitError') {
    return {
      statusCode: 429,
      success: false,
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: error.retryAfter || 60,
      timestamp: new Date().toISOString()
    };
  }

  // Authentication errors
  if (error.name === 'AuthenticationError') {
    return {
      statusCode: 401,
      success: false,
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      timestamp: new Date().toISOString()
    };
  }

  // Authorization errors
  if (error.name === 'AuthorizationError') {
    return {
      statusCode: 403,
      success: false,
      error: 'Insufficient permissions',
      code: 'INSUFFICIENT_PERMISSIONS',
      timestamp: new Date().toISOString()
    };
  }

  // Resource not found errors
  if (error.name === 'NotFoundError') {
    return {
      statusCode: 404,
      success: false,
      error: error.message || 'Resource not found',
      code: 'RESOURCE_NOT_FOUND',
      timestamp: new Date().toISOString()
    };
  }

  // Generic application error
  return {
    statusCode: 500,
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  };
}

/**
 * Main error handling middleware
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(error, req, res, next) {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  let errorResponse;

  // Handle different types of errors
  if (error.name && error.name.includes('Mongo') || error.name === 'ValidationError' || error.code === 11000 || error.name === 'CastError') {
    errorResponse = handleDatabaseError(error);
  } else if (error.statusCode && error.success === false) {
    // Already formatted error response from handlers
    errorResponse = error;
  } else {
    errorResponse = handleApplicationError(error);
  }

  // Add request context for debugging
  if (process.env.NODE_ENV === 'development') {
    errorResponse.debug = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      stack: error.stack
    };
  }

  // Log error with context
  logger.error('Request failed', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    statusCode: errorResponse.statusCode,
    userId: req.userId || 'anonymous'
  });

  res.status(errorResponse.statusCode).json(errorResponse);
}

/**
 * 404 handler for unmatched routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function notFoundHandler(req, res) {
  const errorResponse = {
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString()
  };

  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip
  });

  res.status(404).json(errorResponse);
}

/**
 * Serverless-compatible error handler function
 * @param {Error} error - Error object
 * @param {Object} context - Serverless context
 * @returns {Object} Standardized error response
 */
function serverlessErrorHandler(error, context = {}) {
  logger.error('Serverless function error:', error);

  let errorResponse;

  if (error.name && error.name.includes('Mongo') || error.name === 'ValidationError' || error.code === 11000 || error.name === 'CastError') {
    errorResponse = handleDatabaseError(error);
  } else if (error.statusCode && error.success === false) {
    errorResponse = error;
  } else {
    errorResponse = handleApplicationError(error);
  }

  // Add serverless context
  if (process.env.NODE_ENV === 'development') {
    errorResponse.debug = {
      context,
      stack: error.stack
    };
  }

  return errorResponse;
}

/**
 * Circuit breaker for external service calls
 * @param {Function} fn - Function to wrap with circuit breaker
 * @param {Object} options - Circuit breaker options
 * @returns {Function} Wrapped function
 */
function circuitBreaker(fn, options = {}) {
  const {
    failureThreshold = 5,
    resetTimeout = 60000,
    monitoringPeriod = 60000
  } = options;

  let failures = 0;
  let lastFailureTime = null;
  let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN

  return async (...args) => {
    // If circuit is open, check if we should try again
    if (state === 'OPEN') {
      if (Date.now() - lastFailureTime > resetTimeout) {
        state = 'HALF_OPEN';
        logger.info('Circuit breaker moving to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
    }

    try {
      const result = await fn(...args);
      
      // Success - reset failure count and close circuit
      if (state === 'HALF_OPEN') {
        state = 'CLOSED';
        failures = 0;
        logger.info('Circuit breaker reset to CLOSED state');
      }
      
      return result;
    } catch (error) {
      failures++;
      lastFailureTime = Date.now();

      // Open circuit if failure threshold reached
      if (failures >= failureThreshold) {
        state = 'OPEN';
        logger.warn(`Circuit breaker opened after ${failures} failures`);
      }

      throw error;
    }
  };
}

module.exports = {
  asyncHandler,
  errorHandler,
  notFoundHandler,
  serverlessErrorHandler,
  circuitBreaker,
  handleDatabaseError,
  handleApplicationError
};
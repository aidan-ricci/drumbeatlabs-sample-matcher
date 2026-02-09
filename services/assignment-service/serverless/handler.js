const { initializeConnection } = require('../utils/connectionManager');
const assignmentHandlers = require('../handlers/assignmentHandlers');
const { serverlessErrorHandler } = require('../middleware/errorHandler');
const { validateAssignment } = require('../../../shared/validation/schemas');
const logger = require('../../../shared/utils/logger');

/**
 * Serverless function handlers for assignment operations
 * These can be deployed to AWS Lambda, Azure Functions, Vercel, etc.
 */

/**
 * Initialize database connection for serverless environment
 * This function handles connection reuse and cold start optimization
 */
async function initializeDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/creator-assignment-matcher';
  
  try {
    await initializeConnection(mongoUri);
    logger.info('Database initialized for serverless function');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Create assignment serverless handler
 * @param {Object} event - Serverless event object
 * @param {Object} context - Serverless context object
 * @returns {Object} HTTP response
 */
async function createAssignmentHandler(event, context) {
  try {
    await initializeDatabase();
    
    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    
    // Validate input
    const { error, value } = validateAssignment(body);
    if (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Create assignment
    const result = await assignmentHandlers.createAssignment(value);
    
    return {
      statusCode: result.success ? 201 : (result.statusCode || 500),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    const errorResponse = serverlessErrorHandler(error, context);
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(errorResponse)
    };
  }
}

/**
 * Get assignment by ID serverless handler
 * @param {Object} event - Serverless event object
 * @param {Object} context - Serverless context object
 * @returns {Object} HTTP response
 */
async function getAssignmentHandler(event, context) {
  try {
    await initializeDatabase();
    
    const assignmentId = event.pathParameters?.id;
    if (!assignmentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Assignment ID is required',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    const result = await assignmentHandlers.getAssignmentById(assignmentId);
    
    return {
      statusCode: result.success ? 200 : (result.statusCode || 500),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    const errorResponse = serverlessErrorHandler(error, context);
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(errorResponse)
    };
  }
}

/**
 * Get assignment history serverless handler
 * @param {Object} event - Serverless event object
 * @param {Object} context - Serverless context object
 * @returns {Object} HTTP response
 */
async function getAssignmentHistoryHandler(event, context) {
  try {
    await initializeDatabase();
    
    const userId = event.pathParameters?.userId;
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'User ID is required',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const options = {
      limit: parseInt(queryParams.limit) || 50,
      skip: parseInt(queryParams.skip) || 0,
      sortBy: queryParams.sortBy || 'createdAt',
      sortOrder: queryParams.sortOrder || 'desc'
    };
    
    const result = await assignmentHandlers.getAssignmentHistory(userId, options);
    
    return {
      statusCode: result.success ? 200 : (result.statusCode || 500),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    const errorResponse = serverlessErrorHandler(error, context);
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(errorResponse)
    };
  }
}

/**
 * Update assignment matches serverless handler
 * @param {Object} event - Serverless event object
 * @param {Object} context - Serverless context object
 * @returns {Object} HTTP response
 */
async function updateAssignmentMatchesHandler(event, context) {
  try {
    await initializeDatabase();
    
    const assignmentId = event.pathParameters?.id;
    if (!assignmentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Assignment ID is required',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { matchResults } = body;
    
    const result = await assignmentHandlers.updateAssignmentMatches(assignmentId, matchResults);
    
    return {
      statusCode: result.success ? 200 : (result.statusCode || 500),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    const errorResponse = serverlessErrorHandler(error, context);
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(errorResponse)
    };
  }
}

/**
 * Search assignments serverless handler
 * @param {Object} event - Serverless event object
 * @param {Object} context - Serverless context object
 * @returns {Object} HTTP response
 */
async function searchAssignmentsHandler(event, context) {
  try {
    await initializeDatabase();
    
    const queryParams = event.queryStringParameters || {};
    const searchTerm = queryParams.q;
    
    if (!searchTerm) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Search term (q) is required',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    const options = {
      limit: parseInt(queryParams.limit) || 20,
      skip: parseInt(queryParams.skip) || 0
    };
    
    const result = await assignmentHandlers.searchAssignments(searchTerm, options);
    
    return {
      statusCode: result.success ? 200 : (result.statusCode || 500),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    const errorResponse = serverlessErrorHandler(error, context);
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(errorResponse)
    };
  }
}

/**
 * List assignments serverless handler
 * @param {Object} event - Serverless event object
 * @param {Object} context - Serverless context object
 * @returns {Object} HTTP response
 */
async function listAssignmentsHandler(event, context) {
  try {
    await initializeDatabase();
    
    const queryParams = event.queryStringParameters || {};
    const options = {
      limit: parseInt(queryParams.limit) || 50,
      skip: parseInt(queryParams.skip) || 0
    };
    
    const result = await assignmentHandlers.listAssignments(options);
    
    return {
      statusCode: result.success ? 200 : (result.statusCode || 500),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    const errorResponse = serverlessErrorHandler(error, context);
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(errorResponse)
    };
  }
}

/**
 * Health check serverless handler
 * @param {Object} event - Serverless event object
 * @param {Object} context - Serverless context object
 * @returns {Object} HTTP response
 */
async function healthCheckHandler(event, context) {
  try {
    const { getConnectionManager } = require('../utils/connectionManager');
    const connectionManager = getConnectionManager();
    const healthCheck = await connectionManager.healthCheck();
    
    const status = healthCheck.status === 'healthy' ? 'healthy' : 'unhealthy';
    
    return {
      statusCode: status === 'healthy' ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status,
        timestamp: new Date().toISOString(),
        service: 'assignment-service',
        database: healthCheck,
        serverless: {
          ready: true,
          coldStart: !connectionManager.getStatus().isConnected,
          context: {
            functionName: context.functionName,
            functionVersion: context.functionVersion,
            memoryLimitInMB: context.memoryLimitInMB,
            remainingTimeInMillis: context.getRemainingTimeInMillis?.()
          }
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'assignment-service',
        error: error.message,
        serverless: {
          ready: true,
          coldStart: true
        }
      })
    };
  }
}

module.exports = {
  createAssignmentHandler,
  getAssignmentHandler,
  getAssignmentHistoryHandler,
  updateAssignmentMatchesHandler,
  searchAssignmentsHandler,
  listAssignmentsHandler,
  healthCheckHandler
};
const { validateRequest, assignmentSchema } = require('../../../shared/validation/schemas');
const logger = require('../../../shared/utils/logger');

/**
 * Enhanced validation middleware for serverless-ready architecture
 */

/**
 * Assignment creation validation middleware
 */
const validateAssignmentCreation = validateRequest(assignmentSchema);

/**
 * Assignment update validation middleware
 */
const validateAssignmentUpdate = validateRequest(assignmentSchema.fork(['topic', 'keyTakeaway', 'additionalContext'], (schema) => schema.optional()));

/**
 * Pagination parameters validation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validatePagination(req, res, next) {
  const { limit, skip, sortBy, sortOrder } = req.query;

  // Validate limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter. Must be between 1 and 100',
        code: 'INVALID_PAGINATION',
        timestamp: new Date().toISOString()
      });
    }
    req.query.limit = limitNum;
  }

  // Validate skip
  if (skip !== undefined) {
    const skipNum = parseInt(skip);
    if (isNaN(skipNum) || skipNum < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid skip parameter. Must be 0 or greater',
        code: 'INVALID_PAGINATION',
        timestamp: new Date().toISOString()
      });
    }
    req.query.skip = skipNum;
  }

  // Validate sortBy
  if (sortBy !== undefined) {
    const allowedSortFields = ['createdAt', 'updatedAt', 'topic', 'status'];
    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        error: `Invalid sortBy parameter. Must be one of: ${allowedSortFields.join(', ')}`,
        code: 'INVALID_SORT_FIELD',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Validate sortOrder
  if (sortOrder !== undefined) {
    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sortOrder parameter. Must be "asc" or "desc"',
        code: 'INVALID_SORT_ORDER',
        timestamp: new Date().toISOString()
      });
    }
  }

  next();
}

/**
 * MongoDB ObjectId validation
 * @param {string} paramName - Parameter name to validate
 * @returns {Function} Express middleware function
 */
function validateObjectId(paramName) {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: `${paramName} parameter is required`,
        code: 'MISSING_PARAMETER',
        timestamp: new Date().toISOString()
      });
    }

    // MongoDB ObjectId validation (24 character hex string)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format`,
        code: 'INVALID_ID_FORMAT',
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

/**
 * Search query validation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateSearchQuery(req, res, next) {
  const { q: searchTerm } = req.query;

  if (!searchTerm || typeof searchTerm !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Search term (q) is required and must be a string',
      code: 'INVALID_SEARCH_QUERY',
      timestamp: new Date().toISOString()
    });
  }

  // Trim and validate length
  const trimmedTerm = searchTerm.trim();
  if (trimmedTerm.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Search term must be at least 2 characters long',
      code: 'SEARCH_TERM_TOO_SHORT',
      timestamp: new Date().toISOString()
    });
  }

  if (trimmedTerm.length > 200) {
    return res.status(400).json({
      success: false,
      error: 'Search term must be less than 200 characters',
      code: 'SEARCH_TERM_TOO_LONG',
      timestamp: new Date().toISOString()
    });
  }

  // Sanitize search term (remove potentially harmful characters)
  const sanitizedTerm = trimmedTerm.replace(/[<>\"'%;()&+]/g, '');
  req.query.q = sanitizedTerm;

  next();
}

/**
 * Match results validation for assignment updates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateMatchResults(req, res, next) {
  const { matchResults } = req.body;

  if (!matchResults) {
    return res.status(400).json({
      success: false,
      error: 'matchResults is required',
      code: 'MISSING_MATCH_RESULTS',
      timestamp: new Date().toISOString()
    });
  }

  if (!Array.isArray(matchResults)) {
    return res.status(400).json({
      success: false,
      error: 'matchResults must be an array',
      code: 'INVALID_MATCH_RESULTS_FORMAT',
      timestamp: new Date().toISOString()
    });
  }

  if (matchResults.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'matchResults cannot be empty',
      code: 'EMPTY_MATCH_RESULTS',
      timestamp: new Date().toISOString()
    });
  }

  if (matchResults.length > 10) {
    return res.status(400).json({
      success: false,
      error: 'matchResults cannot contain more than 10 items',
      code: 'TOO_MANY_MATCH_RESULTS',
      timestamp: new Date().toISOString()
    });
  }

  // Validate each match result structure
  for (let i = 0; i < matchResults.length; i++) {
    const match = matchResults[i];
    
    if (!match.creatorId || typeof match.creatorId !== 'string') {
      return res.status(400).json({
        success: false,
        error: `matchResults[${i}].creatorId is required and must be a string`,
        code: 'INVALID_MATCH_RESULT',
        timestamp: new Date().toISOString()
      });
    }

    if (typeof match.matchScore !== 'number' || match.matchScore < 0 || match.matchScore > 1) {
      return res.status(400).json({
        success: false,
        error: `matchResults[${i}].matchScore must be a number between 0 and 1`,
        code: 'INVALID_MATCH_SCORE',
        timestamp: new Date().toISOString()
      });
    }

    if (!match.reasoning || typeof match.reasoning !== 'string' || match.reasoning.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: `matchResults[${i}].reasoning is required and must be a non-empty string`,
        code: 'INVALID_MATCH_REASONING',
        timestamp: new Date().toISOString()
      });
    }

    if (match.framingSuggestion && typeof match.framingSuggestion !== 'string') {
      return res.status(400).json({
        success: false,
        error: `matchResults[${i}].framingSuggestion must be a string if provided`,
        code: 'INVALID_FRAMING_SUGGESTION',
        timestamp: new Date().toISOString()
      });
    }
  }

  next();
}

/**
 * Status validation for assignment status updates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateStatus(req, res, next) {
  const { status } = req.body;
  const validStatuses = ['pending', 'processing', 'completed', 'failed'];

  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'status is required',
      code: 'MISSING_STATUS',
      timestamp: new Date().toISOString()
    });
  }

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      code: 'INVALID_STATUS',
      timestamp: new Date().toISOString()
    });
  }

  next();
}

/**
 * Request sanitization middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function sanitizeRequest(req, res, next) {
  // Log request for monitoring
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length')
  });

  // Add request ID for tracing
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.set('X-Request-ID', req.requestId);

  // Set security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });

  next();
}

/**
 * Rate limiting validation (placeholder for external rate limiter)
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
function validateRateLimit(options = {}) {
  const { windowMs = 60000, max = 100 } = options;
  
  // In a real implementation, this would integrate with Redis or similar
  // For now, this is a placeholder that logs rate limit checks
  return (req, res, next) => {
    logger.debug('Rate limit check', {
      ip: req.ip,
      endpoint: req.path,
      method: req.method
    });
    
    // TODO: Implement actual rate limiting logic
    // This could integrate with Redis, DynamoDB, or other storage
    
    next();
  };
}

module.exports = {
  validateAssignmentCreation,
  validateAssignmentUpdate,
  validatePagination,
  validateObjectId,
  validateSearchQuery,
  validateMatchResults,
  validateStatus,
  sanitizeRequest,
  validateRateLimit
};
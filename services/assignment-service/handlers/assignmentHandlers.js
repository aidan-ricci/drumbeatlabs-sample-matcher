const Assignment = require('../../../shared/models/Assignment');
const logger = require('../../../shared/utils/logger');

/**
 * Serverless-ready handler functions for assignment operations
 * These functions are stateless and can be deployed as individual serverless functions
 */

/**
 * Create a new assignment
 * @param {Object} assignmentData - Validated assignment data
 * @returns {Promise<Object>} Created assignment
 */
async function createAssignment(assignmentData) {
  try {
    const assignment = new Assignment({
      ...assignmentData,
      createdAt: new Date()
    });

    const savedAssignment = await assignment.save();
    logger.info('Assignment created successfully', { assignmentId: savedAssignment._id });

    return {
      success: true,
      data: savedAssignment.toPublicJSON(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to create assignment:', error);

    if (error.name === 'ValidationError') {
      return {
        success: false,
        statusCode: 400,
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        })),
        timestamp: new Date().toISOString()
      };
    }

    throw error;
  }
}

/**
 * Get assignment by ID
 * @param {string} assignmentId - Assignment ID
 * @returns {Promise<Object>} Assignment data
 */
async function getAssignmentById(assignmentId) {
  try {
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return {
        success: false,
        statusCode: 404,
        error: 'Assignment not found',
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: true,
      data: assignment.toPublicJSON(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get assignment:', error);
    throw error;
  }
}

/**
 * Get assignment history for a user with pagination
 * @param {string} userId - User ID
 * @param {Object} options - Pagination and sorting options
 * @returns {Promise<Object>} List of assignments
 */
async function getAssignmentHistory(userId, options = {}) {
  try {
    const {
      limit = 50,
      skip = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const queryOptions = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      sortBy,
      sortOrder: sortOrder === 'desc' ? -1 : 1
    };

    const assignments = await Assignment.findByUserId(userId, queryOptions);

    // Get total count for pagination metadata
    const totalCount = await Assignment.countDocuments({ userId });

    return {
      success: true,
      data: assignments.map(a => a.toPublicJSON()),
      pagination: {
        count: assignments.length,
        total: totalCount,
        limit: queryOptions.limit,
        skip: queryOptions.skip,
        hasMore: (queryOptions.skip + assignments.length) < totalCount
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get assignment history:', error);
    throw error;
  }
}

/**
 * Update assignment with match results
 * @param {string} assignmentId - Assignment ID
 * @param {Array} matchResults - Array of match results
 * @returns {Promise<Object>} Updated assignment
 */
async function updateAssignmentMatches(assignmentId, matchResults) {
  try {
    if (!matchResults || !Array.isArray(matchResults)) {
      return {
        success: false,
        statusCode: 400,
        error: 'Match results must be provided as an array',
        timestamp: new Date().toISOString()
      };
    }

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return {
        success: false,
        statusCode: 404,
        error: 'Assignment not found',
        timestamp: new Date().toISOString()
      };
    }

    assignment.matchResults = matchResults;
    assignment.status = 'completed';

    const updatedAssignment = await assignment.save();
    logger.info('Assignment updated with match results', { assignmentId });

    return {
      success: true,
      data: updatedAssignment.toPublicJSON(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to update assignment with matches:', error);
    throw error;
  }
}

/**
 * Update assignment status
 * @param {string} assignmentId - Assignment ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated assignment
 */
async function updateAssignmentStatus(assignmentId, status) {
  try {
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];

    if (!validStatuses.includes(status)) {
      return {
        success: false,
        statusCode: 400,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        timestamp: new Date().toISOString()
      };
    }

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return {
        success: false,
        statusCode: 404,
        error: 'Assignment not found',
        timestamp: new Date().toISOString()
      };
    }

    assignment.status = status;
    const updatedAssignment = await assignment.save();

    logger.info('Assignment status updated', { assignmentId, status });

    return {
      success: true,
      data: updatedAssignment.toPublicJSON(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to update assignment status:', error);
    throw error;
  }
}

/**
 * Search assignments by text
 * @param {string} searchTerm - Search term
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
async function searchAssignments(searchTerm, options = {}) {
  try {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return {
        success: false,
        statusCode: 400,
        error: 'Search term is required',
        timestamp: new Date().toISOString()
      };
    }

    const { limit = 20, skip = 0 } = options;

    const searchOptions = {
      limit: parseInt(limit),
      skip: parseInt(skip)
    };

    const assignments = await Assignment.searchAssignments(searchTerm, searchOptions);

    return {
      success: true,
      data: assignments.map(a => a.toPublicJSON()),
      count: assignments.length,
      searchTerm,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to search assignments:', error);
    throw error;
  }
}

/**
 * Get assignment statistics
 * @param {string} userId - Optional user ID for user-specific stats
 * @returns {Promise<Object>} Assignment statistics
 */
async function getAssignmentStats(userId = null) {
  try {
    const stats = await Assignment.getAssignmentStats(userId);

    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get assignment stats:', error);
    throw error;
  }
}

/**
 * List assignments with pagination
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} List of assignments
 */
async function listAssignments(options = {}) {
  try {
    const { limit = 50, skip = 0 } = options;

    const assignments = await Assignment.find({})
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const totalCount = await Assignment.countDocuments({});

    return {
      success: true,
      data: assignments,
      pagination: {
        count: assignments.length,
        total: totalCount,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: (parseInt(skip) + assignments.length) < totalCount
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to list assignments:', error);
    throw error;
  }
}

/**
 * Delete assignment by ID
 * @param {string} assignmentId - Assignment ID
 * @returns {Promise<Object>} Deletion result
 */
async function deleteAssignment(assignmentId) {
  try {
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return {
        success: false,
        statusCode: 404,
        error: 'Assignment not found',
        timestamp: new Date().toISOString()
      };
    }

    await Assignment.findByIdAndDelete(assignmentId);
    logger.info('Assignment deleted successfully', { assignmentId });

    return {
      success: true,
      message: 'Assignment deleted successfully',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to delete assignment:', error);
    throw error;
  }
}

module.exports = {
  createAssignment,
  getAssignmentById,
  getAssignmentHistory,
  updateAssignmentMatches,
  updateAssignmentStatus,
  searchAssignments,
  getAssignmentStats,
  listAssignments,
  deleteAssignment
};

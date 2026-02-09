// Shared validation utilities

const validateAssignment = (assignment) => {
  const errors = [];

  if (!assignment.topic || assignment.topic.trim().length === 0) {
    errors.push('Topic is required');
  }

  if (!assignment.keyTakeaway || assignment.keyTakeaway.trim().length === 0) {
    errors.push('Key takeaway is required');
  }

  if (!assignment.additionalContext || assignment.additionalContext.trim().length === 0) {
    errors.push('Additional context is required');
  }

  if (assignment.topic && assignment.topic.length > 500) {
    errors.push('Topic must be less than 500 characters');
  }

  if (assignment.keyTakeaway && assignment.keyTakeaway.length > 1000) {
    errors.push('Key takeaway must be less than 1000 characters');
  }

  if (assignment.additionalContext && assignment.additionalContext.length > 2000) {
    errors.push('Additional context must be less than 2000 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

module.exports = {
  validateAssignment,
  sanitizeInput
};
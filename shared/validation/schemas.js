const Joi = require('joi');

// Assignment validation schema
const assignmentSchema = Joi.object({
  id: Joi.string().optional(),
  topic: Joi.string().required().min(1).max(500).trim(),
  keyTakeaway: Joi.string().required().min(1).max(1000).trim(),
  additionalContext: Joi.string().required().min(1).max(2000).trim(),
  targetAudience: Joi.object({
    demographic: Joi.string().required().min(1).max(200).trim(),
    locale: Joi.string().required().min(2).max(10).trim()
  }).optional(),
  creatorValues: Joi.array().items(Joi.string().min(1).max(100).trim()).optional(),
  creatorNiches: Joi.array().items(Joi.string().min(1).max(100).trim()).optional(),
  toneStyle: Joi.string().optional().min(1).max(100).trim(),
  createdAt: Joi.date().optional(),
  userId: Joi.string().optional().min(1).max(100).trim()
});

// Creator validation schema
const creatorSchema = Joi.object({
  uniqueId: Joi.string().required().min(1).max(100).trim(),
  nickname: Joi.string().required().min(1).max(200).trim(),
  bio: Joi.string().required().min(1).max(1000).trim(),
  followerCount: Joi.number().integer().min(0).required(),
  region: Joi.string().required().min(2).max(10).trim(),
  avatarUrl: Joi.string().uri().required(),
  analysis: Joi.object({
    summary: Joi.string().required().min(1).max(2000).trim(),
    primaryNiches: Joi.array().items(Joi.string().min(1).max(100).trim()).min(1).required(),
    secondaryNiches: Joi.array().items(Joi.string().min(1).max(100).trim()).optional(),
    apparentValues: Joi.array().items(Joi.string().min(1).max(100).trim()).optional(),
    audienceInterests: Joi.array().items(Joi.string().min(1).max(100).trim()).optional(),
    engagementStyle: Joi.object({
      tone: Joi.array().items(Joi.string().min(1).max(50).trim()).required(),
      contentStyle: Joi.string().required().min(1).max(500).trim()
    }).required()
  }).required(),
  embeddings: Joi.object({
    bio: Joi.array().items(Joi.number()).optional(),
    niches: Joi.array().items(Joi.number()).optional(),
    values: Joi.array().items(Joi.number()).optional()
  }).optional()
});

// CreatorMatch validation schema
const creatorMatchSchema = Joi.object({
  creator: creatorSchema.required(),
  matchScore: Joi.number().min(0).max(1).required(),
  reasoning: Joi.string().required().min(1).max(1000).trim(),
  framingSuggestion: Joi.string().required().min(1).max(2000).trim(),
  scoreBreakdown: Joi.object({
    semanticSimilarity: Joi.number().min(0).max(1).required(),
    nicheAlignment: Joi.number().min(0).max(1).required(),
    audienceMatch: Joi.number().min(0).max(1).required(),
    valueAlignment: Joi.number().min(0).max(1).required(),
    engagementFit: Joi.number().min(0).max(1).required()
  }).required()
});

// API Response validation schema
const apiResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.any().optional(),
  error: Joi.string().optional(),
  timestamp: Joi.string().isoDate().required()
});

// Health Check Response validation schema
const healthCheckResponseSchema = Joi.object({
  status: Joi.string().valid('healthy', 'unhealthy').required(),
  timestamp: Joi.string().isoDate().required(),
  service: Joi.string().required().min(1).max(100).trim()
}).unknown(true); // Allow additional properties

// Validation middleware factory
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorDetails,
        timestamp: new Date().toISOString()
      });
    }

    // Replace the original data with validated and sanitized data
    req[property] = value;
    next();
  };
};

// Validation helper functions
const validateAssignment = (data) => {
  return assignmentSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
};

const validateCreator = (data) => {
  return creatorSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
};

const validateCreatorMatch = (data) => {
  return creatorMatchSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
};

module.exports = {
  assignmentSchema,
  creatorSchema,
  creatorMatchSchema,
  apiResponseSchema,
  healthCheckResponseSchema,
  validateRequest,
  validateAssignment,
  validateCreator,
  validateCreatorMatch
};
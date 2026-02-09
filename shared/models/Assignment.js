const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
    index: true // Index for search functionality
  },
  keyTakeaway: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  additionalContext: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  targetAudience: {
    demographic: {
      type: String,
      trim: true,
      maxlength: 200
    },
    locale: {
      type: String,
      trim: true,
      maxlength: 10
    }
  },
  creatorValues: [{
    type: String,
    trim: true,
    maxlength: 100
  }],
  creatorNiches: [{
    type: String,
    trim: true,
    maxlength: 100
  }],
  toneStyle: {
    type: String,
    trim: true,
    maxlength: 100
  },
  userId: {
    type: String,
    trim: true,
    maxlength: 100,
    index: true // Index for user-specific queries
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  matchResults: [{
    creator: Object,
    creatorId: String,
    matchScore: Number,
    reasoning: String,
    framingSuggestion: String,
    scoreBreakdown: {
      semanticSimilarity: Number,
      nicheAlignment: Number,
      audienceMatch: Number,
      valueAlignment: Number,
      engagementFit: Number
    }
  }]
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'assignments'
});

// Compound indexes for efficient queries
assignmentSchema.index({ userId: 1, createdAt: -1 }); // User assignments sorted by date
assignmentSchema.index({ status: 1, createdAt: -1 }); // Status-based queries with date sorting
assignmentSchema.index({ 'targetAudience.locale': 1, createdAt: -1 }); // Locale-based queries
assignmentSchema.index({ createdAt: 1 }, {
  expireAfterSeconds: parseInt(process.env.DATA_RETENTION_SECONDS || 2592000) // Default 30 days
});

// Text index for full-text search across multiple fields
assignmentSchema.index({
  topic: 'text',
  keyTakeaway: 'text',
  additionalContext: 'text',
  creatorValues: 'text',
  creatorNiches: 'text'
}, {
  weights: {
    topic: 10,
    keyTakeaway: 8,
    creatorNiches: 6,
    creatorValues: 4,
    additionalContext: 2
  },
  name: 'assignment_text_search'
});

// Pre-save middleware for data validation and processing
assignmentSchema.pre('save', function (next) {
  // Ensure arrays are not empty if provided
  if (this.creatorValues && this.creatorValues.length === 0) {
    this.creatorValues = undefined;
  }
  if (this.creatorNiches && this.creatorNiches.length === 0) {
    this.creatorNiches = undefined;
  }

  // Remove empty target audience if both fields are empty
  if (this.targetAudience &&
    (!this.targetAudience.demographic || !this.targetAudience.locale)) {
    if (!this.targetAudience.demographic && !this.targetAudience.locale) {
      this.targetAudience = undefined;
    }
  }

  next();
});

// Instance methods
assignmentSchema.methods.toPublicJSON = function () {
  const assignment = this.toObject();

  assignment.id = assignment._id.toString();
  delete assignment._id;
  delete assignment.__v;

  return assignment;
};

assignmentSchema.methods.addMatchResult = function (matchResult) {
  if (!this.matchResults) {
    this.matchResults = [];
  }
  this.matchResults.push(matchResult);
  this.status = 'completed';
  return this.save();
};

// Static methods
assignmentSchema.statics.findByUserId = function (userId, options = {}) {
  const { limit = 50, skip = 0, sortBy = 'createdAt', sortOrder = -1 } = options;

  return this.find({ userId })
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(skip);
};

assignmentSchema.statics.searchAssignments = function (searchTerm, options = {}) {
  const { limit = 20, skip = 0 } = options;

  return this.find(
    { $text: { $search: searchTerm } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .skip(skip);
};

assignmentSchema.statics.getAssignmentStats = function (userId) {
  return this.aggregate([
    { $match: userId ? { userId } : {} },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgMatchScore: {
          $avg: {
            $avg: '$matchResults.matchScore'
          }
        }
      }
    }
  ]);
};

const Assignment = mongoose.model('Assignment', assignmentSchema);

module.exports = Assignment;
const mongoose = require('mongoose');

const creatorSchema = new mongoose.Schema({
  uniqueId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  nickname: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  bio: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  followerCount: {
    type: Number,
    required: true,
    min: 0,
    index: true // For sorting by popularity
  },
  region: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10,
    index: true // For region-based filtering
  },
  avatarUrl: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Avatar URL must be a valid HTTP/HTTPS URL'
    }
  },
  analysis: {
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    primaryNiches: [{
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    }],
    secondaryNiches: [{
      type: String,
      trim: true,
      maxlength: 100
    }],
    apparentValues: [{
      type: String,
      trim: true,
      maxlength: 100
    }],
    audienceInterests: [{
      type: String,
      trim: true,
      maxlength: 100
    }],
    engagementStyle: {
      tone: [{
        type: String,
        required: true,
        trim: true,
        maxlength: 50
      }],
      contentStyle: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
      }
    }
  },
  embeddings: {
    bio: [Number],
    niches: [Number],
    values: [Number],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  metadata: {
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now
    },
    syncSource: {
      type: String,
      default: 'manual'
    }
  }
}, {
  timestamps: true,
  collection: 'creators'
});

// Compound indexes for efficient queries
creatorSchema.index({ 'analysis.primaryNiches': 1, followerCount: -1 }); // Niche-based queries with popularity
creatorSchema.index({ region: 1, 'metadata.isActive': 1, followerCount: -1 }); // Region + active + popularity
creatorSchema.index({ 'analysis.apparentValues': 1, 'metadata.isActive': 1 }); // Values-based filtering
creatorSchema.index({ 'metadata.isActive': 1, 'embeddings.lastUpdated': -1 }); // Active creators with recent embeddings

// Text index for full-text search
creatorSchema.index({
  nickname: 'text',
  bio: 'text',
  'analysis.summary': 'text',
  'analysis.primaryNiches': 'text',
  'analysis.secondaryNiches': 'text',
  'analysis.apparentValues': 'text',
  'analysis.audienceInterests': 'text'
}, {
  weights: {
    nickname: 10,
    'analysis.primaryNiches': 8,
    'analysis.apparentValues': 6,
    bio: 4,
    'analysis.summary': 3,
    'analysis.secondaryNiches': 2,
    'analysis.audienceInterests': 1
  },
  name: 'creator_text_search'
});

// Pre-save middleware
creatorSchema.pre('save', function(next) {
  // Ensure required arrays have at least one element
  if (!this.analysis.primaryNiches || this.analysis.primaryNiches.length === 0) {
    return next(new Error('At least one primary niche is required'));
  }
  
  if (!this.analysis.engagementStyle.tone || this.analysis.engagementStyle.tone.length === 0) {
    return next(new Error('At least one engagement tone is required'));
  }
  
  // Update lastSyncedAt when creator data changes
  if (this.isModified() && !this.isModified('metadata.lastSyncedAt')) {
    this.metadata.lastSyncedAt = new Date();
  }
  
  next();
});

// Instance methods
creatorSchema.methods.toPublicJSON = function() {
  const creator = this.toObject();
  
  // Remove sensitive or internal fields
  delete creator.__v;
  delete creator.metadata;
  
  return creator;
};

creatorSchema.methods.updateEmbeddings = function(embeddings) {
  this.embeddings = {
    ...embeddings,
    lastUpdated: new Date()
  };
  return this.save();
};

creatorSchema.methods.hasRecentEmbeddings = function(maxAgeHours = 24) {
  if (!this.embeddings || !this.embeddings.lastUpdated) {
    return false;
  }
  
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
  const age = Date.now() - this.embeddings.lastUpdated.getTime();
  
  return age < maxAge;
};

creatorSchema.methods.getMatchingScore = function(assignment) {
  // Basic rule-based scoring logic
  let score = 0;
  let factors = 0;
  
  // Niche alignment
  if (assignment.creatorNiches && assignment.creatorNiches.length > 0) {
    const nicheMatches = assignment.creatorNiches.filter(niche => 
      this.analysis.primaryNiches.includes(niche) || 
      (this.analysis.secondaryNiches && this.analysis.secondaryNiches.includes(niche))
    );
    score += (nicheMatches.length / assignment.creatorNiches.length) * 0.4;
    factors += 0.4;
  }
  
  // Value alignment
  if (assignment.creatorValues && assignment.creatorValues.length > 0 && this.analysis.apparentValues) {
    const valueMatches = assignment.creatorValues.filter(value => 
      this.analysis.apparentValues.includes(value)
    );
    score += (valueMatches.length / assignment.creatorValues.length) * 0.3;
    factors += 0.3;
  }
  
  // Region match
  if (assignment.targetAudience && assignment.targetAudience.locale) {
    if (this.region === assignment.targetAudience.locale) {
      score += 0.2;
    }
    factors += 0.2;
  }
  
  // Engagement style match
  if (assignment.toneStyle && this.analysis.engagementStyle.tone.includes(assignment.toneStyle)) {
    score += 0.1;
  }
  factors += 0.1;
  
  return factors > 0 ? score / factors : 0;
};

// Static methods
creatorSchema.statics.findByNiches = function(niches, options = {}) {
  const { limit = 20, skip = 0, minFollowers = 0 } = options;
  
  return this.find({
    'metadata.isActive': true,
    followerCount: { $gte: minFollowers },
    $or: [
      { 'analysis.primaryNiches': { $in: niches } },
      { 'analysis.secondaryNiches': { $in: niches } }
    ]
  })
    .sort({ followerCount: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

creatorSchema.statics.findByValues = function(values, options = {}) {
  const { limit = 20, skip = 0 } = options;
  
  return this.find({
    'metadata.isActive': true,
    'analysis.apparentValues': { $in: values }
  })
    .sort({ followerCount: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

creatorSchema.statics.findByRegion = function(region, options = {}) {
  const { limit = 50, skip = 0 } = options;
  
  return this.find({
    'metadata.isActive': true,
    region: region
  })
    .sort({ followerCount: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

creatorSchema.statics.searchCreators = function(searchTerm, options = {}) {
  const { limit = 20, skip = 0 } = options;
  
  return this.find(
    { 
      'metadata.isActive': true,
      $text: { $search: searchTerm } 
    },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .skip(skip)
    .lean();
};

creatorSchema.statics.getCreatorStats = function() {
  return this.aggregate([
    { $match: { 'metadata.isActive': true } },
    {
      $group: {
        _id: null,
        totalCreators: { $sum: 1 },
        avgFollowers: { $avg: '$followerCount' },
        totalFollowers: { $sum: '$followerCount' },
        regions: { $addToSet: '$region' },
        primaryNiches: { $addToSet: '$analysis.primaryNiches' }
      }
    },
    {
      $project: {
        _id: 0,
        totalCreators: 1,
        avgFollowers: { $round: ['$avgFollowers', 0] },
        totalFollowers: 1,
        uniqueRegions: { $size: '$regions' },
        uniqueNiches: { $size: { $reduce: { input: '$primaryNiches', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } } }
      }
    }
  ]);
};

creatorSchema.statics.findCreatorsNeedingEmbeddings = function(maxAgeHours = 24) {
  const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
  
  return this.find({
    'metadata.isActive': true,
    $or: [
      { 'embeddings.lastUpdated': { $exists: false } },
      { 'embeddings.lastUpdated': { $lt: cutoffDate } }
    ]
  })
    .sort({ followerCount: -1 })
    .lean();
};

const Creator = mongoose.model('Creator', creatorSchema);

module.exports = Creator;
const express = require('express');
const cors = require('cors');
const serviceManager = require('../../shared/services/serviceManager');
const healthMonitor = require('../../shared/services/healthMonitor');
const logger = require('../../shared/utils/logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services on startup
let servicesInitialized = false;

async function initializeServices() {
  try {
    await serviceManager.initialize();
    servicesInitialized = true;
    logger.info('Matching service external integrations initialized');
  } catch (error) {
    logger.error('Failed to initialize external services', { error: error.message });
    // Continue running but mark as degraded
  }
}

// Initialize services
initializeServices();

// Health check endpoint with detailed service status
app.get('/health', async (req, res) => {
  try {
    const overallHealth = await serviceManager.getOverallHealth();
    const status = overallHealth.status === 'critical' ? 503 : 200;

    res.status(status).json({
      status: overallHealth.status,
      timestamp: new Date().toISOString(),
      service: 'matching-service',
      servicesInitialized,
      externalServices: overallHealth.serviceDetails,
      monitoring: healthMonitor.getMonitoringStatus()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'matching-service',
      error: error.message,
      servicesInitialized
    });
  }
});

// Service health metrics endpoint
app.get('/health/metrics', async (req, res) => {
  try {
    const metrics = {};
    const services = ['pinecone', 'openai'];

    for (const service of services) {
      const serviceMetrics = healthMonitor.getServiceMetrics(service);
      if (serviceMetrics) {
        metrics[service] = serviceMetrics;
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      metrics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Matching routes with external service integration
app.get('/matches', async (req, res) => {
  try {
    if (!servicesInitialized) {
      return res.status(503).json({
        error: 'External services not initialized',
        message: 'Matching service is starting up, please try again shortly'
      });
    }

    res.json({
      message: 'Matching service is running',
      services: await serviceManager.getServiceHealth()
    });
  } catch (error) {
    logger.error('Error in /matches endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

const fs = require('fs').promises;
const path = require('path');
const matcher = require('./utils/matcher');

let creatorCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 300000; // 5 minutes

// Load creator data for enrichment
async function loadCreators() {
  const now = Date.now();
  if (creatorCache && (now - lastCacheUpdate < CACHE_TTL)) {
    return creatorCache;
  }

  const creatorsPath = path.join(__dirname, '..', '..', 'creators.json');
  const rawData = await fs.readFile(creatorsPath, 'utf8');
  creatorCache = JSON.parse(rawData);
  lastCacheUpdate = now;

  logger.info('Creator cache updated', { count: Object.keys(creatorCache).length });
  return creatorCache;
}

// Create match endpoint
app.post('/matches', async (req, res) => {
  try {
    if (!servicesInitialized) {
      return res.status(503).json({
        error: 'External services not initialized'
      });
    }

    const { assignment, assignmentId } = req.body;

    if (!assignment) {
      return res.status(400).json({
        error: 'assignment is required'
      });
    }

    const assignmentText = `${assignment.topic} ${assignment.keyTakeaway} ${assignment.additionalContext}`;
    let candidates = [];
    let isFallback = false;

    try {
      // 1. Generate embedding for the assignment
      const assignmentEmbedding = await serviceManager.generateEmbedding(assignmentText);

      // 2. Search for similar creators
      const searchResults = await serviceManager.queryVectors(assignmentEmbedding, 15);
      candidates = searchResults.matches || [];
    } catch (error) {
      logger.warn('Vector search failed, falling back to rule-based matching', { error: error.message });
      isFallback = true;
    }

    // 3. Enrich and score
    const creators = await loadCreators();
    let scoredMatches = [];

    logger.debug('Matching candidates', { isFallback, candidatesCount: candidates.length });

    if (isFallback) {
      // Rule-based fallback: use all creators with 0 semantic similarity
      scoredMatches = Object.values(creators).map(creator => {
        return matcher.calculateMatch(assignment, creator, 0);
      });
    } else {
      scoredMatches = candidates.map(match => {
        const creator = creators[match.id];
        if (!creator) return null;
        return matcher.calculateMatch(assignment, creator, match.score);
      }).filter(m => m !== null);
    }

    logger.debug('Scored matches', { count: scoredMatches.length });

    if (scoredMatches.length === 0) {
      return res.json({
        assignment,
        matches: [],
        reasoning: "No suitable creators found for this assignment.",
        isFallback,
        timestamp: new Date().toISOString()
      });
    }

    // 4. Rank and pick top 3
    const rankedMatches = matcher.rankMatches(scoredMatches).slice(0, 3);

    // 5. Generate match reasoning using AI for the top matches
    const creatorsInfo = rankedMatches.map(m => `- ${m.creator.nickname}: ${m.creator.analysis.summary}`).join('\n');
    const reasoningPrompt = `
      Assignment: ${assignmentText}
      
      Top Creators:
      ${creatorsInfo}
      
      For each creator, provide a brief match reasoning (1-3 sentences) explaining why they are suitable for this assignment.
      Ensure the reasoning reflects the mapping between the assignment goals and the creator's specific style/audience.
      ${isFallback ? 'Note: Results are currently based on attribute matching only due to maintenance.' : ''}
    `;

    let reasoning;
    try {
      reasoning = await serviceManager.generateCompletion(reasoningPrompt, {
        maxTokens: 300,
        temperature: 0.7
      });
    } catch (aiError) {
      logger.error('AI Reasoning generation failed', { error: aiError.message });
      reasoning = "AI reasoning generation currently unavailable. Please review creators based on their profile alignment.";
    }

    // 6. Persist results if assignmentId is provided
    if (assignmentId && process.env.ASSIGNMENT_SERVICE_URL) {
      try {
        const persistUrl = `${process.env.ASSIGNMENT_SERVICE_URL}/assignments/${assignmentId}/matches`;
        logger.info('Persisting match results', { assignmentId, persistUrl });

        // Map matches to fit the Assignment schema/validator requirements
        const persistedMatches = rankedMatches.map(m => ({
          creator: m.creator,
          creatorId: m.creator.uniqueId || m.creator.id,
          matchScore: m.matchScore,
          reasoning: `Match based on ${m.scoreBreakdown.nicheAlignment} matching niche(s) and ${m.scoreBreakdown.audienceMatch ? 'valid' : 'invalid'} locale.`,
          scoreBreakdown: m.scoreBreakdown
        }));

        const response = await fetch(persistUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchResults: persistedMatches })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Assignment service returned ${response.status}: ${JSON.stringify(errorData)}`);
        }

        logger.info('Match results persisted successfully');
      } catch (persistError) {
        logger.error('Failed to persist match results', { error: persistError.message });
        // Don't fail the request if persistence fails
      }
    }

    res.json({
      success: true,
      data: {
        assignment,
        matches: rankedMatches,
        reasoning,
        isFallback
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error creating match', { error: error.message });

    if (error.message.includes('Circuit breaker')) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'External service is experiencing issues, please try again later'
      });
    }

    res.status(500).json({ error: 'Failed to create match' });
  }
});

// Generate content framing endpoint
app.post('/matches/framing', async (req, res) => {
  try {
    if (!servicesInitialized) {
      return res.status(503).json({
        error: 'External services not initialized'
      });
    }

    const { assignment, creator } = req.body;

    if (!assignment || !creator) {
      return res.status(400).json({
        error: 'assignment and creator are required'
      });
    }

    const framingPrompt = `
      Create personalized content framing for this creator and assignment:
      
      Assignment: ${assignment.topic}
      Key Message: ${assignment.keyTakeaway}
      Context: ${assignment.additionalContext}
      
      Creator: ${creator.nickname}
      Bio: ${creator.bio}
      Style: ${creator.analysis?.engagementStyle?.tone?.join(', ') || 'Not specified'}
      
      Provide 2-3 specific framing suggestions that align with the creator's style and audience.
    `;

    const framing = await serviceManager.generateCompletion(framingPrompt, {
      maxTokens: 200,
      temperature: 0.7
    });

    res.json({
      assignment,
      creator,
      framing,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating framing', { error: error.message });

    if (error.message.includes('Circuit breaker')) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'External service is experiencing issues, please try again later'
      });
    }

    res.status(500).json({ error: 'Failed to generate framing' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Matching service error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    await serviceManager.gracefulShutdown();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Matching Service running on port ${PORT}`);
  });
}

module.exports = app;
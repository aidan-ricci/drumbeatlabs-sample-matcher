const fs = require('fs').promises;
const path = require('path');
const serviceManager = require('../../../shared/services/serviceManager');
const logger = require('../../../shared/utils/logger');

class CreatorHandlers {
  constructor() {
    this.creatorData = null;
    this.lastLoadTime = null;
    this.loadCooldown = 5 * 60 * 1000; // 5 minutes
  }

  // Check if services are initialized
  checkServicesInitialized(req, res) {
    if (!serviceManager.isInitialized()) {
      res.status(503).json({ 
        error: 'External services not initialized',
        message: 'Creator service is starting up, please try again shortly'
      });
      return false;
    }
    return true;
  }

  // Load creator data from JSON file
  async loadCreatorData() {
    try {
      // Check cooldown to prevent frequent reloads
      if (this.creatorData && this.lastLoadTime && 
          (Date.now() - this.lastLoadTime) < this.loadCooldown) {
        return this.creatorData;
      }

      const creatorsPath = path.join(__dirname, '..', '..', '..', 'creators.json');
      const rawData = await fs.readFile(creatorsPath, 'utf8');
      const parsedData = JSON.parse(rawData);
      
      // Convert object to array format for easier processing
      this.creatorData = Object.values(parsedData);
      this.lastLoadTime = Date.now();
      
      logger.info('Creator data loaded successfully', { 
        count: this.creatorData.length 
      });
      
      return this.creatorData;
    } catch (error) {
      logger.error('Failed to load creator data', { error: error.message });
      throw new Error('Failed to load creator data');
    }
  }

  // Get all creators with pagination
  async getCreators(req, res) {
    try {
      if (!this.checkServicesInitialized(req, res)) return;

      const { page = 1, limit = 20, region, niche } = req.query;
      const offset = (page - 1) * limit;

      const creators = await this.loadCreatorData();
      let filteredCreators = creators;

      // Apply filters
      if (region) {
        filteredCreators = filteredCreators.filter(creator => 
          creator.region === region
        );
      }

      if (niche) {
        filteredCreators = filteredCreators.filter(creator => 
          creator.analysis.primaryNiches.includes(niche) ||
          (creator.analysis.secondaryNiches && creator.analysis.secondaryNiches.includes(niche))
        );
      }

      // Apply pagination
      const paginatedCreators = filteredCreators.slice(offset, offset + parseInt(limit));

      res.json({
        creators: paginatedCreators,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredCreators.length,
          pages: Math.ceil(filteredCreators.length / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting creators', { error: error.message });
      res.status(500).json({ error: 'Failed to retrieve creators' });
    }
  }

  // Get creator by ID
  async getCreatorById(req, res) {
    try {
      if (!this.checkServicesInitialized(req, res)) return;

      const { id } = req.params;
      const creators = await this.loadCreatorData();
      
      const creator = creators.find(c => c.uniqueId === id);
      
      if (!creator) {
        return res.status(404).json({ error: 'Creator not found' });
      }

      res.json({ creator });
    } catch (error) {
      logger.error('Error getting creator by ID', { error: error.message });
      res.status(500).json({ error: 'Failed to retrieve creator' });
    }
  }

  // Ingest creators from JSON source
  async ingestCreators(req, res) {
    try {
      if (!this.checkServicesInitialized(req, res)) return;

      const creators = await this.loadCreatorData();
      
      // Process creators for embedding generation
      const processedCreators = creators.map(creator => ({
        id: creator.uniqueId,
        bio: creator.bio,
        niches: [...creator.analysis.primaryNiches, ...(creator.analysis.secondaryNiches || [])],
        values: creator.analysis.apparentValues || [],
        summary: creator.analysis.summary,
        metadata: {
          nickname: creator.nickname,
          followerCount: creator.followerCount,
          region: creator.region,
          avatarUrl: creator.avatarUrl,
          verified: creator.verified || false
        }
      }));

      res.json({
        message: 'Creator data ingested successfully',
        count: processedCreators.length,
        creators: processedCreators
      });
    } catch (error) {
      logger.error('Error ingesting creators', { error: error.message });
      res.status(500).json({ error: 'Failed to ingest creator data' });
    }
  }

  // Generate embeddings for creators
  async generateEmbeddings(req, res) {
    try {
      if (!this.checkServicesInitialized(req, res)) return;

      const { texts, creatorIds } = req.body;
      
      if (!texts || !Array.isArray(texts)) {
        return res.status(400).json({ 
          error: 'texts array is required' 
        });
      }

      const embeddings = await serviceManager.generateEmbeddings(texts);
      
      res.json({
        embeddings,
        count: embeddings.length,
        creatorIds: creatorIds || []
      });
    } catch (error) {
      logger.error('Error generating embeddings', { error: error.message });
      
      if (error.message.includes('Circuit breaker')) {
        return res.status(503).json({ 
          error: 'Service temporarily unavailable',
          message: 'External service is experiencing issues, please try again later'
        });
      }
      
      res.status(500).json({ error: 'Failed to generate embeddings' });
    }
  }

  // Search creators using vector similarity
  async searchCreators(req, res) {
    try {
      if (!this.checkServicesInitialized(req, res)) return;

      const { query, topK = 10, filter } = req.body;
      
      if (!query) {
        return res.status(400).json({ 
          error: 'query is required' 
        });
      }

      // Generate embedding for the query
      const queryEmbedding = await serviceManager.generateEmbedding(query);
      
      // Search for similar vectors
      const results = await serviceManager.queryVectors(queryEmbedding, topK, filter);
      
      // Enrich results with creator data
      const creators = await this.loadCreatorData();
      const enrichedResults = (results.matches || []).map(match => {
        const creator = creators.find(c => c.uniqueId === match.id);
        return {
          ...match,
          creator: creator || null
        };
      }).filter(result => result.creator !== null);

      res.json({
        query,
        results: enrichedResults,
        count: enrichedResults.length
      });
    } catch (error) {
      logger.error('Error searching creators', { error: error.message });
      
      if (error.message.includes('Circuit breaker')) {
        return res.status(503).json({ 
          error: 'Service temporarily unavailable',
          message: 'External service is experiencing issues, please try again later'
        });
      }
      
      res.status(500).json({ error: 'Failed to search creators' });
    }
  }

  // Refresh creator embeddings
  async refreshEmbeddings(req, res) {
    try {
      if (!this.checkServicesInitialized(req, res)) return;

      const creators = await this.loadCreatorData();
      const { batchSize = 10, forceRefresh = false } = req.body;
      
      let processedCount = 0;
      let errorCount = 0;
      const results = [];

      // Process creators in batches
      for (let i = 0; i < creators.length; i += batchSize) {
        const batch = creators.slice(i, i + batchSize);
        
        try {
          // Prepare texts for embedding generation
          const texts = batch.map(creator => {
            // Combine bio, niches, and values for comprehensive embedding
            const nicheText = [...creator.analysis.primaryNiches, ...(creator.analysis.secondaryNiches || [])].join(', ');
            const valueText = (creator.analysis.apparentValues || []).join(', ');
            return `${creator.bio} Niches: ${nicheText} Values: ${valueText}`;
          });

          // Generate embeddings
          const embeddings = await serviceManager.generateEmbeddings(texts);
          
          // Prepare vectors for Pinecone
          const vectors = batch.map((creator, index) => ({
            id: creator.uniqueId,
            values: embeddings[index],
            metadata: {
              nickname: creator.nickname,
              bio: creator.bio,
              followerCount: creator.followerCount,
              region: creator.region,
              primaryNiches: creator.analysis.primaryNiches,
              secondaryNiches: creator.analysis.secondaryNiches || [],
              apparentValues: creator.analysis.apparentValues || [],
              verified: creator.verified || false,
              lastUpdated: new Date().toISOString()
            }
          }));

          // Store in Pinecone
          await serviceManager.upsertVectors(vectors);
          
          processedCount += batch.length;
          results.push({
            batch: Math.floor(i / batchSize) + 1,
            processed: batch.length,
            creatorIds: batch.map(c => c.uniqueId)
          });

          // Add delay between batches to respect rate limits
          if (i + batchSize < creators.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          logger.error('Error processing batch', { 
            batch: Math.floor(i / batchSize) + 1,
            error: error.message 
          });
          errorCount += batch.length;
        }
      }

      res.json({
        message: 'Embedding refresh completed',
        summary: {
          totalCreators: creators.length,
          processed: processedCount,
          errors: errorCount,
          batchSize,
          timestamp: new Date().toISOString()
        },
        results
      });
    } catch (error) {
      logger.error('Error refreshing embeddings', { error: error.message });
      res.status(500).json({ error: 'Failed to refresh embeddings' });
    }
  }
}

// Create singleton instance
const creatorHandlers = new CreatorHandlers();

// Export handler methods bound to the instance
module.exports = {
  getCreators: creatorHandlers.getCreators.bind(creatorHandlers),
  getCreatorById: creatorHandlers.getCreatorById.bind(creatorHandlers),
  ingestCreators: creatorHandlers.ingestCreators.bind(creatorHandlers),
  generateEmbeddings: creatorHandlers.generateEmbeddings.bind(creatorHandlers),
  searchCreators: creatorHandlers.searchCreators.bind(creatorHandlers),
  refreshEmbeddings: creatorHandlers.refreshEmbeddings.bind(creatorHandlers)
};
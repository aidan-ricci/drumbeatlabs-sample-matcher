const pineconeService = require('./pinecone');
const openaiService = require('./openai');
const bedrockService = require('./bedrock');
const healthMonitor = require('./healthMonitor');
const logger = require('../utils/logger');

class ServiceManager {
  constructor() {
    this.services = {
      pinecone: pineconeService,
      openai: openaiService,
      bedrock: bedrockService
    };
    this.initialized = false;
    this.initializationPromise = null;

    // Determine primary AI provider
    this.aiProvider = process.env.AI_PROVIDER || (process.env.AWS_ACCESS_KEY_ID ? 'bedrock' : 'openai');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  async _performInitialization() {
    try {
      logger.info('Initializing external services...', { primaryAI: this.aiProvider });

      const initPromises = [];

      // Initialize Pinecone if configured
      if (process.env.PINECONE_API_KEY) {
        initPromises.push(
          this.services.pinecone.initialize().catch(error => {
            logger.error('Failed to initialize Pinecone service', { error: error.message });
            return { service: 'pinecone', error };
          })
        );
      }

      // Initialize primary AI service
      const aiService = this.services[this.aiProvider];
      if (aiService) {
        initPromises.push(
          aiService.initialize().catch(error => {
            logger.error(`Failed to initialize primary AI service (${this.aiProvider})`, { error: error.message });
            return { service: this.aiProvider, error };
          })
        );
      }

      // If we switched to Bedrock, we might still want OpenAI as a backup, 
      // but for this task we follow the "switch" instruction.
      // We skip initializing the non-primary AI for efficiency unless needed.

      const results = await Promise.allSettled(initPromises);

      this.registerHealthChecks();
      healthMonitor.startMonitoring();

      this.initialized = true;
      logger.info('External services initialization completed');

    } catch (error) {
      logger.error('Failed to initialize external services', { error: error.message });
      throw error;
    }
  }

  registerHealthChecks() {
    // Pinecone health check
    healthMonitor.registerService('pinecone', async () => {
      const status = this.services.pinecone.getHealthStatus();
      if (!status.configured) return { status: 'unhealthy', reason: 'Not configured' };
      if (status.circuitBreakerState === 'OPEN') return { status: 'unhealthy', reason: 'Circuit breaker open' };

      try {
        await this.services.pinecone.getIndexStats();
        return { status: 'healthy', circuitBreakerState: status.circuitBreakerState };
      } catch (error) {
        return { status: 'unhealthy', reason: error.message };
      }
    }, { critical: true, timeout: 10000 });

    // AI Service health check
    const aiName = this.aiProvider;
    healthMonitor.registerService(aiName, async () => {
      const status = this.services[aiName].getHealthStatus();
      if (!status.configured) return { status: 'unhealthy', reason: 'Not configured' };
      if (status.circuitBreakerState === 'OPEN') return { status: 'unhealthy', reason: 'Circuit breaker open' };
      return { status: 'healthy', circuitBreakerState: status.circuitBreakerState };
    }, { critical: true, timeout: 10000 });
  }

  async getOverallHealth() {
    const overallHealth = healthMonitor.getOverallHealth();
    const serviceHealth = {};
    for (const [name, service] of Object.entries(this.services)) {
      if (service.getHealthStatus().configured) {
        serviceHealth[name] = service.getHealthStatus();
      }
    }

    return {
      ...overallHealth,
      serviceDetails: serviceHealth,
      initialized: this.initialized,
      aiProvider: this.aiProvider
    };
  }

  // AI Operations - Redirected to primary provider
  async generateEmbedding(text) {
    return this.services[this.aiProvider].generateEmbedding(text);
  }

  async generateEmbeddings(texts) {
    return this.services[this.aiProvider].generateEmbeddings(texts);
  }

  async generateCompletion(prompt, options = {}) {
    return this.services[this.aiProvider].generateCompletion(prompt, options);
  }

  async queryVectors(vector, topK = 10, filter = null) {
    return this.services.pinecone.queryVectors(vector, topK, filter);
  }

  async upsertVectors(vectors) {
    return this.services.pinecone.upsertVectors(vectors);
  }

  async gracefulShutdown() {
    healthMonitor.stopMonitoring();
    await Promise.all(
      Object.values(this.services)
        .filter(s => s.isConnected)
        .map(s => s.disconnect())
    );
    this.initialized = false;
  }

  isInitialized() {
    return this.initialized;
  }
}

module.exports = new ServiceManager();
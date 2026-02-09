const { Pinecone } = require('@pinecone-database/pinecone');
const logger = require('../utils/logger');

class PineconeService {
  constructor() {
    this.client = null;
    this.index = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.circuitBreakerState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.failureThreshold = 5;
    this.resetTimeout = 30000; // 30 seconds
    this.lastFailureTime = null;
  }

  async initialize() {
    try {
      if (!process.env.PINECONE_API_KEY) {
        throw new Error('PINECONE_API_KEY environment variable is required');
      }

      this.client = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });

      const indexName = process.env.PINECONE_INDEX_NAME || 'creator-embeddings';

      // Check if index exists, create if it doesn't
      await this.ensureIndexExists(indexName);

      this.index = this.client.index(indexName);
      this.isConnected = true;
      this.circuitBreakerState = 'CLOSED';
      this.failureCount = 0;

      logger.info('Pinecone service initialized successfully', { indexName });
      return true;
    } catch (error) {
      logger.error('Failed to initialize Pinecone service', { error: error.message });
      this.handleFailure();
      throw error;
    }
  }

  async ensureIndexExists(indexName) {
    try {
      const indexes = await this.client.listIndexes();
      const indexExists = indexes.indexes?.some(index => index.name === indexName);

      if (!indexExists) {
        logger.info('Creating Pinecone index', { indexName });
        await this.client.createIndex({
          name: indexName,
          dimension: 1536, // OpenAI embedding dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        await this.waitForIndexReady(indexName);
      }
    } catch (error) {
      logger.error('Error ensuring index exists', { error: error.message, indexName });
      throw error;
    }
  }

  async waitForIndexReady(indexName, maxWaitTime = 60000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const indexStats = await this.client.describeIndex(indexName);
        if (indexStats.status?.ready) {
          logger.info('Pinecone index is ready', { indexName });
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.warn('Waiting for index to be ready', { indexName, error: error.message });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error(`Index ${indexName} did not become ready within ${maxWaitTime}ms`);
  }

  async executeWithCircuitBreaker(operation, ...args) {
    if (this.circuitBreakerState === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.circuitBreakerState = 'HALF_OPEN';
        logger.info('Circuit breaker transitioning to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN - Pinecone service unavailable');
      }
    }

    try {
      const result = await this.executeWithRetry(operation, ...args);

      if (this.circuitBreakerState === 'HALF_OPEN') {
        this.circuitBreakerState = 'CLOSED';
        this.failureCount = 0;
        logger.info('Circuit breaker reset to CLOSED');
      }

      return result;
    } catch (error) {
      this.handleFailure();
      throw error;
    }
  }

  async executeWithRetry(operation, ...args) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation.call(this, ...args);
      } catch (error) {
        lastError = error;
        logger.warn(`Pinecone operation failed, attempt ${attempt}/${this.maxRetries}`, {
          error: error.message,
          operation: operation.name
        });

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  handleFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.circuitBreakerState = 'OPEN';
      logger.error('Circuit breaker opened due to repeated failures', {
        failureCount: this.failureCount,
        threshold: this.failureThreshold
      });
    }
  }

  async upsertVectors(vectors) {
    if (!this.isConnected) {
      await this.initialize();
    }

    return this.executeWithCircuitBreaker(async () => {
      return await this.index.upsert(vectors);
    });
  }

  async queryVectors(vector, topK = 10, filter = null) {
    if (!this.isConnected) {
      await this.initialize();
    }

    return this.executeWithCircuitBreaker(async () => {
      const queryRequest = {
        vector,
        topK,
        includeMetadata: true,
        includeValues: false
      };

      if (filter) {
        queryRequest.filter = filter;
      }

      return await this.index.query(queryRequest);
    });
  }

  async deleteVectors(ids) {
    if (!this.isConnected) {
      await this.initialize();
    }

    return this.executeWithCircuitBreaker(async () => {
      return await this.index.deleteOne(ids);
    });
  }

  async getIndexStats() {
    if (!this.isConnected) {
      await this.initialize();
    }

    return this.executeWithCircuitBreaker(async () => {
      return await this.index.describeIndexStats();
    });
  }

  getHealthStatus() {
    return {
      connected: this.isConnected,
      circuitBreakerState: this.circuitBreakerState,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      configured: !!process.env.PINECONE_API_KEY
    };
  }

  async disconnect() {
    this.isConnected = false;
    this.client = null;
    this.index = null;
    logger.info('Pinecone service disconnected');
  }
}

module.exports = new PineconeService();
const OpenAI = require('openai');
const logger = require('../utils/logger');

class OpenAIService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.circuitBreakerState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.failureThreshold = 5;
    this.resetTimeout = 30000; // 30 seconds
    this.lastFailureTime = null;
    this.rateLimitInfo = {
      requestsRemaining: null,
      tokensRemaining: null,
      resetTime: null
    };
  }

  async initialize() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }

      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Test the connection with a simple request
      await this.testConnection();
      
      this.isConnected = true;
      this.circuitBreakerState = 'CLOSED';
      this.failureCount = 0;
      
      logger.info('OpenAI service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize OpenAI service', { error: error.message });
      this.handleFailure();
      throw error;
    }
  }

  async testConnection() {
    try {
      // Make a minimal request to test the connection
      await this.client.models.list();
    } catch (error) {
      throw new Error(`OpenAI connection test failed: ${error.message}`);
    }
  }

  async executeWithCircuitBreaker(operation, ...args) {
    if (this.circuitBreakerState === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.circuitBreakerState = 'HALF_OPEN';
        logger.info('Circuit breaker transitioning to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN - OpenAI service unavailable');
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
        
        // Handle rate limiting specifically
        if (error.status === 429) {
          const retryAfter = error.headers?.['retry-after'] || Math.pow(2, attempt);
          logger.warn(`OpenAI rate limit hit, retrying after ${retryAfter}s`, {
            attempt,
            maxRetries: this.maxRetries
          });
          
          if (attempt < this.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
        }
        
        logger.warn(`OpenAI operation failed, attempt ${attempt}/${this.maxRetries}`, {
          error: error.message,
          status: error.status,
          operation: operation.name
        });
        
        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (!this.isRetryableError(error)) {
          break; // Don't retry non-retryable errors
        }
      }
    }
    
    throw lastError;
  }

  isRetryableError(error) {
    // Retry on network errors, rate limits, and server errors
    return error.status >= 500 || error.status === 429 || error.code === 'ECONNRESET';
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

  updateRateLimitInfo(headers) {
    if (headers) {
      this.rateLimitInfo = {
        requestsRemaining: headers['x-ratelimit-remaining-requests'],
        tokensRemaining: headers['x-ratelimit-remaining-tokens'],
        resetTime: headers['x-ratelimit-reset-requests']
      };
    }
  }

  async generateEmbedding(text, model = 'text-embedding-ada-002') {
    if (!this.isConnected) {
      await this.initialize();
    }
    
    return this.executeWithCircuitBreaker(async () => {
      const response = await this.client.embeddings.create({
        model,
        input: text,
      });
      
      // Update rate limit info from response headers
      this.updateRateLimitInfo(response.headers);
      
      return response.data[0].embedding;
    });
  }

  async generateEmbeddings(texts, model = 'text-embedding-ada-002') {
    if (!this.isConnected) {
      await this.initialize();
    }
    
    return this.executeWithCircuitBreaker(async () => {
      // Process in batches to avoid token limits
      const batchSize = 100;
      const embeddings = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        const response = await this.client.embeddings.create({
          model,
          input: batch,
        });
        
        // Update rate limit info from response headers
        this.updateRateLimitInfo(response.headers);
        
        embeddings.push(...response.data.map(item => item.embedding));
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return embeddings;
    });
  }

  async generateCompletion(prompt, options = {}) {
    if (!this.isConnected) {
      await this.initialize();
    }
    
    return this.executeWithCircuitBreaker(async () => {
      const response = await this.client.chat.completions.create({
        model: options.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || 150,
        temperature: options.temperature || 0.7,
        ...options
      });
      
      // Update rate limit info from response headers
      this.updateRateLimitInfo(response.headers);
      
      return response.choices[0].message.content;
    });
  }

  getRateLimitStatus() {
    return {
      requestsRemaining: this.rateLimitInfo.requestsRemaining,
      tokensRemaining: this.rateLimitInfo.tokensRemaining,
      resetTime: this.rateLimitInfo.resetTime,
      isNearLimit: this.rateLimitInfo.requestsRemaining < 10
    };
  }

  getHealthStatus() {
    return {
      connected: this.isConnected,
      circuitBreakerState: this.circuitBreakerState,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      configured: !!process.env.OPENAI_API_KEY,
      rateLimitStatus: this.getRateLimitStatus()
    };
  }

  async disconnect() {
    this.isConnected = false;
    this.client = null;
    logger.info('OpenAI service disconnected');
  }
}

module.exports = new OpenAIService();
const mongoConnection = require('../../../shared/database/mongodb');
const logger = require('../../../shared/utils/logger');

/**
 * Connection manager optimized for serverless environments
 * Handles connection pooling, reuse, and graceful degradation
 */

class ConnectionManager {
  constructor() {
    this.isConnected = false;
    this.connectionPromise = null;
    this.lastConnectionTime = null;
    this.connectionTimeout = 5000; // 5 seconds
    this.maxConnectionAge = 300000; // 5 minutes - reuse connections within this window
  }

  /**
   * Get or create database connection (optimized for serverless cold starts)
   * @param {string} uri - MongoDB connection URI
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Database connection
   */
  async getConnection(uri, options = {}) {
    try {
      // Check if existing connection is still valid and not too old
      if (this.isConnected && mongoConnection.isHealthy()) {
        const connectionAge = Date.now() - this.lastConnectionTime;
        
        if (connectionAge < this.maxConnectionAge) {
          logger.debug('Reusing existing database connection', { connectionAge });
          return mongoConnection.getConnection();
        } else {
          logger.info('Connection too old, creating new connection', { connectionAge });
          await this.disconnect();
        }
      }

      // If connection is in progress, wait for it
      if (this.connectionPromise) {
        logger.debug('Waiting for pending connection');
        return await this.connectionPromise;
      }

      // Create new connection
      logger.info('Creating new database connection');
      this.connectionPromise = this.createConnection(uri, options);
      
      const connection = await this.connectionPromise;
      this.isConnected = true;
      this.lastConnectionTime = Date.now();
      this.connectionPromise = null;
      
      return connection;
    } catch (error) {
      this.connectionPromise = null;
      this.isConnected = false;
      logger.error('Failed to get database connection:', error);
      throw error;
    }
  }

  /**
   * Create new database connection with timeout
   * @param {string} uri - MongoDB connection URI
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Database connection
   */
  async createConnection(uri, options = {}) {
    const connectionOptions = {
      maxPoolSize: process.env.SERVERLESS_READY === 'true' ? 5 : 10,
      minPoolSize: process.env.SERVERLESS_READY === 'true' ? 1 : 2,
      serverSelectionTimeoutMS: this.connectionTimeout,
      socketTimeoutMS: 45000,
      connectTimeoutMS: this.connectionTimeout,
      ...options
    };

    // Create connection with timeout
    const connectionPromise = mongoConnection.connect(uri, connectionOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout);
    });

    try {
      const connection = await Promise.race([connectionPromise, timeoutPromise]);
      logger.info('Database connection established successfully');
      return connection;
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.isConnected) {
        await mongoConnection.disconnect();
        this.isConnected = false;
        this.lastConnectionTime = null;
        logger.info('Database disconnected successfully');
      }
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  /**
   * Check connection health
   * @returns {Promise<Object>} Health check result
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          message: 'Not connected to database',
          connected: false
        };
      }

      const health = await mongoConnection.healthCheck();
      return {
        ...health,
        connected: this.isConnected,
        connectionAge: Date.now() - this.lastConnectionTime
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        message: error.message,
        connected: false
      };
    }
  }

  /**
   * Ensure connection is ready (with retry logic)
   * @param {string} uri - MongoDB connection URI
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<Object>} Database connection
   */
  async ensureConnection(uri, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Connection attempt ${attempt}/${maxRetries}`);
        const connection = await this.getConnection(uri);
        return connection;
      } catch (error) {
        lastError = error;
        logger.warn(`Connection attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(`Failed to connect after ${maxRetries} attempts`);
    throw lastError;
  }

  /**
   * Get connection status
   * @returns {Object} Connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      lastConnectionTime: this.lastConnectionTime,
      connectionAge: this.lastConnectionTime ? Date.now() - this.lastConnectionTime : null,
      isHealthy: this.isConnected && mongoConnection.isHealthy()
    };
  }
}

// Singleton instance for connection reuse across invocations
let connectionManager = null;

/**
 * Get singleton connection manager instance
 * @returns {ConnectionManager} Connection manager instance
 */
function getConnectionManager() {
  if (!connectionManager) {
    connectionManager = new ConnectionManager();
  }
  return connectionManager;
}

/**
 * Initialize database connection for serverless function
 * @param {string} uri - MongoDB connection URI
 * @returns {Promise<Object>} Database connection
 */
async function initializeConnection(uri) {
  const manager = getConnectionManager();
  return await manager.ensureConnection(uri);
}

/**
 * Cleanup function for serverless function termination
 * Note: In serverless environments, connections are often kept alive
 * between invocations for performance, so this is optional
 * @returns {Promise<void>}
 */
async function cleanup() {
  if (connectionManager) {
    // In serverless, we typically don't disconnect to allow connection reuse
    // Only disconnect if explicitly needed or on timeout
    logger.debug('Cleanup called - keeping connection alive for reuse');
  }
}

/**
 * Force disconnect (for testing or explicit cleanup)
 * @returns {Promise<void>}
 */
async function forceDisconnect() {
  if (connectionManager) {
    await connectionManager.disconnect();
    connectionManager = null;
  }
}

module.exports = {
  ConnectionManager,
  getConnectionManager,
  initializeConnection,
  cleanup,
  forceDisconnect
};
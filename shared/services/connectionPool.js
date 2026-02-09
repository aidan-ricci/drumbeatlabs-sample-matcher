const logger = require('../utils/logger');

class ConnectionPool {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 10;
    this.minConnections = options.minConnections || 2;
    this.acquireTimeout = options.acquireTimeout || 30000; // 30 seconds
    this.idleTimeout = options.idleTimeout || 300000; // 5 minutes
    this.connectionFactory = options.connectionFactory;
    this.validateConnection = options.validateConnection || (() => true);
    this.destroyConnection = options.destroyConnection || (() => {});
    
    this.pool = [];
    this.activeConnections = new Set();
    this.waitingQueue = [];
    this.isDestroyed = false;
    
    // Initialize minimum connections
    this.initializePool();
    
    // Cleanup idle connections periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Check every minute
  }

  async initializePool() {
    try {
      for (let i = 0; i < this.minConnections; i++) {
        const connection = await this.createConnection();
        this.pool.push({
          connection,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          inUse: false
        });
      }
      logger.info('Connection pool initialized', {
        minConnections: this.minConnections,
        maxConnections: this.maxConnections
      });
    } catch (error) {
      logger.error('Failed to initialize connection pool', { error: error.message });
    }
  }

  async createConnection() {
    if (!this.connectionFactory) {
      throw new Error('Connection factory not provided');
    }
    
    try {
      const connection = await this.connectionFactory();
      logger.debug('New connection created');
      return connection;
    } catch (error) {
      logger.error('Failed to create connection', { error: error.message });
      throw error;
    }
  }

  async acquire() {
    if (this.isDestroyed) {
      throw new Error('Connection pool has been destroyed');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.acquireTimeout);

      this.waitingQueue.push({
        resolve: (connection) => {
          clearTimeout(timeout);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  async processQueue() {
    if (this.waitingQueue.length === 0) {
      return;
    }

    // Try to find an available connection
    const availableConnection = this.pool.find(item => !item.inUse);
    
    if (availableConnection) {
      const waiter = this.waitingQueue.shift();
      
      // Validate connection before use
      try {
        const isValid = await this.validateConnection(availableConnection.connection);
        if (!isValid) {
          // Remove invalid connection and create a new one
          await this.destroyConnection(availableConnection.connection);
          const index = this.pool.indexOf(availableConnection);
          this.pool.splice(index, 1);
          
          // Try to create a new connection
          const newConnection = await this.createConnection();
          const newItem = {
            connection: newConnection,
            createdAt: Date.now(),
            lastUsed: Date.now(),
            inUse: true
          };
          this.pool.push(newItem);
          this.activeConnections.add(newItem);
          waiter.resolve(newConnection);
          return;
        }
      } catch (error) {
        waiter.reject(error);
        return;
      }
      
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();
      this.activeConnections.add(availableConnection);
      waiter.resolve(availableConnection.connection);
      return;
    }

    // If no available connections and we haven't reached max, create a new one
    if (this.pool.length < this.maxConnections) {
      try {
        const connection = await this.createConnection();
        const connectionItem = {
          connection,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          inUse: true
        };
        
        this.pool.push(connectionItem);
        this.activeConnections.add(connectionItem);
        
        const waiter = this.waitingQueue.shift();
        waiter.resolve(connection);
      } catch (error) {
        const waiter = this.waitingQueue.shift();
        waiter.reject(error);
      }
    }
  }

  release(connection) {
    const connectionItem = this.pool.find(item => item.connection === connection);
    
    if (connectionItem) {
      connectionItem.inUse = false;
      connectionItem.lastUsed = Date.now();
      this.activeConnections.delete(connectionItem);
      
      logger.debug('Connection released back to pool');
      
      // Process any waiting requests
      this.processQueue();
    } else {
      logger.warn('Attempted to release connection not in pool');
    }
  }

  async cleanupIdleConnections() {
    const now = Date.now();
    const connectionsToRemove = [];
    
    for (const item of this.pool) {
      if (!item.inUse && 
          (now - item.lastUsed) > this.idleTimeout && 
          this.pool.length > this.minConnections) {
        connectionsToRemove.push(item);
      }
    }
    
    for (const item of connectionsToRemove) {
      try {
        await this.destroyConnection(item.connection);
        const index = this.pool.indexOf(item);
        this.pool.splice(index, 1);
        logger.debug('Idle connection removed from pool');
      } catch (error) {
        logger.error('Error destroying idle connection', { error: error.message });
      }
    }
  }

  getStats() {
    return {
      totalConnections: this.pool.length,
      activeConnections: this.activeConnections.size,
      availableConnections: this.pool.filter(item => !item.inUse).length,
      waitingRequests: this.waitingQueue.length,
      maxConnections: this.maxConnections,
      minConnections: this.minConnections
    };
  }

  async destroy() {
    if (this.isDestroyed) {
      return;
    }
    
    this.isDestroyed = true;
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      waiter.reject(new Error('Connection pool destroyed'));
    }
    this.waitingQueue = [];
    
    // Destroy all connections
    for (const item of this.pool) {
      try {
        await this.destroyConnection(item.connection);
      } catch (error) {
        logger.error('Error destroying connection during pool destruction', { 
          error: error.message 
        });
      }
    }
    
    this.pool = [];
    this.activeConnections.clear();
    
    logger.info('Connection pool destroyed');
  }
}

module.exports = ConnectionPool;
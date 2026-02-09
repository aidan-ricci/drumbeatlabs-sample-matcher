const mongoose = require('mongoose');
const logger = require('../utils/logger');

class MongoDBConnection {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  async connect(uri, options = {}) {
    try {
      const defaultOptions = {
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        ...options
      };

      this.connection = await mongoose.connect(uri, defaultOptions);
      this.isConnected = true;

      logger.info('MongoDB connected successfully');

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

      return this.connection;
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.connection.close();
        this.isConnected = false;
        logger.info('MongoDB disconnected gracefully');
      }
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnection() {
    return this.connection;
  }

  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  async healthCheck() {
    try {
      if (!this.isHealthy()) {
        return {
          status: 'unhealthy',
          message: 'Not connected to MongoDB',
          readyState: mongoose.connection.readyState
        };
      }

      // Perform a simple ping operation
      await mongoose.connection.db.admin().ping();
      
      return {
        status: 'healthy',
        message: 'MongoDB connection is healthy',
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        readyState: mongoose.connection.readyState
      };
    }
  }
}

// Singleton instance
const mongoConnection = new MongoDBConnection();

module.exports = mongoConnection;
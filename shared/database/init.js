const mongoConnection = require('./mongodb');
const migrationRunner = require('./migrationRunner');
const logger = require('../utils/logger');

/**
 * Database initialization utility
 * Handles connection setup and migrations
 */
class DatabaseInitializer {
  constructor() {
    this.isInitialized = false;
  }

  async initialize(mongoUri, options = {}) {
    try {
      logger.info('Initializing database connection and schema...');
      
      // Connect to MongoDB
      await mongoConnection.connect(mongoUri, options);
      
      // Run migrations
      const migrationResult = await migrationRunner.initializeDatabase();
      
      this.isInitialized = true;
      
      logger.info('Database initialization completed successfully', {
        migrationsExecuted: migrationResult.executed,
        totalMigrations: migrationResult.total
      });
      
      return {
        success: true,
        connection: mongoConnection.getConnection(),
        migrations: migrationResult
      };
    } catch (error) {
      logger.error('Database initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async healthCheck() {
    try {
      const connectionHealth = await mongoConnection.healthCheck();
      
      return {
        database: connectionHealth,
        initialized: this.isInitialized,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        database: {
          status: 'unhealthy',
          message: error.message
        },
        initialized: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  async disconnect() {
    try {
      await mongoConnection.disconnect();
      this.isInitialized = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  isReady() {
    return this.isInitialized && mongoConnection.isHealthy();
  }

  getConnection() {
    if (!this.isReady()) {
      throw new Error('Database not initialized or connection not healthy');
    }
    return mongoConnection.getConnection();
  }

  async runMigrations() {
    if (!mongoConnection.isHealthy()) {
      throw new Error('Database connection not healthy');
    }
    
    return await migrationRunner.runMigrations();
  }

  async getMigrationStatus() {
    if (!mongoConnection.isHealthy()) {
      throw new Error('Database connection not healthy');
    }
    
    return await migrationRunner.getMigrationStatus();
  }

  async rollbackMigration(migrationName) {
    if (!mongoConnection.isHealthy()) {
      throw new Error('Database connection not healthy');
    }
    
    return await migrationRunner.rollbackMigration(migrationName);
  }
}

// Singleton instance
const dbInitializer = new DatabaseInitializer();

module.exports = dbInitializer;
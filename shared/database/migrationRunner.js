const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
    this.migrationCollection = 'migrations';
  }

  async getMigrationCollection() {
    return mongoose.connection.db.collection(this.migrationCollection);
  }

  async getExecutedMigrations() {
    try {
      const collection = await this.getMigrationCollection();
      const migrations = await collection.find({}).sort({ executedAt: 1 }).toArray();
      return migrations.map(m => m.name);
    } catch (error) {
      logger.warn('Migration collection does not exist yet, assuming no migrations executed');
      return [];
    }
  }

  async recordMigration(migrationName, success = true, error = null) {
    const collection = await this.getMigrationCollection();
    
    const record = {
      name: migrationName,
      executedAt: new Date(),
      success,
      error: error ? error.message : null
    };

    await collection.insertOne(record);
  }

  async removeMigrationRecord(migrationName) {
    const collection = await this.getMigrationCollection();
    await collection.deleteOne({ name: migrationName });
  }

  async loadMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.js'))
        .sort(); // Ensure migrations run in order

      const migrations = [];
      
      for (const file of migrationFiles) {
        const migrationPath = path.join(this.migrationsPath, file);
        const MigrationClass = require(migrationPath);
        const migration = new MigrationClass();
        migrations.push({
          name: migration.name || file.replace('.js', ''),
          description: migration.description || 'No description',
          instance: migration
        });
      }

      return migrations;
    } catch (error) {
      logger.error('Failed to load migration files:', error);
      throw error;
    }
  }

  async runMigrations() {
    try {
      logger.info('Starting database migrations...');
      
      const allMigrations = await this.loadMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();
      
      const pendingMigrations = allMigrations.filter(
        migration => !executedMigrations.includes(migration.name)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to run');
        return { executed: 0, total: allMigrations.length };
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      let executedCount = 0;
      
      for (const migration of pendingMigrations) {
        try {
          logger.info(`Running migration: ${migration.name} - ${migration.description}`);
          
          await migration.instance.up();
          await this.recordMigration(migration.name, true);
          
          executedCount++;
          logger.info(`Migration ${migration.name} completed successfully`);
        } catch (error) {
          logger.error(`Migration ${migration.name} failed:`, error);
          await this.recordMigration(migration.name, false, error);
          throw error;
        }
      }

      logger.info(`Successfully executed ${executedCount} migrations`);
      return { executed: executedCount, total: allMigrations.length };
    } catch (error) {
      logger.error('Migration process failed:', error);
      throw error;
    }
  }

  async rollbackMigration(migrationName) {
    try {
      logger.info(`Rolling back migration: ${migrationName}`);
      
      const allMigrations = await this.loadMigrationFiles();
      const migration = allMigrations.find(m => m.name === migrationName);
      
      if (!migration) {
        throw new Error(`Migration ${migrationName} not found`);
      }

      if (!migration.instance.down) {
        throw new Error(`Migration ${migrationName} does not support rollback`);
      }

      await migration.instance.down();
      await this.removeMigrationRecord(migrationName);
      
      logger.info(`Migration ${migrationName} rolled back successfully`);
      return true;
    } catch (error) {
      logger.error(`Rollback failed for migration ${migrationName}:`, error);
      throw error;
    }
  }

  async getMigrationStatus() {
    try {
      const allMigrations = await this.loadMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();
      
      return allMigrations.map(migration => ({
        name: migration.name,
        description: migration.description,
        executed: executedMigrations.includes(migration.name)
      }));
    } catch (error) {
      logger.error('Failed to get migration status:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    try {
      logger.info('Initializing database...');
      
      // Ensure connection is established
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database connection not established');
      }

      // Run all pending migrations
      const result = await this.runMigrations();
      
      logger.info('Database initialization completed');
      return result;
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }
}

// Singleton instance
const migrationRunner = new MigrationRunner();

module.exports = migrationRunner;
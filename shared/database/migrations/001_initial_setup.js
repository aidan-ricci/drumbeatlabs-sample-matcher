const mongoose = require('mongoose');
const logger = require('../../utils/logger');

/**
 * Initial database setup migration
 * Creates indexes and initial data structure
 */
class InitialSetupMigration {
  constructor() {
    this.name = '001_initial_setup';
    this.description = 'Initial database setup with indexes and collections';
  }

  async up() {
    try {
      logger.info(`Running migration: ${this.name}`);
      
      const db = mongoose.connection.db;
      
      // Create assignments collection with indexes
      await this.createAssignmentsIndexes(db);
      
      // Create creators collection with indexes
      await this.createCreatorsIndexes(db);
      
      // Create migration tracking collection
      await this.createMigrationTracking(db);
      
      logger.info(`Migration ${this.name} completed successfully`);
      return true;
    } catch (error) {
      logger.error(`Migration ${this.name} failed:`, error);
      throw error;
    }
  }

  async down() {
    try {
      logger.info(`Rolling back migration: ${this.name}`);
      
      const db = mongoose.connection.db;
      
      // Drop collections (be careful in production!)
      await db.collection('assignments').drop().catch(() => {
        logger.warn('Assignments collection does not exist, skipping drop');
      });
      
      await db.collection('creators').drop().catch(() => {
        logger.warn('Creators collection does not exist, skipping drop');
      });
      
      await db.collection('migrations').drop().catch(() => {
        logger.warn('Migrations collection does not exist, skipping drop');
      });
      
      logger.info(`Migration ${this.name} rolled back successfully`);
      return true;
    } catch (error) {
      logger.error(`Migration ${this.name} rollback failed:`, error);
      throw error;
    }
  }

  async createAssignmentsIndexes(db) {
    const collection = db.collection('assignments');
    
    // Single field indexes
    await collection.createIndex({ topic: 1 });
    await collection.createIndex({ userId: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ createdAt: -1 });
    
    // Compound indexes
    await collection.createIndex({ userId: 1, createdAt: -1 });
    await collection.createIndex({ status: 1, createdAt: -1 });
    await collection.createIndex({ 'targetAudience.locale': 1, createdAt: -1 });
    
    // Text search index
    await collection.createIndex({
      topic: 'text',
      keyTakeaway: 'text',
      additionalContext: 'text',
      creatorValues: 'text',
      creatorNiches: 'text'
    }, {
      weights: {
        topic: 10,
        keyTakeaway: 8,
        creatorNiches: 6,
        creatorValues: 4,
        additionalContext: 2
      },
      name: 'assignment_text_search'
    });
    
    logger.info('Assignments collection indexes created');
  }

  async createCreatorsIndexes(db) {
    const collection = db.collection('creators');
    
    // Single field indexes
    await collection.createIndex({ uniqueId: 1 }, { unique: true });
    await collection.createIndex({ nickname: 1 });
    await collection.createIndex({ followerCount: -1 });
    await collection.createIndex({ region: 1 });
    await collection.createIndex({ 'metadata.isActive': 1 });
    
    // Compound indexes
    await collection.createIndex({ 'analysis.primaryNiches': 1, followerCount: -1 });
    await collection.createIndex({ region: 1, 'metadata.isActive': 1, followerCount: -1 });
    await collection.createIndex({ 'analysis.apparentValues': 1, 'metadata.isActive': 1 });
    await collection.createIndex({ 'metadata.isActive': 1, 'embeddings.lastUpdated': -1 });
    
    // Text search index
    await collection.createIndex({
      nickname: 'text',
      bio: 'text',
      'analysis.summary': 'text',
      'analysis.primaryNiches': 'text',
      'analysis.secondaryNiches': 'text',
      'analysis.apparentValues': 'text',
      'analysis.audienceInterests': 'text'
    }, {
      weights: {
        nickname: 10,
        'analysis.primaryNiches': 8,
        'analysis.apparentValues': 6,
        bio: 4,
        'analysis.summary': 3,
        'analysis.secondaryNiches': 2,
        'analysis.audienceInterests': 1
      },
      name: 'creator_text_search'
    });
    
    logger.info('Creators collection indexes created');
  }

  async createMigrationTracking(db) {
    const collection = db.collection('migrations');
    
    // Create index for migration tracking
    await collection.createIndex({ name: 1 }, { unique: true });
    await collection.createIndex({ executedAt: -1 });
    
    logger.info('Migration tracking collection created');
  }
}

module.exports = InitialSetupMigration;
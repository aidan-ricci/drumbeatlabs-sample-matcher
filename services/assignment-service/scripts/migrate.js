#!/usr/bin/env node

const path = require('path');
require('dotenv').config();

// Add shared modules to path
const sharedPath = path.join(__dirname, '../../../shared');
require('module').globalPaths.push(sharedPath);

const dbInitializer = require('../../shared/database/init');
const logger = require('../../shared/utils/logger');

async function runMigrations() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/creator-assignment-matcher';
    
    logger.info('Starting database migration process...');
    
    await dbInitializer.initialize(mongoUri);
    
    const status = await dbInitializer.getMigrationStatus();
    
    console.log('\nMigration Status:');
    console.log('================');
    status.forEach(migration => {
      const status = migration.executed ? '✅ EXECUTED' : '⏳ PENDING';
      console.log(`${status} ${migration.name} - ${migration.description}`);
    });
    
    await dbInitializer.disconnect();
    
    logger.info('Migration process completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration process failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const command = process.argv[2];

switch (command) {
  case 'status':
    runMigrations();
    break;
  case 'rollback':
    const migrationName = process.argv[3];
    if (!migrationName) {
      console.error('Please specify migration name to rollback');
      process.exit(1);
    }
    rollbackMigration(migrationName);
    break;
  default:
    runMigrations();
}

async function rollbackMigration(migrationName) {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/creator-assignment-matcher';
    
    await dbInitializer.initialize(mongoUri);
    await dbInitializer.rollbackMigration(migrationName);
    await dbInitializer.disconnect();
    
    logger.info(`Migration ${migrationName} rolled back successfully`);
    process.exit(0);
  } catch (error) {
    logger.error(`Rollback failed:`, error);
    process.exit(1);
  }
}
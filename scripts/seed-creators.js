#!/usr/bin/env node

const path = require('path');
require('dotenv').config();

// Add shared modules to path
const sharedPath = path.join(__dirname, '../shared');
require('module').globalPaths.push(sharedPath);

const dbInitializer = require('../shared/database/init');
const CreatorSeeder = require('../shared/database/seeders/creators');
const logger = require('../shared/utils/logger');

async function seedCreators() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/creator-assignment-matcher';
    
    logger.info('Connecting to database...');
    await dbInitializer.initialize(mongoUri);
    
    const seeder = new CreatorSeeder();
    
    // Get command line arguments
    const command = process.argv[2];
    
    switch (command) {
      case 'clear':
        const cleared = await seeder.clear();
        console.log(`✅ Cleared ${cleared} creators from database`);
        break;
        
      case 'stats':
        const stats = await seeder.getStats();
        console.log('\nCreator Database Statistics:');
        console.log('===========================');
        console.log(`Total Creators: ${stats.totalCreators}`);
        console.log(`Average Followers: ${stats.avgFollowers?.toLocaleString()}`);
        console.log(`Total Followers: ${stats.totalFollowers?.toLocaleString()}`);
        console.log(`Unique Regions: ${stats.uniqueRegions}`);
        console.log(`Unique Niches: ${stats.uniqueNiches}`);
        break;
        
      default:
        console.log('🌱 Starting creator seeding process...');
        const result = await seeder.seed();
        
        console.log('\n✅ Creator seeding completed!');
        console.log('==============================');
        console.log(`Total processed: ${result.total}`);
        console.log(`New creators: ${result.seeded}`);
        console.log(`Updated creators: ${result.updated}`);
        console.log(`Errors: ${result.errors}`);
        
        if (result.errors > 0) {
          console.log('\n⚠️  Some creators failed to seed. Check logs for details.');
        }
    }
    
    await dbInitializer.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding process failed:', error);
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Show usage if no command provided
if (process.argv.length < 3) {
  console.log('Usage:');
  console.log('  npm run seed:creators        - Seed creators from JSON');
  console.log('  npm run seed:creators clear  - Clear seeded creators');
  console.log('  npm run seed:creators stats  - Show creator statistics');
  process.exit(0);
}

seedCreators();
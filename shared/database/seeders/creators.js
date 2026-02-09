const fs = require('fs').promises;
const path = require('path');
const Creator = require('../../models/Creator');
const logger = require('../../utils/logger');

class CreatorSeeder {
  constructor() {
    this.name = 'creators';
    this.description = 'Seed creators collection from JSON data';
  }

  async seed() {
    try {
      logger.info('Starting creator seeding process...');
      
      // Read creators JSON file
      const creatorsPath = path.join(__dirname, '../../../creators.json');
      const creatorsData = await fs.readFile(creatorsPath, 'utf8');
      const creators = JSON.parse(creatorsData);
      
      const creatorIds = Object.keys(creators);
      logger.info(`Found ${creatorIds.length} creators to seed`);
      
      let seededCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const creatorId of creatorIds) {
        try {
          const creatorData = creators[creatorId];
          
          // Transform the data to match our schema
          const transformedCreator = this.transformCreatorData(creatorData);
          
          // Use upsert to update existing or create new
          const result = await Creator.findOneAndUpdate(
            { uniqueId: transformedCreator.uniqueId },
            transformedCreator,
            { 
              upsert: true, 
              new: true,
              setDefaultsOnInsert: true
            }
          );
          
          if (result.isNew !== false) {
            seededCount++;
          } else {
            updatedCount++;
          }
          
          if ((seededCount + updatedCount) % 10 === 0) {
            logger.info(`Processed ${seededCount + updatedCount} creators...`);
          }
        } catch (error) {
          errorCount++;
          logger.error(`Failed to seed creator ${creatorId}:`, error.message);
        }
      }
      
      logger.info('Creator seeding completed', {
        total: creatorIds.length,
        seeded: seededCount,
        updated: updatedCount,
        errors: errorCount
      });
      
      return {
        success: true,
        total: creatorIds.length,
        seeded: seededCount,
        updated: updatedCount,
        errors: errorCount
      };
    } catch (error) {
      logger.error('Creator seeding failed:', error);
      throw error;
    }
  }

  transformCreatorData(data) {
    // Transform the JSON data to match our Creator schema
    return {
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      bio: data.bio,
      followerCount: data.followerCount || 0,
      region: data.region || 'US',
      avatarUrl: data.avatarUrl || `https://example.com/avatars/${data.uniqueId}.jpg`,
      analysis: {
        summary: data.analysis?.summary || '',
        primaryNiches: data.analysis?.primaryNiches || [],
        secondaryNiches: data.analysis?.secondaryNiches || [],
        apparentValues: data.analysis?.apparentValues || [],
        audienceInterests: data.analysis?.audienceInterests || [],
        engagementStyle: {
          tone: data.analysis?.engagementStyle?.tone || ['Informative'],
          contentStyle: data.analysis?.engagementStyle?.contentStyle || 'General content style'
        }
      },
      embeddings: data.embeddings || undefined,
      metadata: {
        isActive: true,
        lastSyncedAt: new Date(),
        syncSource: 'json_seed'
      }
    };
  }

  async clear() {
    try {
      logger.info('Clearing creators collection...');
      
      const result = await Creator.deleteMany({
        'metadata.syncSource': 'json_seed'
      });
      
      logger.info(`Cleared ${result.deletedCount} seeded creators`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to clear creators:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const stats = await Creator.getCreatorStats();
      return stats[0] || {
        totalCreators: 0,
        avgFollowers: 0,
        totalFollowers: 0,
        uniqueRegions: 0,
        uniqueNiches: 0
      };
    } catch (error) {
      logger.error('Failed to get creator stats:', error);
      throw error;
    }
  }
}

module.exports = CreatorSeeder;
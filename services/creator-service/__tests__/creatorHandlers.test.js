const request = require('supertest');
const express = require('express');
const creatorHandlers = require('../handlers/creatorHandlers');
const serviceManager = require('../../../shared/services/serviceManager');

// Mock the service manager
jest.mock('../../../shared/services/serviceManager', () => ({
  isInitialized: jest.fn(),
  generateEmbedding: jest.fn(),
  generateEmbeddings: jest.fn(),
  queryVectors: jest.fn(),
  upsertVectors: jest.fn()
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

const fs = require('fs').promises;

describe('Creator Handlers', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Setup routes
    app.get('/creators', creatorHandlers.getCreators);
    app.get('/creators/:id', creatorHandlers.getCreatorById);
    app.post('/creators/ingest', creatorHandlers.ingestCreators);
    app.post('/creators/embeddings', creatorHandlers.generateEmbeddings);
    app.post('/creators/search', creatorHandlers.searchCreators);
    app.post('/creators/embeddings/refresh', creatorHandlers.refreshEmbeddings);

    // Reset mocks
    jest.clearAllMocks();

    // Default mock implementations
    serviceManager.isInitialized.mockReturnValue(true);
  });

  describe('GET /creators', () => {
    const mockCreatorData = [
      {
        uniqueId: 'test1',
        nickname: 'Test Creator 1',
        bio: 'Test bio 1',
        region: 'US',
        analysis: {
          primaryNiches: ['Tech'],
          secondaryNiches: ['Gaming']
        }
      },
      {
        uniqueId: 'test2',
        nickname: 'Test Creator 2',
        bio: 'Test bio 2',
        region: 'UK',
        analysis: {
          primaryNiches: ['Finance'],
          secondaryNiches: []
        }
      }
    ];

    beforeEach(() => {
      fs.readFile.mockResolvedValue(JSON.stringify({
        test1: mockCreatorData[0],
        test2: mockCreatorData[1]
      }));
    });

    it('should return creators with pagination', async () => {
      const response = await request(app)
        .get('/creators')
        .expect(200);

      expect(response.body).toHaveProperty('creators');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.creators).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter creators by region', async () => {
      const response = await request(app)
        .get('/creators?region=US')
        .expect(200);

      expect(response.body.creators).toHaveLength(1);
      expect(response.body.creators[0].region).toBe('US');
    });

    it('should filter creators by niche', async () => {
      const response = await request(app)
        .get('/creators?niche=Tech')
        .expect(200);

      expect(response.body.creators).toHaveLength(1);
      expect(response.body.creators[0].analysis.primaryNiches).toContain('Tech');
    });

    it('should return 503 when services not initialized', async () => {
      serviceManager.isInitialized.mockReturnValue(false);

      await request(app)
        .get('/creators')
        .expect(503);
    });
  });

  describe('GET /creators/:id', () => {
    const mockCreatorData = [
      {
        uniqueId: 'test1',
        nickname: 'Test Creator 1',
        bio: 'Test bio 1'
      }
    ];

    beforeEach(() => {
      fs.readFile.mockResolvedValue(JSON.stringify({
        test1: mockCreatorData[0]
      }));
    });

    it('should return creator by ID', async () => {
      const response = await request(app)
        .get('/creators/test1')
        .expect(200);

      expect(response.body.creator.uniqueId).toBe('test1');
    });

    it('should return 404 for non-existent creator', async () => {
      await request(app)
        .get('/creators/nonexistent')
        .expect(404);
    });
  });

  describe('POST /creators/embeddings', () => {
    it('should generate embeddings for texts', async () => {
      const mockEmbeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
      serviceManager.generateEmbeddings.mockResolvedValue(mockEmbeddings);

      const response = await request(app)
        .post('/creators/embeddings')
        .send({ texts: ['text1', 'text2'] })
        .expect(200);

      expect(response.body.embeddings).toEqual(mockEmbeddings);
      expect(response.body.count).toBe(2);
    });

    it('should return 400 for missing texts', async () => {
      await request(app)
        .post('/creators/embeddings')
        .send({})
        .expect(400);
    });
  });

  describe('POST /creators/search', () => {
    it('should search creators using vector similarity', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockResults = {
        matches: [
          { id: 'test1', score: 0.9 }
        ]
      };
      const mockCreatorData = [
        {
          uniqueId: 'test1',
          nickname: 'Test Creator 1'
        }
      ];

      serviceManager.generateEmbedding.mockResolvedValue(mockEmbedding);
      serviceManager.queryVectors.mockResolvedValue(mockResults);
      fs.readFile.mockResolvedValue(JSON.stringify({
        test1: mockCreatorData[0]
      }));

      const response = await request(app)
        .post('/creators/search')
        .send({ query: 'test query' })
        .expect(200);

      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].creator.uniqueId).toBe('test1');
    });

    it('should return 400 for missing query', async () => {
      await request(app)
        .post('/creators/search')
        .send({})
        .expect(400);
    });
  });

  describe('POST /creators/embeddings/refresh', () => {
    const mockCreatorData = [
      {
        uniqueId: 'test1',
        nickname: 'Test Creator 1',
        bio: 'Test bio 1',
        analysis: {
          primaryNiches: ['Tech'],
          secondaryNiches: ['Gaming'],
          apparentValues: ['Innovation']
        }
      }
    ];

    beforeEach(() => {
      jest.useFakeTimers();
      // Advance time by 10 minutes to bypass cache cooldown
      jest.advanceTimersByTime(10 * 60 * 1000);

      fs.readFile.mockResolvedValue(JSON.stringify({
        test1: mockCreatorData[0]
      }));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should refresh embeddings for all creators', async () => {
      const mockEmbeddings = [[0.1, 0.2, 0.3]];
      serviceManager.generateEmbeddings.mockResolvedValue(mockEmbeddings);
      serviceManager.upsertVectors.mockResolvedValue({ upsertedCount: 1 });

      const response = await request(app)
        .post('/creators/embeddings/refresh')
        .send({ batchSize: 1 })
        .expect(200);

      expect(response.body.summary.processed).toBe(1);
      expect(serviceManager.generateEmbeddings).toHaveBeenCalled();
      expect(serviceManager.upsertVectors).toHaveBeenCalled();
    });
  });
});
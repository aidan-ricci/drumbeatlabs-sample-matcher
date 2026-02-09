const fc = require('fast-check');
const creatorHandlers = require('../handlers/creatorHandlers');
const serviceManager = require('../../../shared/services/serviceManager');
const fs = require('fs').promises;
const path = require('path');

// Mock the service manager
jest.mock('../../../shared/services/serviceManager', () => ({
    isInitialized: jest.fn(),
    generateEmbedding: jest.fn(),
    queryVectors: jest.fn()
}));

// Mock fs promises
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn()
    }
}));

describe('Creator Service Property-Based Tests', () => {
    const mockCreatorData = {
        'c1': { uniqueId: 'c1', nickname: 'Creator 1', bio: 'Bio 1', region: 'US', analysis: { primaryNiches: ['Tech'] } },
        'c2': { uniqueId: 'c2', nickname: 'Creator 2', bio: 'Bio 2', region: 'UK', analysis: { primaryNiches: ['Finance'] } }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        serviceManager.isInitialized.mockReturnValue(true);
        fs.readFile.mockResolvedValue(JSON.stringify(mockCreatorData));
    });

    // Feature: creator-assignment-matcher, Property 5: Matching engine performs semantic search
    test('Property 5: searchCreators always performs semantic search and returns enriched results', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }), // Random query string
                fc.integer({ min: 1, max: 20 }), // Random topK
                async (query, topK) => {
                    // Setup mocks for this iteration
                    const mockEmbedding = Array(1536).fill(0).map(() => Math.random());
                    serviceManager.generateEmbedding.mockResolvedValue(mockEmbedding);
                    serviceManager.queryVectors.mockResolvedValue({
                        matches: [
                            { id: 'c1', score: 0.9 },
                            { id: 'c2', score: 0.8 }
                        ]
                    });

                    const req = { body: { query, topK } };
                    const res = {
                        json: jest.fn(),
                        status: jest.fn().mockReturnThis()
                    };

                    await creatorHandlers.searchCreators(req, res);

                    // Verify semantic search was performed
                    expect(serviceManager.generateEmbedding).toHaveBeenCalledWith(query);
                    expect(serviceManager.queryVectors).toHaveBeenCalledWith(mockEmbedding, topK, undefined);

                    // Verify results are enriched and returned
                    expect(res.json).toHaveBeenCalled();
                    const responseBody = res.json.mock.calls[0][0];
                    expect(responseBody.results).toHaveLength(2);
                    expect(responseBody.results[0].creator).toBeDefined();
                    expect(responseBody.results[0].creator.uniqueId).toBe('c1');
                }
            ),
            { numRuns: 100 }
        );
    });

    // Feature: creator-assignment-matcher, Property 20: Vector database embedding management
    // (Testing the refreshEmbeddings logic)
    test('Property 20: refreshEmbeddings correctly batches and upserts vectors', async () => {
        // Only run a few times as this is expensive to mock fully
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 5 }), // Batch size
                async (batchSize) => {
                    jest.clearAllMocks();
                    serviceManager.generateEmbeddings = jest.fn().mockImplementation((texts) =>
                        Promise.resolve(texts.map(() => Array(1536).fill(0)))
                    );
                    serviceManager.upsertVectors = jest.fn().mockResolvedValue({ upsertedCount: 1 });
                    serviceManager.isInitialized.mockReturnValue(true);

                    const req = { body: { batchSize } };
                    const res = {
                        json: jest.fn(),
                        status: jest.fn().mockReturnThis()
                    };

                    await creatorHandlers.refreshEmbeddings(req, res);

                    expect(res.json).toHaveBeenCalled();
                    const responseBody = res.json.mock.calls[0][0];
                    expect(responseBody.summary.processed).toBe(2); // Based on mockCreatorData size
                    expect(serviceManager.generateEmbeddings).toHaveBeenCalled();
                    expect(serviceManager.upsertVectors).toHaveBeenCalled();
                }
            ),
            { numRuns: 10 }
        );
    });
});

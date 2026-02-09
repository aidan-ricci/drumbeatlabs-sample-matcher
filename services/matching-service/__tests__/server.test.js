const request = require('supertest');
const serviceManager = require('../../../shared/services/serviceManager');
const fs = require('fs').promises;
const path = require('path');

// Mock the service manager
jest.mock('../../../shared/services/serviceManager', () => ({
    initialize: jest.fn().mockResolvedValue(true),
    generateEmbedding: jest.fn().mockResolvedValue(Array(1536).fill(0)),
    queryVectors: jest.fn().mockResolvedValue({
        matches: [
            { id: 'mindsovermoney', score: 0.9 },
            { id: 'marketdecoded', score: 0.85 },
            { id: 'careercompass', score: 0.8 },
            { id: 'civicbriefs', score: 0.75 }
        ]
    }),
    generateCompletion: jest.fn().mockResolvedValue('Mocked AI reasoning/framing content.'),
    getServiceHealth: jest.fn().mockResolvedValue({}),
    getOverallHealth: jest.fn().mockResolvedValue({ status: 'healthy' })
}));

// Mock fs to return creators
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn().mockImplementation((filePath) => {
            if (filePath.includes('creators.json')) {
                return Promise.resolve(JSON.stringify({
                    mindsovermoney: { uniqueId: 'mindsovermoney', nickname: 'Alex R.', analysis: { primaryNiches: ['Money'], summary: 'Summary' } },
                    marketdecoded: { uniqueId: 'marketdecoded', nickname: 'Taylor K.', analysis: { primaryNiches: ['Finance'], summary: 'Summary' } },
                    careercompass: { uniqueId: 'careercompass', nickname: 'Riley S.', analysis: { primaryNiches: ['Career'], summary: 'Summary' } },
                    civicbriefs: { uniqueId: 'civicbriefs', nickname: 'Sam P.', analysis: { primaryNiches: ['Law'], summary: 'Summary' } }
                }));
            }
            return Promise.reject(new Error('File not found'));
        })
    }
}));

const app = require('../server');

describe('Matching Service API Tests', () => {
    const mockAssignment = {
        topic: 'Investing',
        keyTakeaway: 'Save more',
        additionalContext: 'Context'
    };

    beforeAll(async () => {
        // Wait for internal init
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    // Property 9: Matching returns exactly three ranked creators
    test('POST /matches returns exactly 3 ranked creators', async () => {
        const response = await request(app)
            .post('/matches')
            .send({ assignment: mockAssignment })
            .expect(200);

        expect(response.body.data.matches).toHaveLength(3);
        expect(response.body.data.reasoning).toBeDefined();

        // Verify ranking
        const scores = response.body.data.matches.map(m => m.matchScore);
        expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
        expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
    });

    test('POST /matches/framing returns content framing', async () => {
        const response = await request(app)
            .post('/matches/framing')
            .send({
                assignment: mockAssignment,
                creator: { nickname: 'Alex R.', bio: 'Bio' }
            })
            .expect(200);

        expect(response.body.framing).toBeDefined();
    });
});

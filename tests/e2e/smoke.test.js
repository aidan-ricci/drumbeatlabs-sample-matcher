const request = require('supertest');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const ASSIGNMENT_URL = process.env.ASSIGNMENT_URL || 'http://localhost:3001';
const CREATOR_URL = process.env.CREATOR_URL || 'http://localhost:3002';
const MATCHING_URL = process.env.MATCHING_URL || 'http://localhost:3003';

describe('E2E Smoke Tests', () => {
    // Basic service health checks
    describe('Service Health Checks', () => {
        test('API Gateway should be healthy', async () => {
            const response = await request(GATEWAY_URL).get('/health');
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('healthy');
            expect(response.body.service).toBe('api-gateway');
        });

        test('Assignment Service should be healthy', async () => {
            const response = await request(ASSIGNMENT_URL).get('/health');
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('healthy');
            expect(response.body.service).toBe('assignment-service');
        });

        test('Creator Service should be healthy (or degraded)', async () => {
            const response = await request(CREATOR_URL).get('/health');
            // Allow 503 if external services (Pinecone/OpenAI) are not configured correctly
            expect([200, 503]).toContain(response.status);
            expect(response.body.service).toBe('creator-service');
        });

        test('Matching Service should be healthy (or degraded)', async () => {
            const response = await request(MATCHING_URL).get('/health');
            // Allow 503 if external services are not configured
            expect([200, 503]).toContain(response.status);
            expect(response.body.service).toBe('matching-service');
        });
    });

    // Integration Flow via Gateway
    describe('API Gateway Integration', () => {
        let createdAssignmentId;

        test('Should forward requests to Assignment Service', async () => {
            const assignmentData = {
                topic: 'E2E Test Topic',
                keyTakeaway: 'Testing infrastructure',
                additionalContext: 'Smoke test run'
            };

            const response = await request(GATEWAY_URL)
                .post('/api/assignments')
                .send(assignmentData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();
            createdAssignmentId = response.body.data.id;
        });

        test('Should retrieve created assignment via Gateway', async () => {
            if (!createdAssignmentId) {
                console.warn('Skipping test: No assignment created');
                return;
            }

            const response = await request(GATEWAY_URL)
                .get(`/api/assignments/${createdAssignmentId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.topic).toBe('E2E Test Topic');
        });

        test('Should forward requests to Creator Service', async () => {
            const response = await request(GATEWAY_URL)
                .get('/api/creators?limit=1');

            // Should succeed or fail gracefully (503) depending on init state
            if (response.status === 200) {
                expect(response.body.creators).toBeDefined();
            } else {
                expect(response.status).toBe(503);
            }
        });

        test('Should trigger matching process via Gateway', async () => {
            const assignmentData = {
                topic: 'Matching Test',
                keyTakeaway: 'Testing embeddings',
                additionalContext: 'Smoke test run'
            };

            const response = await request(GATEWAY_URL)
                .post('/api/matches')
                .send({ assignment: assignmentData });

            // Expect success (200) or fallback/graceful failure (503)
            // But NOT 500 or malformed request
            expect([200, 503]).toContain(response.status);

            if (response.status === 200) {
                expect(response.body.success).toBe(true);
                expect(response.body.data.matches).toBeDefined();
                // Check if fallback was used (might happen if no keys)
                if (response.body.data.isFallback) {
                    console.log('Matching used fallback mode');
                }
            }
        }, 30000);
    });
});

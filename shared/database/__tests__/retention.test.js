const fc = require('fast-check');
const mongoose = require('mongoose');
const Assignment = require('../../models/Assignment');

describe('Data Retention Policy Tests', () => {
    // Property 19: Data retention policy enforcement
    test('Property 19: TTL index is configured correctly', () => {
        const indexes = Assignment.schema.indexes();
        const ttlIndex = indexes.find(idx =>
            idx[0].createdAt === 1 && idx[1].expireAfterSeconds
        );

        expect(ttlIndex).toBeDefined();
        expect(ttlIndex[1].expireAfterSeconds).toBeGreaterThan(0);
    });

    test('Property 19: Retention period is configurable via environment', () => {
        const defaultRetention = 2592000; // 30 days in seconds
        const envRetention = process.env.DATA_RETENTION_SECONDS;

        const indexes = Assignment.schema.indexes();
        const ttlIndex = indexes.find(idx =>
            idx[0].createdAt === 1 && idx[1].expireAfterSeconds
        );

        const expectedRetention = envRetention ? parseInt(envRetention) : defaultRetention;
        expect(ttlIndex[1].expireAfterSeconds).toBe(expectedRetention);
    });

    test('Property 19: Old documents are marked for deletion', async () => {
        // This test verifies the TTL index structure, actual deletion is handled by MongoDB
        const schema = Assignment.schema;
        const ttlIndexes = schema.indexes().filter(idx => idx[1].expireAfterSeconds);

        expect(ttlIndexes.length).toBeGreaterThan(0);
        ttlIndexes.forEach(idx => {
            expect(idx[1].expireAfterSeconds).toBeGreaterThan(0);
        });
    });
});

const fc = require('fast-check');
const schemas = require('../validation/schemas');

describe('Shared Logic Property-Based Tests', () => {

    describe('Assignment Schema Validation (Property 17)', () => {
        test('Valid assignment data always passes validation', () => {
            const nonWhitespaceString = (min, max) => fc.string({ minLength: min, maxLength: max }).filter(s => s.trim().length >= min);

            const assignmentArb = fc.record({
                topic: nonWhitespaceString(1, 500),
                keyTakeaway: nonWhitespaceString(1, 1000),
                additionalContext: nonWhitespaceString(1, 2000),
                targetAudience: fc.option(fc.record({
                    demographic: nonWhitespaceString(1, 200),
                    locale: nonWhitespaceString(2, 10)
                }), { nil: undefined }),
                creatorValues: fc.option(fc.array(nonWhitespaceString(1, 10)), { nil: undefined }),
                creatorNiches: fc.option(fc.array(nonWhitespaceString(1, 10)), { nil: undefined }),
                toneStyle: fc.option(nonWhitespaceString(1, 100), { nil: undefined })
            });

            fc.assert(
                fc.property(assignmentArb, (data) => {
                    const { error } = schemas.validateAssignment(data);
                    if (error) {
                        console.log('Error data:', JSON.stringify(data, null, 2));
                    }
                    expect(error).toBeUndefined();
                })
            );
        });

        test('Invalid assignment data (e.g., missing required fields) always fails validation', () => {
            const invalidAssignmentArb = fc.record({
                // missing topic
                keyTakeaway: fc.string({ minLength: 1, maxLength: 1000 }),
                additionalContext: fc.string({ minLength: 1, maxLength: 2000 })
            });

            fc.assert(
                fc.property(invalidAssignmentArb, (data) => {
                    const { error } = schemas.validateAssignment(data);
                    expect(error).toBeDefined();
                })
            );
        });
    });

    describe('Creator Schema Validation (Property 17)', () => {
        test('Valid creator data always passes validation', () => {
            const nonWhitespaceString = (len) => fc.string({ minLength: 1, maxLength: len }).filter(s => s.trim().length > 0);

            const creatorArb = fc.record({
                uniqueId: nonWhitespaceString(50),
                nickname: nonWhitespaceString(100),
                bio: nonWhitespaceString(500),
                followerCount: fc.integer({ min: 0 }),
                region: fc.string({ minLength: 2, maxLength: 10 }).filter(s => s.trim().length >= 2),
                avatarUrl: fc.constant('http://example.com/avatar.jpg'),
                analysis: fc.record({
                    summary: nonWhitespaceString(500),
                    primaryNiches: fc.array(nonWhitespaceString(50), { minLength: 1 }),
                    engagementStyle: fc.record({
                        tone: fc.array(nonWhitespaceString(20), { minLength: 1 }),
                        contentStyle: nonWhitespaceString(200)
                    })
                })
            });

            fc.assert(
                fc.property(creatorArb, (data) => {
                    const { error } = schemas.validateCreator(data);
                    expect(error).toBeUndefined();
                })
            );
        });
    });
});

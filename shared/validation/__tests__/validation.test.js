const fc = require('fast-check');
const { validateAssignment, validateCreator } = require('../schemas');

describe('Data Validation Property-Based Tests', () => {
    // Arbitrary for strings with valid lengths
    const validString = (min, max) => fc.string({ minLength: min, maxLength: max }).map(s => s.trim()).filter(s => s.length >= min);

    const assignmentArbitrary = fc.record({
        topic: validString(1, 500),
        keyTakeaway: validString(1, 1000),
        additionalContext: validString(1, 2000),
        targetAudience: fc.option(fc.record({
            demographic: validString(1, 200),
            locale: validString(2, 10)
        }), { nil: undefined }),
        creatorValues: fc.option(fc.array(validString(1, 100), { maxLength: 5 }), { nil: undefined }),
        creatorNiches: fc.option(fc.array(validString(1, 100), { maxLength: 5 }), { nil: undefined }),
        toneStyle: fc.option(validString(1, 100), { nil: undefined })
    });

    const creatorAnalysisArbitrary = fc.record({
        summary: validString(1, 2000),
        primaryNiches: fc.array(validString(1, 100), { minLength: 1, maxLength: 3 }),
        secondaryNiches: fc.option(fc.array(validString(1, 100), { maxLength: 2 }), { nil: undefined }),
        apparentValues: fc.option(fc.array(validString(1, 100), { maxLength: 3 }), { nil: undefined }),
        audienceInterests: fc.option(fc.array(validString(1, 100), { maxLength: 5 }), { nil: undefined }),
        engagementStyle: fc.record({
            tone: fc.array(validString(1, 50), { minLength: 1, maxLength: 3 }),
            contentStyle: validString(1, 500)
        })
    });

    const creatorArbitrary = fc.record({
        uniqueId: validString(1, 100),
        nickname: validString(1, 200),
        bio: validString(1, 1000),
        followerCount: fc.integer({ min: 0 }),
        region: validString(2, 10),
        avatarUrl: fc.constant('https://example.com/avatar.jpg'), // Simplification for URI
        analysis: creatorAnalysisArbitrary
    });

    // Property: Valid assignments always pass validation
    test('Property: Valid assignments always pass validation', () => {
        fc.assert(
            fc.property(assignmentArbitrary, (assignment) => {
                const { error } = validateAssignment(assignment);
                expect(error).toBeUndefined();
            })
        );
    });

    // Property: Valid creators always pass validation
    test('Property: Valid creators always pass validation', () => {
        fc.assert(
            fc.property(creatorArbitrary, (creator) => {
                const { error } = validateCreator(creator);
                expect(error).toBeUndefined();
            })
        );
    });

    // Property: Missing required fields should always fail
    test('Property: Missing required assignment fields fails validation', () => {
        const invalidAssignment = fc.record({
            topic: validString(1, 500),
            // keyTakeaway missing
            additionalContext: validString(1, 2000)
        });

        fc.assert(
            fc.property(invalidAssignment, (assignment) => {
                const { error } = validateAssignment(assignment);
                expect(error).toBeDefined();
            })
        );
    });
});

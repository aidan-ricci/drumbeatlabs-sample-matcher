const fc = require('fast-check');
const matcher = require('../utils/matcher');

describe('Matching Service Property-Based Tests', () => {
    // Mock creator creator
    const createMockCreator = (id, niches, values, region) => ({
        uniqueId: id,
        nickname: `Creator ${id}`,
        heartCount: 1000,
        followerCount: 500,
        region: region || 'US',
        analysis: {
            primaryNiches: niches || [],
            secondaryNiches: [],
            apparentValues: values || [],
            summary: 'A test creator'
        }
    });

    const creatorArbitrary = fc.record({
        uniqueId: fc.string(),
        nickname: fc.string(),
        heartCount: fc.integer({ min: 0, max: 1000000 }),
        followerCount: fc.integer({ min: 1, max: 1000000 }),
        region: fc.string({ minLength: 2, maxLength: 5 }),
        analysis: fc.record({
            primaryNiches: fc.array(fc.string(), { maxLength: 3 }),
            secondaryNiches: fc.array(fc.string(), { maxLength: 2 }),
            apparentValues: fc.array(fc.string(), { maxLength: 3 }),
            summary: fc.string()
        })
    });

    const assignmentArbitrary = fc.record({
        topic: fc.string(),
        keyTakeaway: fc.string(),
        creatorNiches: fc.array(fc.string(), { maxLength: 5 }),
        creatorValues: fc.array(fc.string(), { maxLength: 5 }),
        targetAudience: fc.option(fc.record({
            locale: fc.string({ minLength: 2, maxLength: 5 })
        }))
    });

    // Property 6: Rule-based scoring applied to semantic candidates
    test('Property 6: Niche alignment score is between 0 and 1', () => {
        fc.assert(
            fc.property(assignmentArbitrary, creatorArbitrary, (assignment, creator) => {
                const score = matcher.calculateNicheAlignment(assignment, creator);
                expect(score).toBeGreaterThanOrEqual(0);
                expect(score).toBeLessThanOrEqual(1);
            })
        );
    });

    // Property 7: Tie-breaking logic for similar scores
    test('Property 7: breakTie returns deterministic ordering based on engagement', () => {
        fc.assert(
            fc.property(creatorArbitrary, creatorArbitrary, (c1, c2) => {
                const match1 = { creator: c1, matchScore: 0.8 };
                const match2 = { creator: c2, matchScore: 0.8 };

                const result = matcher.breakTie(match1, match2);
                const inverseResult = matcher.breakTie(match2, match1);

                if (result === 0) {
                    expect(inverseResult).toBe(0);
                } else {
                    expect(Math.sign(result)).toBe(-Math.sign(inverseResult));
                }
            })
        );
    });

    // Property 8: Score combination uses weighted algorithms
    test('Property 8: Total match score is weighted correctly', () => {
        fc.assert(
            fc.property(assignmentArbitrary, creatorArbitrary, fc.float({ min: 0, max: 1, noNaN: true }), (assignment, creator, semanticScore) => {
                const result = matcher.calculateMatch(assignment, creator, semanticScore);

                // Manual calculation verification
                const n = matcher.calculateNicheAlignment(assignment, creator);
                const a = matcher.calculateAudienceMatch(assignment, creator);
                const v = matcher.calculateValueAlignment(assignment, creator);

                const expected = (
                    (semanticScore * 0.6) +
                    (n * 0.2) +
                    (a * 0.1) +
                    (v * 0.1)
                );

                expect(result.matchScore).toBeCloseTo(expected, 4);
            })
        );
    });

    // Property 9: Matching returns exactly three ranked creators
    test('Property 9: rankMatches handles empty and small arrays correctly', () => {
        fc.assert(
            fc.property(fc.array(fc.record({ matchScore: fc.float({ min: 0, max: 1, noNaN: true }), creator: creatorArbitrary })), (matches) => {
                const ranked = matcher.rankMatches(matches);
                expect(ranked.length).toBe(matches.length);

                // Verify sorting order
                for (let i = 0; i < ranked.length - 1; i++) {
                    expect(ranked[i].matchScore).toBeGreaterThanOrEqual(ranked[i + 1].matchScore);
                }
            })
        );
    });
});

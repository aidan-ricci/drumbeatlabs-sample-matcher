const logger = require('../../../shared/utils/logger');

class Matcher {
    constructor() {
        this.weights = {
            semanticSimilarity: 0.7,    // Reduced from 0.9
            nicheAlignment: 0.2,        // Increased from 0.05
            audienceMatch: 0.05,        // Slightly increased
            valueAlignment: 0.05        // Slightly increased
        };
    }

    /**
     * Calculates the combined match score for a creator and an assignment
     * @param {Object} assignment - The assignment details
     * @param {Object} creator - The creator profile
     * @param {number} semanticScore - The score from vector similarity search
     * @returns {Object} - Match result with score breakdown
     */
    calculateMatch(assignment, creator, semanticScore) {
        // Calculate base scores
        const nicheScore = this.calculateNicheAlignment(assignment, creator);
        const audienceScore = this.calculateAudienceMatch(assignment, creator);
        const valueScore = this.calculateValueAlignment(assignment, creator);

        // Normalize semantic score from [-1, 1] to [0, 1]
        const normalizedSemanticScore = (semanticScore + 1) / 2;

        // Calculate a niche boost factor (exponential scaling for more niche matches)
        const maxNiches = assignment.creatorNiches?.length || 1;
        const nicheMatchRatio = nicheScore / maxNiches;
        const nicheBoost = Math.pow(nicheMatchRatio, 0.5); // Square root for diminishing returns

        // Calculate base weighted score
        const baseScore = (
            (normalizedSemanticScore * this.weights.semanticSimilarity) +
            (nicheMatchRatio * this.weights.nicheAlignment) +
            (audienceScore * this.weights.audienceMatch) +
            (valueScore * this.weights.valueAlignment)
        );

        // Apply niche boost - this gives significant weight to niche matches
        const totalScore = baseScore * (1 + nicheBoost);

        return {
            creator,
            matchScore: parseFloat(Math.min(1, totalScore).toFixed(4)), // Cap at 1.0
            scoreBreakdown: {
                semanticSimilarity: parseFloat(normalizedSemanticScore.toFixed(4)),
                nicheAlignment: nicheScore,
                audienceMatch: audienceScore,
                valueAlignment: valueScore,
                nicheBoost: parseFloat(nicheBoost.toFixed(4))
            }
        };
    }

    calculateNicheAlignment(assignment, creator) {
        if (!assignment.creatorNiches || assignment.creatorNiches.length === 0) return 0; // Return 0 if no niches requested

        const creatorNiches = [
            ...(creator.analysis.primaryNiches || []),
            ...(creator.analysis.secondaryNiches || [])
        ].map(n => n.toLowerCase());

        const matches = assignment.creatorNiches.filter(niche =>
            creatorNiches.includes(niche.toLowerCase())
        );

        return matches.length; // Return integer count
    }


    calculateAudienceMatch(assignment, creator) {
        if (!assignment.targetAudience) return 0; // No target audience specified

        let score = 0;
        let factors = 0;

        // Factor 1: Geographic/Locale Match (40% of audience score)
        if (assignment.targetAudience.locale && creator.region) {
            if (creator.region.toLowerCase() === assignment.targetAudience.locale.toLowerCase()) {
                score += 0.4;
            }
            factors++;
        }

        // Factor 2: Demographic Alignment (30% of audience score)
        // Check if demographic keywords appear in creator's audience interests or summary
        if (assignment.targetAudience.demographic && creator.analysis) {
            const demographic = assignment.targetAudience.demographic.toLowerCase();
            const audienceInterests = (creator.analysis.audienceInterests || [])
                .map(i => i.toLowerCase())
                .join(' ');
            const summary = (creator.analysis.summary || '').toLowerCase();

            // Check for keyword matches
            const demographicWords = demographic.split(/\s+/);
            const matchedWords = demographicWords.filter(word =>
                audienceInterests.includes(word) || summary.includes(word)
            );

            if (matchedWords.length > 0) {
                score += 0.3 * (matchedWords.length / demographicWords.length);
            }
            factors++;
        }

        // Factor 3: Tone/Style Match (30% of audience score)
        if (assignment.toneStyle && creator.analysis.engagementStyle) {
            const requestedTone = assignment.toneStyle.toLowerCase();
            const creatorTones = (creator.analysis.engagementStyle.tone || [])
                .map(t => t.toLowerCase());

            // Check for exact or partial tone match
            const toneMatch = creatorTones.some(tone =>
                tone.includes(requestedTone) || requestedTone.includes(tone)
            );

            if (toneMatch) {
                score += 0.3;
            }
            factors++;
        }

        // If no factors were evaluated, return 0
        return factors > 0 ? score : 0;
    }

    calculateValueAlignment(assignment, creator) {
        // If no values specified, return 0 (not applicable) instead of 0.5
        if (!assignment.creatorValues || assignment.creatorValues.length === 0) return 0;

        const creatorValues = (creator.analysis.apparentValues || []).map(v => v.toLowerCase());
        const matches = assignment.creatorValues.filter(val =>
            creatorValues.includes(val.toLowerCase())
        );

        return matches.length / assignment.creatorValues.length;
    }

    /**
     * Tie-breaker logic using engagement metrics and content style
     */
    breakTie(matchA, matchB) {
        const engagementA = (matchA.creator.heartCount || 0) / (matchA.creator.followerCount || 1);
        const engagementB = (matchB.creator.heartCount || 0) / (matchB.creator.followerCount || 1);

        if (engagementA !== engagementB) {
            return engagementB - engagementA;
        }

        // Secondary tie-breaker: follower count
        return (matchB.creator.followerCount || 0) - (matchA.creator.followerCount || 0);
    }

    rankMatches(matches) {
        return matches.sort((a, b) => {
            // First priority: Number of niche matches
            if (b.scoreBreakdown.nicheAlignment !== a.scoreBreakdown.nicheAlignment) {
                return b.scoreBreakdown.nicheAlignment - a.scoreBreakdown.nicheAlignment;
            }

            // Second priority: Semantic similarity (if niches are equal)
            if (Math.abs(b.scoreBreakdown.semanticSimilarity - a.scoreBreakdown.semanticSimilarity) > 0.01) {
                return b.scoreBreakdown.semanticSimilarity - a.scoreBreakdown.semanticSimilarity;
            }

            // Third priority: Total match score (if semantic scores are very close)
            if (Math.abs(b.matchScore - a.matchScore) > 0.001) {
                return b.matchScore - a.matchScore;
            }

            // Final tie-breaker: Engagement metrics
            return this.breakTie(a, b);
        });
    }
}

module.exports = new Matcher();

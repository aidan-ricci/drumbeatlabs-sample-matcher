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
        if (!assignment.targetAudience) return 0; // No target audience specified = 0 match

        // Strict binary matching: check if region matches
        if (assignment.targetAudience.locale &&
            creator.region &&
            creator.region.toLowerCase() === assignment.targetAudience.locale.toLowerCase()) {
            return 1;
        }

        return 0; // Strict binary mismatch
    }

    calculateValueAlignment(assignment, creator) {
        if (!assignment.creatorValues || assignment.creatorValues.length === 0) return 0.5;

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

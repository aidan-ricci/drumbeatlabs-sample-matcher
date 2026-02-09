export interface Assignment {
    topic: string;
    keyTakeaway: string;
    additionalContext: string;
    targetAudience?: {
        demographic?: string;
        locale?: string;
    };
    creatorValues?: string[];
    creatorNiches?: string[];
    toneStyle?: string;
}

export interface Creator {
    uniqueId: string;
    nickname: string;
    bio: string;
    followerCount: number;
    region: string;
    avatarUrl: string;
    analysis: {
        summary: string;
        primaryNiches: string[];
        secondaryNiches: string[];
        apparentValues: string[];
        engagementStyle: {
            tone: string[];
            contentStyle: string;
        };
    };
}

export interface CreatorMatch {
    creator: Creator;
    matchScore: number;
    reasoning?: string;
    scoreBreakdown: {
        semanticSimilarity: number;
        nicheAlignment: number;
        audienceMatch: number;
        valueAlignment: number;
    };
}

export interface MatchResponse {
    assignment: Assignment;
    matches: CreatorMatch[];
    reasoning: string;
    isFallback: boolean;
    timestamp: string;
}

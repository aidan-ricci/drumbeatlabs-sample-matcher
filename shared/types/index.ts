// Shared TypeScript interfaces and types

export interface Assignment {
  id: string;
  topic: string;
  keyTakeaway: string;
  additionalContext: string;
  targetAudience?: {
    demographic: string;
    locale: string;
  };
  creatorValues?: string[];
  creatorNiches?: string[];
  toneStyle?: string;
  createdAt: Date;
  userId?: string;
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
    audienceInterests: string[];
    engagementStyle: {
      tone: string[];
      contentStyle: string;
    };
  };
  embeddings?: {
    bio: number[];
    niches: number[];
    values: number[];
  };
}

export interface CreatorMatch {
  creator: Creator;
  matchScore: number;
  reasoning: string;
  framingSuggestion: string;
  scoreBreakdown: {
    semanticSimilarity: number;
    nicheAlignment: number;
    audienceMatch: number;
    valueAlignment: number;
    engagementFit: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  service: string;
  [key: string]: any;
}
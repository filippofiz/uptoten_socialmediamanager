export interface PostContent {
  caption: string;
  hashtags: string[];
  imagePath?: string;
  platforms?: string[];
  theme?: string;
  scheduledTime?: Date;
}

export interface PostResult {
  platform: string;
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  timestamp: Date;
}

export interface PlatformStats {
  totalPosts: number;
  successfulPosts: number;
  failedPosts: number;
  engagement: EngagementMetrics;
  lastPostTime: Date | null;
}

export interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

export interface SocialPlatformConfig {
  name: string;
  enabled: boolean;
  credentials: Record<string, string>;
  postingTimes: string[];
  hashtagLimit: number;
  characterLimit: number;
}
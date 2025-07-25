import { supabase } from '../lib/supabase';

export interface TrainingFeedback {
  postId: string;
  content: string;
  platforms: string[];
  performance: {
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    engagementRate: number;
  };
  userFeedback?: {
    rating: number; // 1-5
    issues?: string[];
    improvements?: string[];
  };
  aiDebateUsed: boolean;
  debateTranscript?: string[];
  generatedAt: Date;
}

export interface AIPreferences {
  userId?: string;
  industry: string;
  brandVoice: {
    tone: string[];
    vocabulary: string[];
    avoidWords: string[];
  };
  contentPreferences: {
    optimalLength: Record<string, number>; // per platform
    bestPerformingTopics: string[];
    preferredHashtags: string[];
    emojisUsage: 'high' | 'medium' | 'low' | 'none';
  };
  visualPreferences: {
    colorSchemes: string[];
    imageStyles: string[];
    logoPlacement: string;
  };
  performanceThresholds: {
    minEngagementRate: number;
    targetLikes: Record<string, number>; // per platform
    targetComments: Record<string, number>;
  };
  learningHistory: {
    totalPosts: number;
    averagePerformance: number;
    improvementRate: number;
    lastUpdated: Date;
  };
}

export class AITrainingService {
  private preferences: AIPreferences | null = null;

  async loadPreferences(userId?: string): Promise<AIPreferences> {
    try {
      const { data, error } = await supabase
        .from('ai_preferences')
        .select('*')
        .eq('user_id', userId || 'default')
        .single();

      if (error || !data) {
        // Create default preferences
        this.preferences = this.getDefaultPreferences();
        await this.savePreferences(this.preferences);
      } else {
        this.preferences = data;
      }

      return this.preferences;
    } catch (error) {
      console.error('Error loading preferences:', error);
      this.preferences = this.getDefaultPreferences();
      return this.preferences;
    }
  }

  private getDefaultPreferences(): AIPreferences {
    return {
      industry: 'general',
      brandVoice: {
        tone: ['professional', 'friendly'],
        vocabulary: [],
        avoidWords: []
      },
      contentPreferences: {
        optimalLength: {
          twitter: 280,
          facebook: 500,
          instagram: 300,
          linkedin: 600
        },
        bestPerformingTopics: [],
        preferredHashtags: [],
        emojisUsage: 'medium'
      },
      visualPreferences: {
        colorSchemes: ['blue', 'green', 'professional'],
        imageStyles: ['modern', 'minimalist'],
        logoPlacement: 'bottom-right'
      },
      performanceThresholds: {
        minEngagementRate: 2.5,
        targetLikes: {
          twitter: 50,
          facebook: 100,
          instagram: 150,
          linkedin: 30
        },
        targetComments: {
          twitter: 10,
          facebook: 20,
          instagram: 30,
          linkedin: 5
        }
      },
      learningHistory: {
        totalPosts: 0,
        averagePerformance: 0,
        improvementRate: 0,
        lastUpdated: new Date()
      }
    };
  }

  async recordFeedback(feedback: TrainingFeedback): Promise<void> {
    try {
      // Save feedback to database
      await supabase.from('ai_training_feedback').insert({
        post_id: feedback.postId,
        content: feedback.content,
        platforms: feedback.platforms,
        performance: feedback.performance,
        user_feedback: feedback.userFeedback,
        ai_debate_used: feedback.aiDebateUsed,
        debate_transcript: feedback.debateTranscript,
        generated_at: feedback.generatedAt
      });

      // Update preferences based on feedback
      await this.updatePreferencesFromFeedback(feedback);
    } catch (error) {
      console.error('Error recording feedback:', error);
    }
  }

  private async updatePreferencesFromFeedback(feedback: TrainingFeedback): Promise<void> {
    if (!this.preferences) {
      await this.loadPreferences();
    }

    const performance = feedback.performance;
    const engagementRate = performance.engagementRate;

    // Update learning history
    this.preferences!.learningHistory.totalPosts++;
    const oldAvg = this.preferences!.learningHistory.averagePerformance;
    const newAvg = (oldAvg * (this.preferences!.learningHistory.totalPosts - 1) + engagementRate) / 
                   this.preferences!.learningHistory.totalPosts;
    
    this.preferences!.learningHistory.averagePerformance = newAvg;
    this.preferences!.learningHistory.improvementRate = 
      ((newAvg - oldAvg) / oldAvg) * 100;
    this.preferences!.learningHistory.lastUpdated = new Date();

    // Update content preferences based on performance
    if (engagementRate > this.preferences!.performanceThresholds.minEngagementRate) {
      // This was a successful post, learn from it
      
      // Extract hashtags and add to preferred if they performed well
      const hashtags = this.extractHashtags(feedback.content);
      hashtags.forEach(tag => {
        if (!this.preferences!.contentPreferences.preferredHashtags.includes(tag)) {
          this.preferences!.contentPreferences.preferredHashtags.push(tag);
        }
      });

      // Update optimal length for platforms
      feedback.platforms.forEach(platform => {
        const currentLength = feedback.content.length;
        const currentOptimal = this.preferences!.contentPreferences.optimalLength[platform] || currentLength;
        // Weighted average favoring high-performing content
        this.preferences!.contentPreferences.optimalLength[platform] = 
          Math.round((currentOptimal + currentLength * 2) / 3);
      });
    }

    // Learn from user feedback if provided
    if (feedback.userFeedback) {
      if (feedback.userFeedback.rating >= 4) {
        // Positive feedback - reinforce current approach
        // Extract tone indicators and add to preferred
      } else if (feedback.userFeedback.rating <= 2) {
        // Negative feedback - adjust approach
        if (feedback.userFeedback.issues) {
          // Add words/phrases to avoid list
          feedback.userFeedback.issues.forEach(issue => {
            if (issue.includes('tone') || issue.includes('voice')) {
              // Adjust tone preferences
            }
          });
        }
      }
    }

    await this.savePreferences(this.preferences!);
  }

  private extractHashtags(content: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    return content.match(hashtagRegex) || [];
  }

  async savePreferences(preferences: AIPreferences): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_preferences')
        .upsert({
          user_id: preferences.userId || 'default',
          ...preferences,
          updated_at: new Date()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }

  async getPerformanceInsights(): Promise<{
    topPerformingContent: any[];
    worstPerformingContent: any[];
    trends: any;
    recommendations: string[];
  }> {
    try {
      // Get all feedback data
      const { data: feedbackData } = await supabase
        .from('ai_training_feedback')
        .select('*')
        .order('performance->engagementRate', { ascending: false });

      if (!feedbackData || feedbackData.length === 0) {
        return {
          topPerformingContent: [],
          worstPerformingContent: [],
          trends: {},
          recommendations: ['Need more data to provide insights']
        };
      }

      // Analyze top and worst performing
      const topPerforming = feedbackData.slice(0, 5);
      const worstPerforming = feedbackData.slice(-5).reverse();

      // Identify trends
      const trends = this.analyzeTrends(feedbackData);

      // Generate recommendations
      const recommendations = this.generateRecommendations(feedbackData, trends);

      return {
        topPerformingContent: topPerforming,
        worstPerformingContent: worstPerforming,
        trends,
        recommendations
      };
    } catch (error) {
      console.error('Error getting insights:', error);
      return {
        topPerformingContent: [],
        worstPerformingContent: [],
        trends: {},
        recommendations: []
      };
    }
  }

  private analyzeTrends(feedbackData: any[]): any {
    const trends = {
      engagementByPlatform: {} as Record<string, number>,
      engagementByTimeOfDay: {} as Record<number, number>,
      contentLengthPerformance: {} as Record<string, number>,
      hashtagPerformance: {} as Record<string, number>,
      debateVsNonDebate: {
        withDebate: { count: 0, avgEngagement: 0 },
        withoutDebate: { count: 0, avgEngagement: 0 }
      }
    };

    feedbackData.forEach(feedback => {
      // Platform analysis
      feedback.platforms.forEach((platform: string) => {
        if (!trends.engagementByPlatform[platform]) {
          trends.engagementByPlatform[platform] = 0;
        }
        trends.engagementByPlatform[platform] += feedback.performance.engagementRate;
      });

      // Time analysis
      const hour = new Date(feedback.generated_at).getHours();
      if (!trends.engagementByTimeOfDay[hour]) {
        trends.engagementByTimeOfDay[hour] = 0;
      }
      trends.engagementByTimeOfDay[hour] += feedback.performance.engagementRate;

      // Debate analysis
      if (feedback.ai_debate_used) {
        trends.debateVsNonDebate.withDebate.count++;
        trends.debateVsNonDebate.withDebate.avgEngagement += feedback.performance.engagementRate;
      } else {
        trends.debateVsNonDebate.withoutDebate.count++;
        trends.debateVsNonDebate.withoutDebate.avgEngagement += feedback.performance.engagementRate;
      }
    });

    // Calculate averages
    if (trends.debateVsNonDebate.withDebate.count > 0) {
      trends.debateVsNonDebate.withDebate.avgEngagement /= trends.debateVsNonDebate.withDebate.count;
    }
    if (trends.debateVsNonDebate.withoutDebate.count > 0) {
      trends.debateVsNonDebate.withoutDebate.avgEngagement /= trends.debateVsNonDebate.withoutDebate.count;
    }

    return trends;
  }

  private generateRecommendations(feedbackData: any[], trends: any): string[] {
    const recommendations: string[] = [];

    // Platform recommendations
    const bestPlatform = Object.entries(trends.engagementByPlatform)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0];
    if (bestPlatform) {
      recommendations.push(`Focus more on ${bestPlatform[0]} - it shows the highest engagement`);
    }

    // Time recommendations
    const bestTimes = Object.entries(trends.engagementByTimeOfDay)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([hour]) => hour);
    if (bestTimes.length > 0) {
      recommendations.push(`Best posting times: ${bestTimes.join(', ')}:00`);
    }

    // Debate recommendations
    if (trends.debateVsNonDebate.withDebate.avgEngagement > trends.debateVsNonDebate.withoutDebate.avgEngagement * 1.2) {
      recommendations.push('AI debates significantly improve engagement - use them more often');
    }

    // Content length recommendations
    if (this.preferences) {
      Object.entries(this.preferences.contentPreferences.optimalLength).forEach(([platform, length]) => {
        recommendations.push(`Optimal ${platform} post length: ~${length} characters`);
      });
    }

    return recommendations;
  }

  async getDebateHistory(limit: number = 10): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('ai_training_feedback')
        .select('*')
        .eq('ai_debate_used', true)
        .order('generated_at', { ascending: false })
        .limit(limit);

      return data || [];
    } catch (error) {
      console.error('Error getting debate history:', error);
      return [];
    }
  }

  async trainFromHistoricalData(): Promise<{
    trained: boolean;
    insights: string[];
  }> {
    try {
      const { data: historicalPosts } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'published')
        .order('published_time', { ascending: false })
        .limit(100);

      if (!historicalPosts || historicalPosts.length < 10) {
        return {
          trained: false,
          insights: ['Not enough historical data for training']
        };
      }

      const insights: string[] = [];
      
      // Analyze historical performance
      const platformPerformance: Record<string, { total: number; engagement: number }> = {};
      const contentPatterns: Record<string, number> = {};
      
      historicalPosts.forEach(post => {
        // Platform analysis
        post.platforms?.forEach((platform: string) => {
          if (!platformPerformance[platform]) {
            platformPerformance[platform] = { total: 0, engagement: 0 };
          }
          platformPerformance[platform].total++;
          
          if (post.metadata?.engagement) {
            platformPerformance[platform].engagement += 
              (post.metadata.engagement.likes || 0) + 
              (post.metadata.engagement.comments || 0);
          }
        });

        // Content pattern analysis
        if (post.content) {
          // Check for emojis
          const emojiCount = (post.content.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
          contentPatterns[`emoji_${emojiCount > 5 ? 'high' : emojiCount > 0 ? 'medium' : 'none'}`] = 
            (contentPatterns[`emoji_${emojiCount > 5 ? 'high' : emojiCount > 0 ? 'medium' : 'none'}`] || 0) + 1;
          
          // Check for questions
          if (post.content.includes('?')) {
            contentPatterns['has_question'] = (contentPatterns['has_question'] || 0) + 1;
          }
          
          // Check for calls to action
          const ctaKeywords = ['click', 'visit', 'check out', 'learn more', 'discover'];
          if (ctaKeywords.some(keyword => post.content.toLowerCase().includes(keyword))) {
            contentPatterns['has_cta'] = (contentPatterns['has_cta'] || 0) + 1;
          }
        }
      });

      // Generate insights from analysis
      Object.entries(platformPerformance).forEach(([platform, data]) => {
        const avgEngagement = data.engagement / data.total;
        insights.push(`${platform}: Average engagement ${avgEngagement.toFixed(1)} per post`);
      });

      Object.entries(contentPatterns).forEach(([pattern, count]) => {
        const percentage = (count / historicalPosts.length) * 100;
        insights.push(`${pattern}: ${percentage.toFixed(1)}% of posts`);
      });

      // Update preferences based on insights
      if (this.preferences) {
        // Update emoji usage preference based on historical data
        const emojiUsage = contentPatterns['emoji_high'] > contentPatterns['emoji_none'] 
          ? 'high' 
          : contentPatterns['emoji_medium'] > contentPatterns['emoji_none'] 
          ? 'medium' 
          : 'low';
        
        this.preferences.contentPreferences.emojisUsage = emojiUsage as any;
        await this.savePreferences(this.preferences);
      }

      return {
        trained: true,
        insights
      };
    } catch (error) {
      console.error('Error training from historical data:', error);
      return {
        trained: false,
        insights: ['Error during training']
      };
    }
  }
}
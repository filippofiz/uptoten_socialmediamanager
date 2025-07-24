import axios from 'axios';
import { ContentGenerator } from './ContentGenerator';
import { ImageComposer } from './ImageComposer';

interface BufferProfile {
  id: string;
  service: string;
  service_username: string;
  formatted_service: string;
}

interface BufferUpdate {
  text: string;
  profile_ids: string[];
  media?: {
    link?: string;
    photo?: string;
    thumbnail?: string;
  };
  scheduled_at?: string;
  shorten?: boolean;
  now?: boolean;
}

export class BufferIntegration {
  private accessToken: string;
  private apiUrl = 'https://api.bufferapp.com/1';
  private profiles: BufferProfile[] = [];
  private contentGenerator: ContentGenerator;
  private imageComposer: ImageComposer;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.contentGenerator = new ContentGenerator();
    this.imageComposer = new ImageComposer();
    this.loadProfiles();
  }

  async loadProfiles() {
    try {
      const response = await axios.get(`${this.apiUrl}/profiles.json`, {
        params: { access_token: this.accessToken }
      });
      this.profiles = response.data;
      console.log('Buffer profiles loaded:', this.profiles.map(p => `${p.formatted_service}: ${p.service_username}`));
    } catch (error) {
      console.error('Error loading Buffer profiles:', error);
    }
  }

  async createPost(
    content: string,
    platforms: string[] = ['facebook', 'twitter', 'linkedin', 'instagram'],
    imageUrl?: string,
    scheduledTime?: Date
  ) {
    const profileIds = this.getProfileIds(platforms);
    
    if (profileIds.length === 0) {
      throw new Error('No Buffer profiles found for selected platforms');
    }

    const update: BufferUpdate = {
      text: content,
      profile_ids: profileIds,
      shorten: true
    };

    // Add image if provided
    if (imageUrl) {
      update.media = {
        photo: imageUrl,
        thumbnail: imageUrl
      };
    }

    // Schedule for later or post now
    if (scheduledTime) {
      update.scheduled_at = Math.floor(scheduledTime.getTime() / 1000).toString();
    } else {
      update.now = true;
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/updates/create.json`,
        null,
        {
          params: {
            access_token: this.accessToken,
            ...update
          }
        }
      );

      return {
        success: true,
        buffer_id: response.data.updates[0].id,
        message: 'Post created successfully in Buffer',
        scheduled_at: response.data.updates[0].scheduled_at,
        profiles: response.data.updates[0].profile_service
      };
    } catch (error: any) {
      console.error('Buffer API Error:', error.response?.data || error.message);
      throw new Error(`Buffer API Error: ${error.response?.data?.error || error.message}`);
    }
  }

  async createAIGeneratedPost(
    theme: string,
    platforms: string[] = ['facebook', 'twitter', 'linkedin'],
    scheduledTime?: Date
  ) {
    // Generate content with AI
    const generatedContent = await this.contentGenerator.generateContent(theme as any);
    
    // Generate image
    const imageUrl = await this.contentGenerator.generateImage(generatedContent.imagePrompt);
    
    // Format content for Buffer
    const formattedContent = this.formatContentForPlatforms(generatedContent);
    
    // Create post via Buffer
    return await this.createPost(
      formattedContent,
      platforms,
      imageUrl,
      scheduledTime
    );
  }

  private formatContentForPlatforms(content: any): string {
    // Buffer automatically adapts content for each platform
    // But we can optimize it
    const caption = content.caption;
    const hashtags = content.hashtags.join(' ');
    
    return `${caption}\n\n${hashtags}`;
  }

  private getProfileIds(platforms: string[]): string[] {
    const profileIds: string[] = [];
    
    platforms.forEach(platform => {
      const profile = this.profiles.find(p => {
        const service = p.service.toLowerCase();
        if (platform === 'facebook' && service === 'facebook') return true;
        if (platform === 'twitter' && service === 'twitter') return true;
        if (platform === 'linkedin' && service === 'linkedin') return true;
        if (platform === 'instagram' && service === 'instagram') return true;
        return false;
      });
      
      if (profile) {
        profileIds.push(profile.id);
      }
    });
    
    return profileIds;
  }

  async getScheduledPosts() {
    try {
      const profileIds = this.profiles.map(p => p.id);
      const response = await axios.get(`${this.apiUrl}/profiles/${profileIds.join(',')}/updates/pending.json`, {
        params: { access_token: this.accessToken }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
      return [];
    }
  }

  async getAnalytics(days: number = 7) {
    try {
      const profileIds = this.profiles.map(p => p.id);
      const response = await axios.get(`${this.apiUrl}/profiles/${profileIds.join(',')}/updates/sent.json`, {
        params: { 
          access_token: this.accessToken,
          count: days * 10 // Approximate posts per day
        }
      });
      
      // Process analytics
      const analytics = {
        total_posts: response.data.total,
        by_platform: {},
        engagement: {
          total_reach: 0,
          total_clicks: 0,
          total_likes: 0,
          total_shares: 0
        }
      };
      
      response.data.updates.forEach((update: any) => {
        const platform = update.profile_service;
        if (!analytics.by_platform[platform]) {
          analytics.by_platform[platform] = {
            posts: 0,
            reach: 0,
            engagement: 0
          };
        }
        analytics.by_platform[platform].posts++;
        
        // Aggregate stats if available
        if (update.statistics) {
          analytics.engagement.total_reach += update.statistics.reach || 0;
          analytics.engagement.total_clicks += update.statistics.clicks || 0;
          analytics.engagement.total_likes += update.statistics.likes || 0;
          analytics.engagement.total_shares += update.statistics.shares || 0;
        }
      });
      
      return analytics;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return null;
    }
  }

  async deleteScheduledPost(updateId: string) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/updates/${updateId}/destroy.json`,
        null,
        {
          params: { access_token: this.accessToken }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  // Helper method to validate Buffer token
  async validateToken(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/user.json`, {
        params: { access_token: this.accessToken }
      });
      return response.data.id !== undefined;
    } catch (error) {
      return false;
    }
  }
}
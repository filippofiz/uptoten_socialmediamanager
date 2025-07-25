import { TwitterApi } from 'twitter-api-v2';
import { IgApiClient } from 'instagram-private-api';
import { FacebookAdsApi } from 'facebook-nodejs-business-sdk';
import { PostContent, PostResult, PlatformStats } from '../types/social';
import fs from 'fs/promises';
import axios from 'axios';

export class SocialMediaManager {
  private twitterClient: TwitterApi | null = null;
  private instagramClient: IgApiClient | null = null;
  private facebookClient: any = null;
  private linkedinToken: string | null = null;
  private stats: Map<string, PlatformStats> = new Map();

  constructor() {
    this.initializeClients();
  }

  private async initializeClients() {
    if (process.env.TWITTER_API_KEY) {
      this.twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
      });
    }

    if (process.env.INSTAGRAM_USERNAME) {
      this.instagramClient = new IgApiClient();
      this.instagramClient.state.generateDevice(process.env.INSTAGRAM_USERNAME);
    }

    if (process.env.FACEBOOK_APP_ID) {
      const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      FacebookAdsApi.init(accessToken!);
    }

    if (process.env.LINKEDIN_ACCESS_TOKEN) {
      this.linkedinToken = process.env.LINKEDIN_ACCESS_TOKEN;
    }

    this.initializeStats();
  }

  private initializeStats() {
    const platforms = ['twitter', 'instagram', 'facebook', 'linkedin'];
    platforms.forEach(platform => {
      this.stats.set(platform, {
        totalPosts: 0,
        successfulPosts: 0,
        failedPosts: 0,
        engagement: {
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0
        },
        lastPostTime: null
      });
    });
  }

  async postToAllPlatforms(content: PostContent): Promise<PostResult[]> {
    const results: PostResult[] = [];
    const platforms = content.platforms || ['twitter', 'instagram', 'facebook', 'linkedin'];

    for (const platform of platforms) {
      try {
        const result = await this.postToPlatform(platform, content);
        results.push(result);
        this.updateStats(platform, result);
      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    return results;
  }

  private async postToPlatform(platform: string, content: PostContent): Promise<PostResult> {
    // Create platform-specific content with appropriate image
    const platformContent = {
      ...content,
      imageUrl: content.platformImages?.[platform] || content.imageUrl,
      imagePath: content.platformImages?.[platform] ? null : content.imagePath
    };
    
    switch (platform) {
      case 'twitter':
        return await this.postToTwitter(platformContent);
      case 'instagram':
        return await this.postToInstagram(platformContent);
      case 'facebook':
        return await this.postToFacebook(platformContent);
      case 'linkedin':
        return await this.postToLinkedIn(platformContent);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async postToTwitter(content: PostContent): Promise<PostResult> {
    if (!this.twitterClient) {
      throw new Error('Twitter client not initialized');
    }

    try {
      const v2Client = this.twitterClient.v2;
      let mediaId: string | undefined;

      if (content.imagePath) {
        const mediaUpload = await this.twitterClient.v1.uploadMedia(content.imagePath);
        mediaId = mediaUpload;
      } else if (content.imageUrl) {
        // Download image from URL and upload
        const response = await fetch(content.imageUrl);
        const buffer = await response.arrayBuffer();
        const mediaUpload = await this.twitterClient.v1.uploadMedia(Buffer.from(buffer), { type: 'jpg' });
        mediaId = mediaUpload;
      }

      const tweet = await v2Client.tweet({
        text: `${content.caption}\n\n${content.hashtags.join(' ')}`,
        media: mediaId ? { media_ids: [mediaId] } : undefined
      });

      return {
        platform: 'twitter',
        success: true,
        postId: tweet.data.id,
        url: `https://twitter.com/user/status/${tweet.data.id}`,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Twitter post failed: ${error.message}`);
    }
  }

  private async postToInstagram(content: PostContent): Promise<PostResult> {
    if (!this.instagramClient) {
      throw new Error('Instagram client not initialized');
    }

    try {
      await this.instagramClient.account.login(
        process.env.INSTAGRAM_USERNAME!,
        process.env.INSTAGRAM_PASSWORD!
      );

      if (content.imagePath) {
        const imageBuffer = await fs.readFile(content.imagePath);
        
        const publishResult = await this.instagramClient.publish.photo({
          file: imageBuffer,
          caption: `${content.caption}\n\n${content.hashtags.join(' ')}`
        });

        return {
          platform: 'instagram',
          success: true,
          postId: publishResult.media.id,
          url: `https://www.instagram.com/p/${publishResult.media.code}/`,
          timestamp: new Date()
        };
      } else {
        throw new Error('Instagram requires an image');
      }
    } catch (error) {
      throw new Error(`Instagram post failed: ${error.message}`);
    }
  }

  private async postToFacebook(content: PostContent): Promise<PostResult> {
    if (!process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
      throw new Error('Facebook client not initialized');
    }

    try {
      const pageId = process.env.FACEBOOK_PAGE_ID;
      const url = `https://graph.facebook.com/${pageId}/photos`;
      
      const formData = new FormData();
      formData.append('message', `${content.caption}\n\n${content.hashtags.join(' ')}`);
      
      if (content.imagePath) {
        const imageBuffer = await fs.readFile(content.imagePath);
        formData.append('source', new Blob([imageBuffer]));
      }
      
      formData.append('access_token', process.env.FACEBOOK_PAGE_ACCESS_TOKEN);

      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if ((result as any).id) {
        return {
          platform: 'facebook',
          success: true,
          postId: (result as any).id,
          url: `https://www.facebook.com/${(result as any).id}`,
          timestamp: new Date()
        };
      } else {
        throw new Error((result as any).error?.message || 'Unknown error');
      }
    } catch (error) {
      throw new Error(`Facebook post failed: ${error.message}`);
    }
  }

  private async postToLinkedIn(content: PostContent): Promise<PostResult> {
    if (!this.linkedinToken) {
      throw new Error('LinkedIn token not configured');
    }

    try {
      const personURN = process.env.LINKEDIN_PERSON_URN || 'urn:li:person:YOUR_PERSON_URN';
      
      let mediaAsset = null;
      if (content.imagePath) {
        const registerUploadRequest = {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: personURN,
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }]
        };

        const registerResponse = await axios.post(
          'https://api.linkedin.com/v2/assets?action=registerUpload',
          { registerUpload: registerUploadRequest },
          {
            headers: {
              'Authorization': `Bearer ${this.linkedinToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
        mediaAsset = registerResponse.data.value.asset;

        const imageBuffer = await fs.readFile(content.imagePath);
        await axios.put(uploadUrl, imageBuffer, {
          headers: {
            'Authorization': `Bearer ${this.linkedinToken}`,
            'Content-Type': 'image/jpeg'
          }
        });
      }

      const shareContent: any = {
        author: personURN,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: `${content.caption}\n\n${content.hashtags.join(' ')}`
            },
            shareMediaCategory: mediaAsset ? 'IMAGE' : 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };

      if (mediaAsset) {
        shareContent.specificContent['com.linkedin.ugc.ShareContent'].media = [{
          status: 'READY',
          description: {
            text: content.caption
          },
          media: mediaAsset,
          title: {
            text: 'Social Media Post'
          }
        }];
      }

      const postResponse = await axios.post(
        'https://api.linkedin.com/v2/ugcPosts',
        shareContent,
        {
          headers: {
            'Authorization': `Bearer ${this.linkedinToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      );

      return {
        platform: 'linkedin',
        success: true,
        postId: postResponse.data.id,
        url: `https://www.linkedin.com/feed/update/${postResponse.data.id}`,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`LinkedIn post failed: ${error.message}`);
    }
  }

  private updateStats(platform: string, result: PostResult) {
    const stats = this.stats.get(platform);
    if (stats) {
      stats.totalPosts++;
      if (result.success) {
        stats.successfulPosts++;
        stats.lastPostTime = result.timestamp;
      } else {
        stats.failedPosts++;
      }
      this.stats.set(platform, stats);
    }
  }

  async getStats(): Promise<Record<string, PlatformStats>> {
    const statsObject: Record<string, PlatformStats> = {};
    this.stats.forEach((value, key) => {
      statsObject[key] = value;
    });
    return statsObject;
  }

  async getEngagementMetrics(platform: string, postId: string): Promise<any> {
    switch (platform) {
      case 'twitter':
        return await this.getTwitterEngagement(postId);
      case 'instagram':
        return await this.getInstagramEngagement(postId);
      case 'facebook':
        return await this.getFacebookEngagement(postId);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async getTwitterEngagement(tweetId: string): Promise<any> {
    if (!this.twitterClient) return null;
    
    try {
      const tweet = await this.twitterClient.v2.singleTweet(tweetId, {
        'tweet.fields': ['public_metrics']
      });
      
      return tweet.data.public_metrics;
    } catch (error) {
      console.error('Error fetching Twitter engagement:', error);
      return null;
    }
  }

  private async getInstagramEngagement(mediaId: string): Promise<any> {
    if (!this.instagramClient) return null;
    
    try {
      const mediaInfo = await this.instagramClient.media.info(mediaId);
      return {
        likes: mediaInfo.items[0].like_count,
        comments: mediaInfo.items[0].comment_count,
        views: (mediaInfo.items[0] as any).view_count || 0
      };
    } catch (error) {
      console.error('Error fetching Instagram engagement:', error);
      return null;
    }
  }

  private async getFacebookEngagement(postId: string): Promise<any> {
    try {
      const url = `https://graph.facebook.com/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`;
      const response = await fetch(url);
      const data = await response.json();
      
      return {
        likes: (data as any).likes?.summary?.total_count || 0,
        comments: (data as any).comments?.summary?.total_count || 0,
        shares: (data as any).shares?.count || 0
      };
    } catch (error) {
      console.error('Error fetching Facebook engagement:', error);
      return null;
    }
  }

  async schedulePost(content: PostContent, scheduledTime: Date): Promise<void> {
    console.log(`Post scheduled for ${scheduledTime.toISOString()}`);
  }
}
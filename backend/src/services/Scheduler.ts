import cron from 'node-cron';
import { ContentGenerator } from './ContentGenerator';
import { ImageComposer } from './ImageComposer';
import { SocialMediaManager } from './SocialMediaManager';
import { ContentTheme, PostContent } from '../types';
import fs from 'fs/promises';
import path from 'path';

export class Scheduler {
  private contentGenerator: ContentGenerator;
  private imageComposer: ImageComposer;
  private socialMediaManager: SocialMediaManager;
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private postHistory: any[] = [];
  private isRunning: boolean = false;

  constructor(
    contentGenerator: ContentGenerator,
    imageComposer: ImageComposer,
    socialMediaManager: SocialMediaManager
  ) {
    this.contentGenerator = contentGenerator;
    this.imageComposer = imageComposer;
    this.socialMediaManager = socialMediaManager;
    this.loadPostHistory();
  }

  start() {
    console.log('⚠️ SCHEDULER DISABLED - No automatic posting');
    return; // TUTTO DISABILITATO
  }

  stop() {
    console.log('Stopping scheduler...');
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();
    this.isRunning = false;
  }

  async createAndPublishPost(theme?: ContentTheme, platforms?: string[]): Promise<any> {
    try {
      console.log('Creating new post...');
      
      const content = await this.contentGenerator.generateContent(theme);
      console.log('Content generated:', content.caption);

      const imageUrl = await this.contentGenerator.generateImage(content.imagePrompt);
      console.log('Image generated');

      const images = await this.createImageVariations(imageUrl);
      
      const postContent: PostContent = {
        caption: content.caption,
        hashtags: content.hashtags,
        imagePath: images.main,
        platforms: platforms || ['twitter', 'instagram', 'facebook'],
        theme: content.theme
      };

      const results = await this.socialMediaManager.postToAllPlatforms(postContent);
      
      await this.savePostToHistory({
        content,
        images,
        results,
        timestamp: new Date()
      });

      console.log('Post published successfully:', results);
      return { content, results };
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  async createTrendingPost() {
    try {
      console.log('Analyzing trends...');
      const trends = await this.contentGenerator.analyzeTrends();
      
      if (trends.length > 0) {
        const trend = trends[0];
        await this.createAndPublishPost(trend as ContentTheme);
      }
    } catch (error) {
      console.error('Error creating trending post:', error);
    }
  }

  async createImageVariations(imageUrl: string): Promise<any> {
    const timestamp = Date.now();
    const baseDir = path.join(process.cwd(), 'public', 'posts', timestamp.toString());
    await fs.mkdir(baseDir, { recursive: true });

    const variations: any = {};

    variations.main = await this.downloadAndSave(imageUrl, path.join(baseDir, 'original.png'));

    const branded = await this.imageComposer.addBranding(variations.main);
    variations.branded = branded;

    variations.instagram = await this.imageComposer.optimizeForPlatform(branded, 'instagram');
    variations.twitter = await this.imageComposer.optimizeForPlatform(branded, 'twitter');
    variations.facebook = await this.imageComposer.optimizeForPlatform(branded, 'facebook');
    variations.story = await this.imageComposer.optimizeForPlatform(variations.main, 'story');

    const collageImages = [imageUrl];
    for (let i = 0; i < 3; i++) {
      const additionalPrompt = await this.contentGenerator.generateImagePrompt('variation', 'similar style');
      const additionalImage = await this.contentGenerator.generateImage(additionalPrompt);
      collageImages.push(additionalImage);
    }
    
    const collage = await this.imageComposer.composeImages(collageImages, 'grid-2x2');
    variations.collage = collage.path;

    return variations;
  }

  private async downloadAndSave(url: string, filepath: string): Promise<string> {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filepath, buffer);
    return filepath;
  }

  async checkEngagement() {
    try {
      const recentPosts = this.postHistory.slice(-10);
      
      for (const post of recentPosts) {
        if (post.results) {
          for (const result of post.results) {
            if (result.success && result.postId) {
              const engagement = await this.socialMediaManager.getEngagementMetrics(
                result.platform,
                result.postId
              );
              
              console.log(`Engagement for ${result.platform} post ${result.postId}:`, engagement);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking engagement:', error);
    }
  }

  async generateDailyReport() {
    try {
      const stats = await this.socialMediaManager.getStats();
      const report = {
        date: new Date().toISOString(),
        stats,
        postsToday: this.getPostsFromToday(),
        performance: this.calculatePerformance()
      };

      const reportPath = path.join(
        process.cwd(),
        'reports',
        `daily_${new Date().toISOString().split('T')[0]}.json`
      );
      
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      console.log('Daily report generated:', reportPath);
    } catch (error) {
      console.error('Error generating report:', error);
    }
  }

  private getPostsFromToday(): any[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.postHistory.filter(post => {
      const postDate = new Date(post.timestamp);
      return postDate >= today;
    });
  }

  private calculatePerformance(): any {
    const recentPosts = this.postHistory.slice(-20);
    let totalSuccess = 0;
    let totalFailed = 0;
    
    recentPosts.forEach(post => {
      if (post.results) {
        post.results.forEach((result: any) => {
          if (result.success) totalSuccess++;
          else totalFailed++;
        });
      }
    });
    
    return {
      successRate: totalSuccess / (totalSuccess + totalFailed) || 0,
      totalPosts: recentPosts.length,
      successful: totalSuccess,
      failed: totalFailed
    };
  }

  private async loadPostHistory() {
    try {
      const historyPath = path.join(process.cwd(), 'data', 'post_history.json');
      const data = await fs.readFile(historyPath, 'utf-8');
      this.postHistory = JSON.parse(data);
    } catch (error) {
      this.postHistory = [];
    }
  }

  private async savePostToHistory(post: any) {
    this.postHistory.push(post);
    
    if (this.postHistory.length > 1000) {
      this.postHistory = this.postHistory.slice(-500);
    }
    
    try {
      const historyPath = path.join(process.cwd(), 'data', 'post_history.json');
      await fs.mkdir(path.dirname(historyPath), { recursive: true });
      await fs.writeFile(historyPath, JSON.stringify(this.postHistory, null, 2));
    } catch (error) {
      console.error('Error saving post history:', error);
    }
  }

  async scheduleCustomPost(postData: any, scheduledTime: Date) {
    const delay = scheduledTime.getTime() - Date.now();
    
    if (delay < 0) {
      throw new Error('Scheduled time must be in the future');
    }
    
    setTimeout(async () => {
      await this.createAndPublishPost(postData.theme, postData.platforms);
    }, delay);
    
    console.log(`Post scheduled for ${scheduledTime.toISOString()}`);
  }
}
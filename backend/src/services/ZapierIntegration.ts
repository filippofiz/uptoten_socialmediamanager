import axios from 'axios';
import { ContentGenerator } from './ContentGenerator';
import { ImageComposer } from './ImageComposer';
import { GeneratedContent } from '../types/content';

interface ZapierPayload {
  message: string;
  platforms: string[];
  imageUrl?: string;
  hashtags: string[];
  scheduledTime?: string;
  metadata: {
    theme: string;
    generatedBy: string;
    timestamp: string;
    brand: string;
  };
}

export class ZapierIntegration {
  private webhookUrl: string;
  private contentGenerator: ContentGenerator;
  private imageComposer: ImageComposer;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.ZAPIER_WEBHOOK_URL || '';
    this.contentGenerator = new ContentGenerator();
    this.imageComposer = new ImageComposer();
  }

  async sendToZapier(payload: ZapierPayload): Promise<any> {
    if (!this.webhookUrl) {
      throw new Error('Zapier webhook URL not configured');
    }

    try {
      console.log('📤 Sending to Zapier:', {
        platforms: payload.platforms,
        messageLength: payload.message.length,
        hasImage: !!payload.imageUrl
      });

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log('✅ Zapier response:', response.data);
      return {
        success: true,
        status: response.data.status || 'success',
        id: response.data.id || Date.now(),
        message: 'Successfully sent to Zapier for distribution'
      };

    } catch (error: any) {
      console.error('❌ Zapier error:', error.message);
      throw new Error(`Failed to send to Zapier: ${error.message}`);
    }
  }

  async publishGeneratedContent(
    theme: string,
    platforms: string[] = ['facebook', 'instagram', 'twitter', 'linkedin'],
    scheduledTime?: Date
  ): Promise<any> {
    try {
      // 1. Generate content with AI
      console.log('🤖 Generating content for theme:', theme);
      const content = await this.contentGenerator.generateContent(theme as any);

      // 2. Generate image
      console.log('🎨 Generating image...');
      const imageUrl = await this.contentGenerator.generateImage(content.imagePrompt);

      // 3. Optimize image for platforms
      console.log('📐 Optimizing images for platforms...');
      const optimizedImages = await this.createPlatformImages(imageUrl);

      // 4. Prepare Zapier payload
      const payload: ZapierPayload = {
        message: content.caption,
        platforms: platforms,
        imageUrl: imageUrl, // Main image URL
        hashtags: content.hashtags,
        scheduledTime: scheduledTime?.toISOString(),
        metadata: {
          theme: content.theme,
          generatedBy: 'Up to Ten AI System',
          timestamp: new Date().toISOString(),
          brand: 'Up to Ten - Ripetizioni Milano'
        }
      };

      // 5. Send to Zapier
      const result = await this.sendToZapier(payload);

      // 6. Return complete result
      return {
        ...result,
        content: content,
        imageUrl: imageUrl,
        optimizedImages: optimizedImages,
        zapierPayload: payload
      };

    } catch (error: any) {
      console.error('Error in publishGeneratedContent:', error);
      throw error;
    }
  }

  async publishCustomContent(
    message: string,
    platforms: string[] = ['facebook', 'instagram', 'twitter', 'linkedin'],
    imageUrl?: string,
    scheduledTime?: Date
  ): Promise<any> {
    const payload: ZapierPayload = {
      message: message,
      platforms: platforms,
      imageUrl: imageUrl,
      hashtags: this.extractHashtags(message),
      scheduledTime: scheduledTime?.toISOString(),
      metadata: {
        theme: 'custom',
        generatedBy: 'Manual Input',
        timestamp: new Date().toISOString(),
        brand: 'Up to Ten - Ripetizioni Milano'
      }
    };

    return await this.sendToZapier(payload);
  }

  async testConnection(): Promise<boolean> {
    try {
      const testPayload: ZapierPayload = {
        message: '🧪 Test connessione Zapier - Up to Ten',
        platforms: ['test'],
        hashtags: ['#test'],
        metadata: {
          theme: 'test',
          generatedBy: 'Connection Test',
          timestamp: new Date().toISOString(),
          brand: 'Up to Ten'
        }
      };

      const result = await this.sendToZapier(testPayload);
      return result.success === true;
    } catch (error) {
      return false;
    }
  }

  private async createPlatformImages(imageUrl: string): Promise<Record<string, string>> {
    // In a real implementation, this would download the image,
    // optimize it for each platform, and return URLs
    // For now, we'll return the same URL for all platforms
    return {
      facebook: imageUrl,
      instagram: imageUrl,
      twitter: imageUrl,
      linkedin: imageUrl,
      story: imageUrl
    };
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#\w+/g;
    const matches = text.match(hashtagRegex);
    return matches || [];
  }

  // Utility method to format content for different platforms
  formatForPlatform(content: GeneratedContent, platform: string): string {
    const baseContent = `${content.caption}\n\n${content.hashtags.join(' ')}`;
    
    switch (platform) {
      case 'twitter':
        // Twitter has 280 character limit
        return baseContent.length > 280 ? 
          content.caption.substring(0, 250) + '... ' + content.hashtags.slice(0, 3).join(' ') :
          baseContent;
      
      case 'instagram':
        // Instagram allows longer posts
        return `${content.caption}\n.\n.\n.\n${content.hashtags.join(' ')}`;
      
      case 'linkedin':
        // LinkedIn prefers professional tone
        return `${content.caption}\n\n${content.hashtags.slice(0, 5).join(' ')}`;
      
      default:
        return baseContent;
    }
  }
}
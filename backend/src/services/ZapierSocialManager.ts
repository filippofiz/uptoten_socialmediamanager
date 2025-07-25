import axios from 'axios';
import { supabase } from '../lib/supabase';

interface PostContent {
  content: string;
  caption: string;
  hashtags: string[];
  imagePath?: string;
  imageUrl?: string;
  link?: string;
  platforms: string[];
}

interface PostResult {
  platform: string;
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  timestamp: Date;
}

export class ZapierSocialManager {
  private zapierWebhooks: Map<string, string> = new Map();

  constructor() {
    // Configurazione webhook Zapier per ogni piattaforma
    this.zapierWebhooks.set('facebook', process.env.ZAPIER_FACEBOOK_WEBHOOK || '');
    this.zapierWebhooks.set('instagram', process.env.ZAPIER_INSTAGRAM_WEBHOOK || '');
    this.zapierWebhooks.set('twitter', process.env.ZAPIER_TWITTER_WEBHOOK || '');
    this.zapierWebhooks.set('linkedin', process.env.ZAPIER_LINKEDIN_WEBHOOK || '');
    this.zapierWebhooks.set('all', process.env.ZAPIER_ALL_PLATFORMS_WEBHOOK || '');
  }

  async postToAllPlatforms(content: PostContent): Promise<PostResult[]> {
    const results: PostResult[] = [];

    // Se c'è un webhook per tutti i social, usalo
    if (this.zapierWebhooks.get('all')) {
      try {
        const result = await this.sendToZapier('all', content);
        return result;
      } catch (error: any) {
        console.error('Error posting to all platforms via Zapier:', error);
      }
    }

    // Altrimenti invia a ogni piattaforma separatamente
    for (const platform of content.platforms) {
      try {
        const result = await this.postToPlatform(platform, content);
        results.push(result);
      } catch (error: any) {
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
    const webhookUrl = this.zapierWebhooks.get(platform) || this.zapierWebhooks.get('all');
    
    if (!webhookUrl) {
      throw new Error(`Zapier webhook not configured for ${platform}`);
    }

    try {
      // Usa il formato che Zapier si aspetta
      const response = await axios.post(webhookUrl, {
        action: 'create_post',
        data: {
          message: `${content.content}\n\n${content.hashtags.join(' ')}`, // Campo message per Facebook
          content: content.content,
          platforms: [platform],
          hashtags: content.hashtags,
          link: content.link || '',
          imageUrl: content.imageUrl || content.imagePath || '',
          picture: content.imageUrl || content.imagePath || '', // Alias per Facebook
          requireApproval: false
        }
      });

      // Zapier dovrebbe restituire info sul post pubblicato
      const zapierResponse = response.data;

      return {
        platform,
        success: true,
        postId: zapierResponse.postId || `zapier_${Date.now()}`,
        url: zapierResponse.url || `https://${platform}.com/post`,
        timestamp: new Date()
      };
    } catch (error: any) {
      console.error(`Error posting to ${platform}:`, error.message);
      return {
        platform,
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  private async sendToZapier(webhook: string, content: PostContent): Promise<PostResult[]> {
    const webhookUrl = this.zapierWebhooks.get(webhook);
    
    if (!webhookUrl) {
      throw new Error('Zapier webhook not configured');
    }

    try {
      // Prepara i dati nel formato ottimale per Zapier/Facebook
      const zapierData = {
        // Campi principali per Facebook
        message: `${content.content}\n\n${content.hashtags.join(' ')}`,
        link: content.link || '',
        picture: content.imageUrl || content.imagePath || '',
        
        // Campi originali per compatibilità
        content: content.content,
        caption: content.caption,
        hashtags: content.hashtags,
        imagePath: content.imagePath,
        imageUrl: content.imageUrl,
        platforms: content.platforms,
        
        // Metadata
        timestamp: new Date().toISOString(),
        source: 'up-to-ten-backend'
      };

      const response = await axios.post(webhookUrl, zapierData);

      // Zapier restituisce i risultati per ogni piattaforma
      const zapierResults = response.data.results || [];
      
      return zapierResults.map((result: any) => ({
        platform: result.platform,
        success: result.success,
        postId: result.postId,
        url: result.url,
        error: result.error,
        timestamp: new Date()
      }));
    } catch (error: any) {
      // Se fallisce, restituisci errore per tutte le piattaforme
      return content.platforms.map(platform => ({
        platform,
        success: false,
        error: error.message,
        timestamp: new Date()
      }));
    }
  }

  async schedulePost(content: PostContent, scheduledTime: Date): Promise<void> {
    // Invia a Zapier per la programmazione
    const webhookUrl = process.env.ZAPIER_SCHEDULE_WEBHOOK;
    
    if (!webhookUrl) {
      throw new Error('Zapier schedule webhook not configured');
    }

    await axios.post(webhookUrl, {
      content: content.content,
      caption: content.caption,
      hashtags: content.hashtags,
      imagePath: content.imagePath,
      platforms: content.platforms,
      scheduledTime: scheduledTime.toISOString()
    });

    // Salva nel database
    await supabase.from('posts').insert({
      content: content.content,
      platforms: content.platforms,
      status: 'scheduled',
      scheduled_time: scheduledTime.toISOString(),
      hashtags: content.hashtags
    });
  }

  async getEngagementMetrics(platform: string, postId: string): Promise<any> {
    // Richiedi metriche a Zapier
    const webhookUrl = process.env.ZAPIER_ANALYTICS_WEBHOOK;
    
    if (!webhookUrl) {
      return null;
    }

    try {
      const response = await axios.post(webhookUrl, {
        action: 'get_engagement',
        platform,
        postId
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching engagement from Zapier:', error);
      return null;
    }
  }

  async getStats(): Promise<Record<string, any>> {
    // Ottieni statistiche dal database locale
    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'published');

    const stats: Record<string, any> = {
      twitter: { totalPosts: 0, successfulPosts: 0, failedPosts: 0 },
      facebook: { totalPosts: 0, successfulPosts: 0, failedPosts: 0 },
      instagram: { totalPosts: 0, successfulPosts: 0, failedPosts: 0 },
      linkedin: { totalPosts: 0, successfulPosts: 0, failedPosts: 0 }
    };

    posts?.forEach(post => {
      post.platforms?.forEach((platform: string) => {
        if (stats[platform]) {
          stats[platform].totalPosts++;
          if (post.results?.find((r: any) => r.platform === platform && r.success)) {
            stats[platform].successfulPosts++;
          } else {
            stats[platform].failedPosts++;
          }
        }
      });
    });

    // Richiedi metriche aggiornate a Zapier se disponibile
    const analyticsWebhook = process.env.ZAPIER_ANALYTICS_WEBHOOK;
    if (analyticsWebhook) {
      try {
        const response = await axios.post(analyticsWebhook, {
          action: 'get_stats'
        });
        
        // Merge con dati Zapier
        Object.keys(response.data).forEach(platform => {
          if (stats[platform]) {
            stats[platform] = { ...stats[platform], ...response.data[platform] };
          }
        });
      } catch (error) {
        console.error('Error fetching stats from Zapier:', error);
      }
    }

    return stats;
  }
}
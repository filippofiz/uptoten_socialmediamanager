import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export interface CompanySettings {
  id?: string;
  company_name: string;
  company_industry?: string;
  company_description?: string;
  target_audience?: string;
  brand_voice?: string;
  business_goals?: string;
  platforms?: string[];
  frequency_hours?: number;
  active_hours_start?: string;
  active_hours_end?: string;
  is_active?: boolean;
  auto_publish?: boolean;
  themes?: string[];
  competitor_analysis?: boolean;
  ai_debate_enabled?: boolean;
  default_tone?: string;
  default_hashtags?: string;
}

export interface Post {
  id?: string;
  content: string;
  hashtags?: string;
  platform: string;
  image_url?: string;
  image_prompt?: string;
  scheduled_time?: string;
  status?: 'draft' | 'scheduled' | 'published' | 'failed';
  published_time?: string;
}

export interface BrandAsset {
  id?: string;
  type: 'logo' | 'template';
  platform?: string;
  file_url: string;
  file_path?: string;
  is_active?: boolean;
}

export class SupabaseManager {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  // ============= COMPANY SETTINGS =============
  async getCompanySettings(): Promise<CompanySettings | null> {
    try {
      const { data, error } = await this.supabase
        .from('schedule_settings')
        .select('*')
        .single();

      if (error) {
        console.log('No company settings found, returning defaults');
        return this.getDefaultSettings();
      }

      return data;
    } catch (error) {
      console.error('Error fetching company settings:', error);
      return this.getDefaultSettings();
    }
  }

  async updateCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    try {
      // Check if settings exist
      const { data: existing } = await this.supabase
        .from('schedule_settings')
        .select('id')
        .single();

      let result;
      if (existing) {
        // Update existing
        const { data, error } = await this.supabase
          .from('schedule_settings')
          .update(settings)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new
        const { data, error } = await this.supabase
          .from('schedule_settings')
          .insert({
            ...this.getDefaultSettings(),
            ...settings
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      console.log('Company settings updated successfully');
      return result;
    } catch (error) {
      console.error('Error updating company settings:', error);
      throw error;
    }
  }

  private getDefaultSettings(): CompanySettings {
    return {
      company_name: 'Up to Ten',
      company_industry: 'Educazione, Ripetizioni Scientifiche, Formazione STEM',
      company_description: 'Up to Ten è il centro di eccellenza per le ripetizioni a Milano',
      target_audience: 'Studenti e genitori',
      brand_voice: 'Professionale ma amichevole',
      business_goals: 'Aumentare le iscrizioni ai corsi',
      platforms: ['facebook', 'instagram', 'twitter', 'linkedin'],
      frequency_hours: 4,
      active_hours_start: '08:00',
      active_hours_end: '22:00',
      is_active: false,
      auto_publish: false,
      themes: ['tips_studio', 'motivazionale', 'spiegazioni_semplici'],
      competitor_analysis: true,
      ai_debate_enabled: false,
      default_tone: 'professional',
      default_hashtags: '#UpToTen #Ripetizioni #Milano'
    };
  }

  // ============= POSTS =============
  async createPost(post: Post): Promise<Post> {
    try {
      const { data, error } = await this.supabase
        .from('posts')
        .insert(post)
        .select()
        .single();

      if (error) throw error;
      console.log('Post created successfully:', data.id);
      return data;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  async getPosts(filters?: {
    platform?: string;
    status?: string;
    limit?: number;
  }): Promise<Post[]> {
    try {
      let query = this.supabase.from('posts').select('*');

      if (filters?.platform) {
        query = query.eq('platform', filters.platform);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  }

  async updatePost(id: string, updates: Partial<Post>): Promise<Post> {
    try {
      const { data, error } = await this.supabase
        .from('posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      console.log('Post updated successfully:', id);
      return data;
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  async deletePost(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log('Post deleted successfully:', id);
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  // ============= BRAND ASSETS =============
  async uploadBrandAsset(asset: BrandAsset): Promise<BrandAsset> {
    try {
      // Deactivate other assets of the same type
      if (asset.type === 'logo') {
        await this.supabase
          .from('brand_assets')
          .update({ is_active: false })
          .eq('type', 'logo');
      } else if (asset.type === 'template' && asset.platform) {
        await this.supabase
          .from('brand_assets')
          .update({ is_active: false })
          .eq('type', 'template')
          .eq('platform', asset.platform);
      }

      const { data, error } = await this.supabase
        .from('brand_assets')
        .insert(asset)
        .select()
        .single();

      if (error) throw error;
      console.log('Brand asset uploaded successfully:', data.id);
      return data;
    } catch (error) {
      console.error('Error uploading brand asset:', error);
      throw error;
    }
  }

  async getBrandAssets(filters?: {
    type?: 'logo' | 'template';
    platform?: string;
    active_only?: boolean;
  }): Promise<BrandAsset[]> {
    try {
      let query = this.supabase.from('brand_assets').select('*');

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.platform) {
        query = query.eq('platform', filters.platform);
      }
      if (filters?.active_only) {
        query = query.eq('is_active', true);
      }

      query = query.order('uploaded_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching brand assets:', error);
      return [];
    }
  }

  async deleteBrandAsset(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('brand_assets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log('Brand asset deleted successfully:', id);
    } catch (error) {
      console.error('Error deleting brand asset:', error);
      throw error;
    }
  }

  // ============= GENERATED CONTENT =============
  async saveGeneratedContent(content: {
    topic: string;
    tone?: string;
    platforms?: string[];
    content: any;
    hashtags?: string;
    ai_debate_used?: boolean;
    debate_transcript?: any;
  }): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('generated_content')
        .insert(content)
        .select('id')
        .single();

      if (error) throw error;
      console.log('Generated content saved:', data.id);
      return data.id;
    } catch (error) {
      console.error('Error saving generated content:', error);
      throw error;
    }
  }

  async getGeneratedContent(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('generated_content')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching generated content:', error);
      return [];
    }
  }

  // ============= COMPOSITION SETTINGS =============
  async getCompositionSettings(): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('composition_settings')
        .select('*')
        .single();

      if (error) {
        // Return defaults if not found
        return {
          auto_apply_logo: true,
          auto_apply_template: true,
          logo_position: 'bottom-right',
          logo_size: 150,
          overlay_opacity: 0.9
        };
      }

      return data;
    } catch (error) {
      console.error('Error fetching composition settings:', error);
      return {
        auto_apply_logo: true,
        auto_apply_template: true,
        logo_position: 'bottom-right',
        logo_size: 150,
        overlay_opacity: 0.9
      };
    }
  }

  async updateCompositionSettings(settings: any): Promise<any> {
    try {
      // Check if settings exist
      const { data: existing } = await this.supabase
        .from('composition_settings')
        .select('id')
        .single();

      let result;
      if (existing) {
        const { data, error } = await this.supabase
          .from('composition_settings')
          .update(settings)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await this.supabase
          .from('composition_settings')
          .insert(settings)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      console.log('Composition settings updated successfully');
      return result;
    } catch (error) {
      console.error('Error updating composition settings:', error);
      throw error;
    }
  }

  // ============= PERFORMANCE METRICS =============
  async recordMetric(postId: string, platform: string, metricType: string, value: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('performance_metrics')
        .insert({
          post_id: postId,
          platform: platform,
          metric_type: metricType,
          value: value
        });

      if (error) throw error;
      console.log('Metric recorded successfully');
    } catch (error) {
      console.error('Error recording metric:', error);
    }
  }

  async getPostMetrics(postId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('performance_metrics')
        .select('*')
        .eq('post_id', postId)
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching post metrics:', error);
      return [];
    }
  }
}

// Export singleton instance
export const supabaseManager = new SupabaseManager();
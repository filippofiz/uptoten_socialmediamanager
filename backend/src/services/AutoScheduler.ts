import cron from 'node-cron';
import { AIDebateSystem } from './AIDebateSystem';
import { CompetitorAnalyzer } from './CompetitorAnalyzer';
import { ImageComposer } from './ImageComposer';
import { SocialMediaManager } from './SocialMediaManager';
import { supabase } from '../lib/supabase';

interface ScheduleSettings {
  id: string;
  platforms: string[];
  frequency_hours: number;
  active_hours_start: string;
  active_hours_end: string;
  themes: string[];
  competitor_analysis: boolean;
  ai_debate_enabled: boolean;
  auto_publish: boolean;
  is_active: boolean;
}

export class AutoScheduler {
  private aiDebate: AIDebateSystem;
  private competitorAnalyzer: CompetitorAnalyzer;
  private imageComposer: ImageComposer;
  private socialMediaManager: SocialMediaManager;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private settings: ScheduleSettings | null = null;

  constructor() {
    this.aiDebate = new AIDebateSystem();
    this.competitorAnalyzer = new CompetitorAnalyzer(null as any);
    this.imageComposer = new ImageComposer();
    this.socialMediaManager = new SocialMediaManager();
    
    this.loadSettings();
    this.setupSettingsWatcher();
  }

  private async loadSettings() {
    try {
      const { data, error } = await supabase
        .from('schedule_settings')
        .select('*')
        .single();
      
      if (data && !error) {
        this.settings = data;
        this.updateSchedule();
      } else {
        // Crea impostazioni default
        await this.createDefaultSettings();
      }
    } catch (error) {
      console.error('Error loading schedule settings:', error);
      await this.createDefaultSettings();
    }
  }

  private async createDefaultSettings() {
    const defaultSettings: Omit<ScheduleSettings, 'id'> = {
      platforms: ['facebook', 'instagram', 'twitter', 'linkedin'],
      frequency_hours: 4,
      active_hours_start: '08:00',
      active_hours_end: '22:00',
      themes: ['tips_studio', 'motivazionale', 'spiegazioni_semplici', 'curiosita_scientifiche'],
      competitor_analysis: true,
      ai_debate_enabled: true,
      auto_publish: true,
      is_active: true
    };

    const { data, error } = await supabase
      .from('schedule_settings')
      .insert(defaultSettings)
      .select()
      .single();

    if (data && !error) {
      this.settings = data;
      this.updateSchedule();
    }
  }

  private setupSettingsWatcher() {
    // Ascolta cambiamenti nelle impostazioni
    supabase
      .channel('schedule_settings_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'schedule_settings' },
        async (payload) => {
          console.log('Settings updated:', payload);
          await this.loadSettings();
        }
      )
      .subscribe();
  }

  private updateSchedule() {
    if (!this.settings) return;

    // Cancella job esistenti
    this.scheduledJobs.forEach(job => job.destroy());
    this.scheduledJobs.clear();

    if (!this.settings.is_active) {
      console.log('📅 Auto-scheduler disattivato');
      return;
    }

    // Crea nuovo schedule basato su frequenza
    const cronExpression = this.createCronExpression(this.settings.frequency_hours);
    
    console.log(`📅 Nuovo schedule: ogni ${this.settings.frequency_hours}h sulle piattaforme: ${this.settings.platforms.join(', ')}`);
    
    const job = cron.schedule(cronExpression, async () => {
      await this.executeAutoPost();
    }, {
      scheduled: true,
      timezone: "Europe/Rome"
    });

    this.scheduledJobs.set('main', job);

    // Job per analisi giornaliera competitor
    if (this.settings.competitor_analysis) {
      const dailyAnalysis = cron.schedule('0 9 * * *', async () => {
        await this.performDailyAnalysis();
      }, {
        scheduled: true,
        timezone: "Europe/Rome"
      });
      
      this.scheduledJobs.set('daily_analysis', dailyAnalysis);
    }
  }

  private createCronExpression(hours: number): string {
    // Crea espressione cron basata su frequenza ore
    if (hours >= 24) {
      return '0 9 * * *'; // Una volta al giorno alle 9
    } else if (hours >= 12) {
      return '0 9,21 * * *'; // Due volte al giorno
    } else if (hours >= 8) {
      return '0 9,15,21 * * *'; // Tre volte al giorno
    } else if (hours >= 6) {
      return '0 9,13,17,21 * * *'; // Quattro volte al giorno
    } else if (hours >= 4) {
      return '0 9,13,17,21 * * *'; // Ogni 4 ore negli orari attivi
    } else if (hours >= 2) {
      return '0 9,11,13,15,17,19,21 * * *'; // Ogni 2 ore
    } else {
      return '0 * * * *'; // Ogni ora (sconsigliato)
    }
  }

  private async executeAutoPost() {
    if (!this.settings || !this.isInActiveHours()) {
      console.log('⏰ Fuori orario attivo, salto pubblicazione');
      return;
    }

    try {
      console.log('🚀 Inizio processo di pubblicazione automatica...');
      
      // 1. Analizza competitor se abilitato
      let competitorInsights = null;
      if (this.settings.competitor_analysis) {
        console.log('🔍 Analisi competitor...');
        competitorInsights = await this.competitorAnalyzer.analyzeCompetitorContent('instagram');
      }

      // 2. Seleziona tema casuale dalle preferenze
      const theme = this.settings.themes[Math.floor(Math.random() * this.settings.themes.length)];
      console.log(`🎨 Tema selezionato: ${theme}`);

      // 3. Genera contenuto con AI Debate se abilitato
      let content;
      if (this.settings.ai_debate_enabled) {
        console.log('🤖 Avvio dibattito AI...');
        const debateResult = await this.aiDebate.generateOptimizedContent(
          theme as any,
          competitorInsights ? `Insights competitor: ${JSON.stringify(competitorInsights.trendingTopics)}` : ''
        );
        content = debateResult.finalContent;
        
        // Salva risultato dibattito nel database
        await supabase.from('ai_debate_results').insert({
          theme,
          consensus_score: debateResult.consensusScore,
          improvements: debateResult.improvements,
          iterations: debateResult.iterations,
          created_at: new Date().toISOString()
        });
        
        console.log(`🎯 Dibattito completato con consensus score: ${debateResult.consensusScore}%`);
      } else {
        // Fallback a generazione standard
        content = await this.generateStandardContent(theme);
      }

      // 4. Genera immagine
      console.log('🎨 Generazione immagine...');
      const imageUrl = await this.generateImage(content.imagePrompt);
      
      // 5. Crea varianti per ogni piattaforma
      const imageVariants = await this.createPlatformImages(imageUrl);

      // 6. Pubblica su tutte le piattaforme attive
      if (this.settings.auto_publish) {
        console.log(`📤 Pubblicazione su: ${this.settings.platforms.join(', ')}`);
        
        const results = [];
        for (const platform of this.settings.platforms) {
          try {
            const platformContent = {
              ...content,
              imagePath: imageVariants[platform] || imageVariants.main
            };
            
            const result = await this.socialMediaManager.postToPlatform(platform, platformContent);
            results.push(result);
            
            console.log(`✅ ${platform}: Pubblicato con successo`);
          } catch (error) {
            console.error(`❌ ${platform}: Errore pubblicazione -`, error.message);
            results.push({
              platform,
              success: false,
              error: error.message,
              timestamp: new Date()
            });
          }
        }

        // 7. Salva nel database
        await this.savePostToDatabase(content, results, imageVariants);
        
        console.log('💾 Post salvato nel database');
        console.log('🎉 Processo completato con successo!');
        
      } else {
        console.log('📝 Modalità draft: contenuto generato ma non pubblicato');
        // Salva come bozza
        await this.savePostToDatabase(content, [], imageVariants, 'draft');
      }

    } catch (error) {
      console.error('💥 Errore nel processo automatico:', error);
      
      // Salva errore nel database per debugging
      await supabase.from('auto_post_errors').insert({
        error_message: error.message,
        error_stack: error.stack,
        settings: this.settings,
        created_at: new Date().toISOString()
      });
    }
  }

  private isInActiveHours(): boolean {
    if (!this.settings) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    
    const startTime = this.parseTime(this.settings.active_hours_start);
    const endTime = this.parseTime(this.settings.active_hours_end);
    
    return currentTime >= startTime && currentTime <= endTime;
  }

  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 100 + minutes;
  }

  private async generateStandardContent(theme: string) {
    // Fallback se AI Debate non è disponibile
    return {
      caption: `Contenuto generato per tema: ${theme}`,
      hashtags: ['#UpToTen', '#RipetizioniMilano', '#STEM'],
      imagePrompt: `Create an educational image about ${theme}`,
      theme,
      suggestedTime: new Date().toISOString(),
      generatedAt: new Date()
    };
  }

  private async generateImage(prompt: string): Promise<string> {
    // Implementa generazione immagine (già fatto in AIDebateSystem)
    return 'https://example.com/generated-image.jpg';
  }

  private async createPlatformImages(imageUrl: string): Promise<Record<string, string>> {
    const variants: Record<string, string> = { main: imageUrl };
    
    for (const platform of ['facebook', 'instagram', 'twitter', 'linkedin']) {
      try {
        variants[platform] = await this.imageComposer.optimizeForPlatform(imageUrl, platform);
      } catch (error) {
        console.warn(`Errore ottimizzazione immagine per ${platform}:`, error.message);
        variants[platform] = imageUrl;
      }
    }
    
    return variants;
  }

  private async savePostToDatabase(content: any, results: any[], imageVariants: any, status: string = 'published') {
    // Salva il post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        content: content.caption,
        hashtags: content.hashtags,
        image_url: imageVariants.main,
        status,
        platforms: this.settings!.platforms,
        ai_generated: true,
        theme: content.theme,
        scheduled_time: new Date().toISOString(),
        published_time: status === 'published' ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (post && !postError) {
      // Salva i risultati per ogni piattaforma
      for (const result of results) {
        await supabase.from('post_results').insert({
          post_id: post.id,
          platform: result.platform,
          platform_post_id: result.postId,
          url: result.url,
          success: result.success,
          error_message: result.error || null
        });
      }
    }
  }

  private async performDailyAnalysis() {
    console.log('📊 Analisi giornaliera competitor in corso...');
    
    try {
      const platforms = ['instagram', 'facebook', 'twitter', 'linkedin'];
      const insights = [];
      
      for (const platform of platforms) {
        const analysis = await this.competitorAnalyzer.analyzeCompetitorContent(platform);
        insights.push({
          platform,
          trending_topics: analysis.trendingTopics,
          best_posting_times: analysis.bestPostingTimes,
          popular_hashtags: analysis.popularHashtags,
          date: new Date().toISOString().split('T')[0]
        });
      }
      
      // Salva insights nel database
      await supabase.from('competitor_insights').insert(insights);
      
      console.log('💡 Analisi giornaliera completata e salvata');
    } catch (error) {
      console.error('❌ Errore nell\'analisi giornaliera:', error);
    }
  }

  // Metodi per gestione esterna
  async updateSettings(newSettings: Partial<ScheduleSettings>) {
    if (!this.settings) return;
    
    const { error } = await supabase
      .from('schedule_settings')
      .update(newSettings)
      .eq('id', this.settings.id);
    
    if (!error) {
      console.log('⚙️ Impostazioni aggiornate');
    }
  }

  async pauseScheduler() {
    await this.updateSettings({ is_active: false });
  }

  async resumeScheduler() {
    await this.updateSettings({ is_active: true });
  }

  async triggerManualPost(theme?: string) {
    console.log('🎯 Pubblicazione manuale richiesta');
    
    if (theme) {
      const originalThemes = this.settings?.themes;
      if (this.settings) {
        this.settings.themes = [theme];
      }
      
      await this.executeAutoPost();
      
      if (this.settings && originalThemes) {
        this.settings.themes = originalThemes;
      }
    } else {
      await this.executeAutoPost();
    }
  }

  getStatus() {
    return {
      isActive: this.settings?.is_active || false,
      settings: this.settings,
      nextExecution: this.getNextExecutionTime(),
      activeJobs: Array.from(this.scheduledJobs.keys())
    };
  }

  private getNextExecutionTime(): string | null {
    if (!this.settings?.is_active) return null;
    
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + this.settings.frequency_hours, 0, 0, 0);
    
    return nextHour.toISOString();
  }
}
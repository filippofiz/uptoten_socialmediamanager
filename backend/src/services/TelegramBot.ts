import TelegramBot from 'node-telegram-bot-api';
import { supabase } from '../lib/supabase';
import { ZapierSocialManager } from './ZapierSocialManager';
import { ContentGenerator } from './ContentGenerator';
import { ImageComposer } from './ImageComposer';

interface PendingPost {
  id: string;
  content: string;
  platforms: string[];
  imagePath?: string;
  scheduledTime?: Date;
  hashtags: string[];
  userId: number;
  chatId: number;
  status: 'pending' | 'approved' | 'rejected' | 'scheduled';
}

export class TelegramBotService {
  private bot: TelegramBot;
  private socialMediaManager: ZapierSocialManager;
  private contentGenerator: ContentGenerator;
  private imageComposer: ImageComposer;
  private pendingPosts: Map<string, PendingPost> = new Map();
  private userStates: Map<number, any> = new Map();

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.socialMediaManager = new ZapierSocialManager();
    this.contentGenerator = new ContentGenerator();
    this.imageComposer = new ImageComposer();
    
    this.initializeCommands();
    this.setupMessageHandlers();
  }

  private initializeCommands() {
    this.bot.setMyCommands([
      { command: '/start', description: 'Inizia ad usare il bot' },
      { command: '/newpost', description: 'Crea un nuovo post' },
      { command: '/calendar', description: 'Visualizza piano editoriale' },
      { command: '/stats', description: 'Visualizza statistiche' },
      { command: '/schedule', description: 'Programma un post' },
      { command: '/approve', description: 'Approva post in attesa' },
      { command: '/reject', description: 'Rifiuta post in attesa' },
      { command: '/report', description: 'Genera report' },
      { command: '/suggestions', description: 'Ottieni suggerimenti contenuti' },
      { command: '/help', description: 'Mostra aiuto' }
    ]);
  }

  private setupMessageHandlers() {
    // Start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(chatId, 
        `🚀 Benvenuto nel Social Media Manager Bot!

Posso aiutarti a:
• 📝 Creare e pubblicare post sui social
• 📅 Gestire il piano editoriale
• ✅ Approvare contenuti prima della pubblicazione
• 📊 Monitorare performance e statistiche
• 💡 Suggerire contenuti ottimizzati

Usa /help per vedere tutti i comandi disponibili.`
      );
    });

    // New post command
    this.bot.onText(/\/newpost/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id || 0;
      
      this.userStates.set(userId, { action: 'creating_post', step: 'content' });
      
      await this.bot.sendMessage(chatId, 
        `📝 Creiamo un nuovo post!

Inviami il testo del post:`,
        {
          reply_markup: {
            force_reply: true
          }
        }
      );
    });

    // Calendar command
    this.bot.onText(/\/calendar/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendEditorialCalendar(chatId);
    });

    // Stats command
    this.bot.onText(/\/stats/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendStats(chatId);
    });

    // Schedule command
    this.bot.onText(/\/schedule/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id || 0;
      
      this.userStates.set(userId, { action: 'scheduling_post', step: 'select_post' });
      
      await this.sendPendingPosts(chatId, 'schedule');
    });

    // Approve command
    this.bot.onText(/\/approve/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendPendingPosts(chatId, 'approve');
    });

    // Reject command
    this.bot.onText(/\/reject/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendPendingPosts(chatId, 'reject');
    });

    // Report command
    this.bot.onText(/\/report/, async (msg) => {
      const chatId = msg.chat.id;
      await this.generateReport(chatId);
    });

    // Suggestions command
    this.bot.onText(/\/suggestions/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendContentSuggestions(chatId);
    });

    // Help command
    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(chatId, 
        `📚 Comandi disponibili:

/newpost - Crea un nuovo post
/calendar - Visualizza piano editoriale
/stats - Visualizza statistiche
/schedule - Programma un post
/approve - Approva post in attesa
/reject - Rifiuta post in attesa
/report - Genera report dettagliato
/suggestions - Ottieni suggerimenti contenuti
/help - Mostra questo messaggio

💡 Puoi anche inviarmi direttamente:
• Testo per creare un post veloce
• Immagini da pubblicare
• Domande sui tuoi social media`
      );
    });

    // Handle text messages
    this.bot.on('message', async (msg) => {
      if (msg.text?.startsWith('/')) return;
      
      const chatId = msg.chat.id;
      const userId = msg.from?.id || 0;
      const userState = this.userStates.get(userId);

      if (userState) {
        await this.handleUserState(msg, userState);
      } else if (msg.text) {
        // Quick post creation
        await this.handleQuickPost(msg);
      } else if (msg.photo) {
        // Handle photo upload
        await this.handlePhotoUpload(msg);
      }
    });

    // Handle callback queries
    this.bot.on('callback_query', async (query) => {
      await this.handleCallbackQuery(query);
    });
  }

  private async handleUserState(msg: TelegramBot.Message, userState: any) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id || 0;

    switch (userState.action) {
      case 'creating_post':
        await this.handlePostCreation(msg, userState);
        break;
      case 'scheduling_post':
        await this.handlePostScheduling(msg, userState);
        break;
      case 'editing_calendar':
        await this.handleCalendarEdit(msg, userState);
        break;
    }
  }

  private async handlePostCreation(msg: TelegramBot.Message, state: any) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id || 0;

    switch (state.step) {
      case 'content':
        state.content = msg.text;
        state.step = 'platforms';
        this.userStates.set(userId, state);

        await this.bot.sendMessage(chatId, 
          `✅ Contenuto salvato!

Ora seleziona le piattaforme su cui pubblicare:`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Facebook', callback_data: 'platform_facebook' },
                  { text: '✅ Instagram', callback_data: 'platform_instagram' }
                ],
                [
                  { text: '✅ Twitter', callback_data: 'platform_twitter' },
                  { text: '✅ LinkedIn', callback_data: 'platform_linkedin' }
                ],
                [
                  { text: '✅ Tutte', callback_data: 'platform_all' },
                  { text: '➡️ Continua', callback_data: 'platform_done' }
                ]
              ]
            }
          }
        );
        break;

      case 'hashtags':
        state.hashtags = msg.text?.split(' ').filter(tag => tag.startsWith('#')) || [];
        state.step = 'image';
        this.userStates.set(userId, state);

        await this.bot.sendMessage(chatId, 
          `🏷️ Hashtags aggiunti!

Vuoi aggiungere un'immagine?`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📷 Carica immagine', callback_data: 'add_image' },
                  { text: '🎨 Genera con AI', callback_data: 'generate_image' }
                ],
                [
                  { text: '⏭️ Salta', callback_data: 'skip_image' }
                ]
              ]
            }
          }
        );
        break;
    }
  }

  private async handleQuickPost(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const content = msg.text || '';
    const postId = Date.now().toString();

    const pendingPost: PendingPost = {
      id: postId,
      content,
      platforms: ['facebook', 'instagram', 'twitter', 'linkedin'],
      hashtags: content.match(/#\w+/g) || [],
      userId: msg.from?.id || 0,
      chatId,
      status: 'pending'
    };

    this.pendingPosts.set(postId, pendingPost);

    await this.bot.sendMessage(chatId, 
      `📄 Post rapido creato!

"${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"

Cosa vuoi fare?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Pubblica ora', callback_data: `publish_${postId}` },
              { text: '📅 Programma', callback_data: `schedule_${postId}` }
            ],
            [
              { text: '✏️ Modifica', callback_data: `edit_${postId}` },
              { text: '❌ Elimina', callback_data: `delete_${postId}` }
            ]
          ]
        }
      }
    );
  }

  private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    const data = query.data || '';
    const userId = query.from.id;

    // Platform selection
    if (data.startsWith('platform_')) {
      await this.handlePlatformSelection(query);
    }
    // Post actions
    else if (data.startsWith('publish_')) {
      const postId = data.replace('publish_', '');
      await this.publishPost(postId, chatId);
    }
    else if (data.startsWith('schedule_')) {
      const postId = data.replace('schedule_', '');
      await this.schedulePost(postId, chatId);
    }
    else if (data.startsWith('approve_')) {
      const postId = data.replace('approve_', '');
      await this.approvePost(postId, chatId);
    }
    else if (data.startsWith('reject_')) {
      const postId = data.replace('reject_', '');
      await this.rejectPost(postId, chatId);
    }
    // Calendar actions
    else if (data.startsWith('cal_')) {
      await this.handleCalendarAction(query);
    }

    await this.bot.answerCallbackQuery(query.id);
  }

  private async publishPost(postId: string, chatId: number) {
    const post = this.pendingPosts.get(postId);
    if (!post) {
      await this.bot.sendMessage(chatId, '❌ Post non trovato');
      return;
    }

    try {
      await this.bot.sendMessage(chatId, '⏳ Pubblicazione in corso...');

      const results = await this.socialMediaManager.postToAllPlatforms({
        content: post.content,
        caption: post.content,
        hashtags: post.hashtags,
        imagePath: post.imagePath,
        platforms: post.platforms
      });

      // Save to database
      await supabase.from('posts').insert({
        content: post.content,
        platforms: post.platforms,
        status: 'published',
        published_time: new Date().toISOString(),
        telegram_user_id: post.userId,
        results: results
      });

      let successMessage = '✅ Post pubblicato con successo!\n\n';
      results.forEach(result => {
        if (result.success) {
          successMessage += `✅ ${result.platform}: ${result.url}\n`;
        } else {
          successMessage += `❌ ${result.platform}: ${result.error}\n`;
        }
      });

      await this.bot.sendMessage(chatId, successMessage);
      this.pendingPosts.delete(postId);
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ Errore nella pubblicazione: ${error.message}`);
    }
  }

  private async sendEditorialCalendar(chatId: number) {
    try {
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .gte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(10);

      if (!posts || posts.length === 0) {
        await this.bot.sendMessage(chatId, '📅 Nessun post programmato al momento.');
        return;
      }

      let message = '📅 *Piano Editoriale*\n\n';
      
      posts.forEach((post, index) => {
        const date = new Date(post.scheduled_time);
        const platforms = post.platforms.join(', ');
        message += `${index + 1}. *${date.toLocaleDateString('it-IT')} ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}*\n`;
        message += `📱 ${platforms}\n`;
        message += `📝 ${post.content.substring(0, 50)}...\n\n`;
      });

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error: any) {
      await this.bot.sendMessage(chatId, '❌ Errore nel recupero del calendario');
    }
  }

  private async sendStats(chatId: number) {
    try {
      const stats = await this.socialMediaManager.getStats();
      
      let message = '📊 *Statistiche Social Media*\n\n';
      
      Object.entries(stats).forEach(([platform, data]) => {
        message += `*${platform.toUpperCase()}*\n`;
        message += `• Post totali: ${data.totalPosts}\n`;
        message += `• Successi: ${data.successfulPosts}\n`;
        message += `• Falliti: ${data.failedPosts}\n`;
        message += `• Engagement:\n`;
        message += `  - Like: ${data.engagement.likes}\n`;
        message += `  - Commenti: ${data.engagement.comments}\n`;
        message += `  - Condivisioni: ${data.engagement.shares}\n\n`;
      });

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error: any) {
      await this.bot.sendMessage(chatId, '❌ Errore nel recupero delle statistiche');
    }
  }

  private async generateReport(chatId: number) {
    try {
      await this.bot.sendMessage(chatId, '⏳ Generazione report in corso...');

      // Get data from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      const stats = await this.socialMediaManager.getStats();

      let report = `📊 *REPORT MENSILE SOCIAL MEDIA*\n`;
      report += `📅 ${thirtyDaysAgo.toLocaleDateString('it-IT')} - ${new Date().toLocaleDateString('it-IT')}\n\n`;
      
      report += `*RIEPILOGO GENERALE*\n`;
      report += `• Post pubblicati: ${posts?.length || 0}\n`;
      report += `• Media post/giorno: ${((posts?.length || 0) / 30).toFixed(1)}\n\n`;

      report += `*PERFORMANCE PER PIATTAFORMA*\n`;
      Object.entries(stats).forEach(([platform, data]) => {
        const successRate = data.totalPosts > 0 
          ? ((data.successfulPosts / data.totalPosts) * 100).toFixed(1)
          : 0;
        
        report += `\n*${platform.toUpperCase()}*\n`;
        report += `• Tasso di successo: ${successRate}%\n`;
        report += `• Engagement totale: ${data.engagement.likes + data.engagement.comments + data.engagement.shares}\n`;
      });

      report += `\n*TOP PERFORMING POSTS*\n`;
      // Here you would add logic to identify top posts

      report += `\n*SUGGERIMENTI*\n`;
      report += `• Aumenta la frequenza di pubblicazione su LinkedIn\n`;
      report += `• I post con immagini hanno il 65% di engagement in più\n`;
      report += `• Gli orari migliori: 12:00-13:00 e 18:00-20:00\n`;

      await this.bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    } catch (error: any) {
      await this.bot.sendMessage(chatId, '❌ Errore nella generazione del report');
    }
  }

  private async sendContentSuggestions(chatId: number) {
    try {
      await this.bot.sendMessage(chatId, '🤔 Analizzo i trend e genero suggerimenti...');

      // Generate AI suggestions
      const suggestions = await this.contentGenerator.generateContentSuggestions({
        industry: 'general',
        tone: 'professional',
        platforms: ['facebook', 'instagram', 'twitter', 'linkedin']
      });

      let message = '💡 *Suggerimenti Contenuti*\n\n';
      
      suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. *${suggestion.topic}*\n`;
        message += `📝 ${suggestion.preview}\n`;
        message += `🏷️ ${suggestion.hashtags.join(' ')}\n`;
        message += `📱 Ideale per: ${suggestion.platforms.join(', ')}\n\n`;
      });

      message += 'Usa /newpost per creare un post basato su questi suggerimenti!';

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error: any) {
      await this.bot.sendMessage(chatId, '❌ Errore nella generazione dei suggerimenti');
    }
  }

  private async sendPendingPosts(chatId: number, action: string) {
    const pendingPosts = Array.from(this.pendingPosts.values())
      .filter(post => post.status === 'pending');

    if (pendingPosts.length === 0) {
      await this.bot.sendMessage(chatId, '📭 Nessun post in attesa');
      return;
    }

    let message = action === 'approve' 
      ? '✅ *Post in attesa di approvazione:*\n\n'
      : '❌ *Seleziona post da rifiutare:*\n\n';

    const keyboard: any[] = [];

    pendingPosts.forEach((post, index) => {
      message += `${index + 1}. "${post.content.substring(0, 50)}..."\n`;
      message += `📱 ${post.platforms.join(', ')}\n\n`;
      
      keyboard.push([{
        text: `${index + 1}. ${post.content.substring(0, 30)}...`,
        callback_data: `${action}_${post.id}`
      }]);
    });

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  private async approvePost(postId: string, chatId: number) {
    const post = this.pendingPosts.get(postId);
    if (!post) {
      await this.bot.sendMessage(chatId, '❌ Post non trovato');
      return;
    }

    post.status = 'approved';
    this.pendingPosts.set(postId, post);

    await this.bot.sendMessage(chatId, 
      `✅ Post approvato!

Vuoi pubblicarlo ora o programmarlo?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🚀 Pubblica ora', callback_data: `publish_${postId}` },
              { text: '📅 Programma', callback_data: `schedule_${postId}` }
            ]
          ]
        }
      }
    );
  }

  private async rejectPost(postId: string, chatId: number) {
    const post = this.pendingPosts.get(postId);
    if (!post) {
      await this.bot.sendMessage(chatId, '❌ Post non trovato');
      return;
    }

    this.pendingPosts.delete(postId);
    await this.bot.sendMessage(chatId, '❌ Post rifiutato ed eliminato');
  }

  private async schedulePost(postId: string, chatId: number) {
    const post = this.pendingPosts.get(postId);
    if (!post) return;

    const userId = post.userId;
    this.userStates.set(userId, { 
      action: 'scheduling_post', 
      step: 'select_date',
      postId 
    });

    await this.bot.sendMessage(chatId, 
      '📅 Quando vuoi pubblicare questo post?\n\nInvia data e ora nel formato: DD/MM/YYYY HH:MM\n\nEsempio: 25/12/2024 15:30'
    );
  }

  private async handlePostScheduling(msg: TelegramBot.Message, state: any) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id || 0;
    const text = msg.text || '';

    if (state.step === 'select_date') {
      // Parse date
      const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (!dateMatch) {
        await this.bot.sendMessage(chatId, '❌ Formato data non valido. Usa: DD/MM/YYYY HH:MM');
        return;
      }

      const [_, day, month, year, hour, minute] = dateMatch;
      const scheduledDate = new Date(
        parseInt(year), 
        parseInt(month) - 1, 
        parseInt(day), 
        parseInt(hour), 
        parseInt(minute)
      );

      if (scheduledDate < new Date()) {
        await this.bot.sendMessage(chatId, '❌ Non puoi programmare un post nel passato!');
        return;
      }

      const post = this.pendingPosts.get(state.postId);
      if (post) {
        post.scheduledTime = scheduledDate;
        post.status = 'scheduled';
        
        // Save to database
        await supabase.from('posts').insert({
          content: post.content,
          platforms: post.platforms,
          status: 'scheduled',
          scheduled_time: scheduledDate.toISOString(),
          telegram_user_id: post.userId
        });

        await this.bot.sendMessage(chatId, 
          `✅ Post programmato per il ${scheduledDate.toLocaleDateString('it-IT')} alle ${scheduledDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
        );

        this.pendingPosts.delete(state.postId);
      }

      this.userStates.delete(userId);
    }
  }

  private async handlePlatformSelection(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    const userId = query.from.id;
    const state = this.userStates.get(userId);
    if (!state || state.action !== 'creating_post') return;

    const platform = query.data?.replace('platform_', '');

    if (platform === 'done') {
      state.step = 'hashtags';
      this.userStates.set(userId, state);

      await this.bot.sendMessage(chatId, 
        '🏷️ Aggiungi hashtags (separati da spazio):\n\nEsempio: #socialmedia #marketing #business'
      );
    } else if (platform === 'all') {
      state.platforms = ['facebook', 'instagram', 'twitter', 'linkedin'];
      state.step = 'hashtags';
      this.userStates.set(userId, state);

      await this.bot.sendMessage(chatId, 
        '✅ Tutte le piattaforme selezionate!\n\n🏷️ Ora aggiungi gli hashtags:'
      );
    } else {
      if (!state.platforms) state.platforms = [];
      
      if (state.platforms.includes(platform!)) {
        state.platforms = state.platforms.filter((p: string) => p !== platform);
      } else {
        state.platforms.push(platform!);
      }
      
      this.userStates.set(userId, state);

      // Update message with current selection
      const currentPlatforms = state.platforms.length > 0 
        ? `Selezionate: ${state.platforms.join(', ')}` 
        : 'Nessuna piattaforma selezionata';
      
      await this.bot.answerCallbackQuery(query.id, { text: currentPlatforms });
    }
  }

  private async handleCalendarAction(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    const action = query.data?.replace('cal_', '');
    
    switch (action) {
      case 'add':
        await this.bot.sendMessage(chatId, 'Usa /newpost per aggiungere un nuovo post al calendario');
        break;
      case 'edit':
        await this.sendEditableCalendar(chatId);
        break;
      case 'export':
        await this.exportCalendar(chatId);
        break;
    }
  }

  private async sendEditableCalendar(chatId: number) {
    // Implementation for editable calendar
    await this.bot.sendMessage(chatId, '📅 Funzione calendario modificabile in sviluppo...');
  }

  private async exportCalendar(chatId: number) {
    // Implementation for calendar export
    await this.bot.sendMessage(chatId, '📤 Funzione esportazione calendario in sviluppo...');
  }

  private async handleCalendarEdit(msg: TelegramBot.Message, state: any) {
    // Implementation for calendar editing
  }

  private async handlePhotoUpload(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    
    if (!msg.photo || msg.photo.length === 0) return;
    
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;

    await this.bot.sendMessage(chatId, 
      `📷 Immagine ricevuta!

Cosa vuoi fare con questa immagine?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📝 Aggiungi testo e pubblica', callback_data: `photo_add_text_${fileId}` },
              { text: '🚀 Pubblica solo immagine', callback_data: `photo_publish_${fileId}` }
            ],
            [
              { text: '💾 Salva per dopo', callback_data: `photo_save_${fileId}` }
            ]
          ]
        }
      }
    );
  }

  // Webhook handler for Zapier integration
  async handleZapierWebhook(data: any): Promise<any> {
    try {
      const { action, content, platforms, scheduledTime, userId } = data;

      switch (action) {
        case 'create_post':
          const postId = Date.now().toString();
          const post: PendingPost = {
            id: postId,
            content,
            platforms: platforms || ['facebook', 'instagram', 'twitter', 'linkedin'],
            hashtags: content.match(/#\w+/g) || [],
            userId: userId || 0,
            chatId: 0, // Will be set when user interacts
            status: 'pending',
            scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined
          };

          this.pendingPosts.set(postId, post);

          // Notify admins
          const admins = process.env.TELEGRAM_ADMIN_IDS?.split(',') || [];
          for (const adminId of admins) {
            await this.bot.sendMessage(parseInt(adminId), 
              `🔔 Nuovo post da Zapier:\n\n"${content.substring(0, 100)}..."\n\nUsa /approve per approvare`
            );
          }

          return { success: true, postId };

        case 'get_stats':
          return await this.socialMediaManager.getStats();

        case 'get_calendar':
          const { data: posts } = await supabase
            .from('posts')
            .select('*')
            .gte('scheduled_time', new Date().toISOString())
            .order('scheduled_time', { ascending: true });
          
          return { success: true, posts };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
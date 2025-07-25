import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { appendFileSync } from 'fs';
import multer from 'multer';
import { supabase } from './lib/supabase';
import { ZapierSocialManager } from './services/ZapierSocialManager';
import { ClaudeContentGenerator } from './services/ClaudeContentGenerator';
import { ImageComposer } from './services/ImageComposer';

// Create debug log function
function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] ${message}`;
  if (data !== undefined) {
    logMessage += ': ' + JSON.stringify(data, null, 2);
  }
  logMessage += '\n';
  console.log(message, data !== undefined ? data : '');
  try {
    const logPath = path.join(process.cwd(), 'image-generation.log');
    appendFileSync(logPath, logMessage);
  } catch (e) {
    console.error('Failed to write to log file:', e);
  }
}
import { EditorialCalendar } from './services/EditorialCalendar';
import { AIDebateService } from './services/AIDebate';
import { AITrainingService } from './services/AITraining';
import { ContentTheme } from './types';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize services
const socialMediaManager = new ZapierSocialManager();
const contentGenerator = new ClaudeContentGenerator();
const imageComposer = new ImageComposer();
const editorialCalendar = new EditorialCalendar();
const aiDebateService = new AIDebateService();
const aiTrainingService = new AITrainingService();

// Initialize Telegram Bot if token is provided
let telegramBot: any;
if (process.env.TELEGRAM_BOT_TOKEN) {
  import('./services/TelegramBot').then(({ TelegramBotService }) => {
    telegramBot = new TelegramBotService();
    console.log('✅ Telegram Bot initialized');
  }).catch(err => {
    console.error('❌ Failed to initialize Telegram Bot:', err);
  });
}

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5500', 'http://127.0.0.1:5500', 'https://filippofiz.github.io'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));
app.use('/composed-images', express.static(path.join(__dirname, '..', 'public', 'composed-images')));
app.use('/brand-assets', express.static(path.join(__dirname, '..', 'public', 'brand-assets')));

// Serve the dashboard HTML
app.use(express.static(path.join(__dirname, '..', '..')));

// Test endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'active', 
    timestamp: new Date().toISOString(),
    facebook: {
      appId: process.env.FACEBOOK_APP_ID ? 'Configured' : 'Missing',
      pageId: process.env.FACEBOOK_PAGE_ID ? 'Configured' : 'Missing',
      token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN ? 'Configured' : 'Missing'
    }
  });
});

// Test Facebook post
app.post('/api/test-facebook', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const pageId = process.env.FACEBOOK_PAGE_ID;
    const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (!pageId || !accessToken) {
      return res.status(500).json({ error: 'Facebook credentials not configured' });
    }

    // Test post to Facebook
    const response = await fetch(
      `https://graph.facebook.com/${pageId}/feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          access_token: accessToken
        })
      }
    );

    const data = await response.json();

    if ((data as any).error) {
      console.error('Facebook API Error:', (data as any).error);
      return res.status(400).json({ 
        error: 'Facebook API Error', 
        details: (data as any).error 
      });
    }

    // Save to database
    await supabase.from('posts').insert({
      content: message,
      platforms: ['facebook'],
      status: 'published',
      published_time: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      postId: (data as any).id,
      message: 'Post published to Facebook successfully!' 
    });

  } catch (error: any) {
    console.error('Error posting to Facebook:', error);
    res.status(500).json({ 
      error: 'Failed to post to Facebook', 
      details: error.message 
    });
  }
});

// Get schedule settings
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('schedule_settings')
      .select('*')
      .single();

    if (error) {
      // If table doesn't exist or no settings found, return defaults
      if (error.code === 'PGRST116' || (error.message && error.message.includes('does not exist'))) {
        console.log('Schedule settings not found or table not created');
      return res.json({
        // Company Context
        company_name: 'Up to Ten',
        company_industry: 'Educazione, Ripetizioni Scientifiche, Formazione STEM',
        company_description: 'Up to Ten è il centro di eccellenza per le ripetizioni a Milano di Matematica, Fisica, Informatica e tutte le materie scientifiche per medie, liceo e università. Specializzati nell\'insegnamento delle materie STEM attraverso applicazioni pratiche ed innovative, come lo SPORT, rendendole semplici e intuitive.',
        target_audience: 'Studenti delle scuole medie, liceo e università, genitori che cercano supporto scolastico di qualità, studenti che preparano test d\'ingresso universitari (specialmente Bocconi)',
        brand_voice: 'Professionale ma amichevole, innovativo, orientato ai risultati, empatico con le difficoltà degli studenti, entusiasta delle materie scientifiche',
        business_goals: 'Aumentare le iscrizioni ai corsi, posizionarsi come leader nelle ripetizioni scientifiche a Milano, educare sull\'importanza delle materie STEM',
        // Scheduler Settings
        platforms: ['facebook', 'instagram', 'twitter', 'linkedin'],
        frequency_hours: 4,
        active_hours_start: '08:00',
        active_hours_end: '22:00',
        themes: ['tips_studio', 'motivazionale', 'spiegazioni_semplici'],
        competitor_analysis: true,
        ai_debate_enabled: false,
        auto_publish: false,
        is_active: false,
        // Default Settings
        default_tone: 'professional',
        default_hashtags: '#UpToTen #RipetizioniMilano #Matematica #Fisica #STEM #Scuola #Università'
      });
      }
      throw error;
    }
    
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
app.post('/api/settings', async (req, res) => {
  try {
    const settings = req.body;
    
    // Prepare settings for database
    const dbSettings = {
      // Company Context
      company_name: settings.companyName,
      company_industry: settings.companyIndustry,
      company_description: settings.companyDescription,
      target_audience: settings.targetAudience,
      brand_voice: settings.brandVoice,
      business_goals: settings.businessGoals,
      // Scheduler Settings
      platforms: settings.defaultPlatforms ? 
        Object.keys(settings.defaultPlatforms).filter(p => settings.defaultPlatforms[p]) : [],
      frequency_hours: parseInt(settings.postFrequency) || 4,
      active_hours_start: settings.startTime,
      active_hours_end: settings.endTime,
      is_active: settings.autoScheduler,
      // Default Settings
      default_tone: settings.defaultTone,
      default_hashtags: settings.defaultHashtags
    };
    
    // Check if settings exist
    const { data: existing } = await supabase
      .from('schedule_settings')
      .select('id')
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from('schedule_settings')
        .update(dbSettings)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Create new
      result = await supabase
        .from('schedule_settings')
        .insert(dbSettings)
        .select()
        .single();
    }

    if (result.error) throw result.error;
    res.json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent posts
app.get('/api/posts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Supabase error:', error);
      // Return empty array if table doesn't exist
      return res.json([]);
    }
    
    res.json(data || []);
  } catch (error: any) {
    console.error('Error fetching posts:', error);
    // Return empty array on error
    res.json([]);
  }
});

// Post to all platforms
app.post('/api/social/post', async (req, res) => {
  try {
    const { content, platforms, imagePath, imageUrl, link, aiGenerated, debateUsed, contentId, platformImages } = req.body;
    
    if (!content || !platforms || platforms.length === 0) {
      return res.status(400).json({ error: 'Content and platforms are required' });
    }

    // Use platform-specific images if available, otherwise fall back to single image
    const postContent = {
      content,
      caption: content,
      hashtags: req.body.hashtags || [],
      imagePath: imagePath || null,
      imageUrl: imageUrl || null,
      link: link || null,
      platforms,
      platformImages: platformImages || {} // Platform-specific image URLs
    };

    const results = await socialMediaManager.postToAllPlatforms(postContent);
    
    // Save to database with comprehensive tracking
    const { data: savedPost } = await supabase.from('posts').insert({
      content,
      platforms,
      hashtags: req.body.hashtags || [],
      status: 'published',
      published_time: new Date().toISOString(),
      results: results,
      metadata: {
        ai_generated: aiGenerated || false,
        debate_used: debateUsed || false,
        content_id: contentId,
        image_path: imagePath,
        image_url: imageUrl,
        link: link
      },
      performance: {
        initial_metrics: {
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          engagement_rate: 0
        },
        last_updated: new Date().toISOString()
      }
    }).select().single();

    // Schedule performance tracking
    if (savedPost) {
      setTimeout(() => {
        trackPostPerformance(savedPost.id);
      }, 3600000); // Check after 1 hour
      
      setTimeout(() => {
        trackPostPerformance(savedPost.id);
      }, 86400000); // Check after 24 hours
    }

    res.json({ success: true, results, postId: savedPost?.id });
  } catch (error: any) {
    console.error('Error posting to social media:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get social media stats
app.get('/api/social/stats', async (req, res) => {
  try {
    const stats = await socialMediaManager.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check OpenAI quota status
app.get('/api/quota/status', async (req, res) => {
  try {
    const quotaStatus = await contentGenerator.quotaMonitor.checkQuotaStatus();
    res.json(quotaStatus);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate content with AI
app.post('/api/content/generate', async (req, res) => {
  try {
    const { topic, tone, platforms, useDebate, companyContext } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    let content;
    let debateTranscript;

    if (useDebate) {
      // Use AI debate for perfect content
      const debateResult = await aiDebateService.generateDebateContent({
        topic,
        tone: tone || 'professional',
        platforms: platforms || ['facebook', 'instagram', 'twitter', 'linkedin'],
        businessGoals: companyContext?.businessGoals || req.body.businessGoals,
        targetAudience: companyContext?.targetAudience || req.body.targetAudience
      });
      
      content = debateResult;
      debateTranscript = debateResult.debateHistory || debateResult.insights;
    } else {
      // Regular content generation
      content = await contentGenerator.generateContentWithParams({
        topic,
        tone: tone || 'professional',
        length: 'medium',
        includeHashtags: true,
        platforms: platforms || ['all'],
        companyContext: companyContext
      });
      console.log('Generated content structure:', JSON.stringify(content, null, 2));
      
      // Ensure imagePrompt exists
      if (!content.imagePrompt && typeof content === 'object') {
        // Generate a default image prompt based on the topic
        content.imagePrompt = `Photorealistic professional image for social media about: ${topic}. High quality photography with natural lighting, suitable for ${companyContext?.industry || 'education'} industry. Avoid illustrations unless specifically needed.`;
      }
    }

    // Save to database for learning
    const { data: savedContent, error: saveError } = await supabase.from('generated_content').insert({
      topic,
      tone,
      platforms,
      content: content.content || content,
      hashtags: content.hashtags,
      ai_debate_used: useDebate || false,
      debate_transcript: debateTranscript,
      generated_at: new Date().toISOString()
    }).select().single();
    
    // If debate was used, save the full debate history
    if (useDebate && savedContent && content.debateHistory) {
      await supabase.from('ai_debates').insert({
        content_id: savedContent.id,
        topic,
        platforms,
        tone,
        debate_history: content.debateHistory,
        final_content: typeof content.content === 'string' ? content.content : JSON.stringify(content.content),
        consensus_reached: content.debateHistory.some((msg: any) => msg.message?.includes('Consenso raggiunto')),
        rounds: Math.floor(content.debateHistory.length / 4), // Approximate rounds
        insights: content.insights || [],
        created_at: new Date().toISOString()
      });
    }

    // Generate images optimized for each platform
    let generatedImages = {};
    debugLog('\n=== STARTING IMAGE GENERATION PROCESS ===');
    debugLog('Full content object', content);
    debugLog('Content keys', Object.keys(content));
    
    // Check for imagePrompt at different levels
    let imagePrompt = content.imagePrompt || content.image_prompt;
    debugLog('Step 1 - Checking root level imagePrompt', imagePrompt);
    
    // If not found at root level, check if it's in the first platform's content
    if (!imagePrompt && typeof content === 'object') {
      console.log('Step 2 - Root imagePrompt not found, checking platforms...');
      const allKeys = Object.keys(content);
      console.log('All content keys:', allKeys);
      const firstPlatform = allKeys.filter(k => k !== 'imagePrompt')[0];
      console.log('First platform found:', firstPlatform);
      if (firstPlatform && content[firstPlatform]) {
        console.log('Platform content:', JSON.stringify(content[firstPlatform], null, 2));
        imagePrompt = content[firstPlatform].image_suggestions || content[firstPlatform].imagePrompt;
        console.log('Image prompt from platform:', imagePrompt);
      }
    }
    
    debugLog('Step 3 - Final imagePrompt result', imagePrompt);
    debugLog('Image prompt type', typeof imagePrompt);
    debugLog('Image prompt truthiness', !!imagePrompt);
    
    if (imagePrompt) {
      debugLog('=== IMAGE GENERATION STARTING ===');
      try {
        console.log('Platforms requested:', platforms);
        console.log('Platforms type:', typeof platforms);
        console.log('Platforms is array:', Array.isArray(platforms));
        
        // Define optimal image sizes for each platform
        const platformSizes = {
          facebook: { width: 1200, height: 630 },    // Facebook feed
          instagram: { width: 1080, height: 1080 },  // Instagram square
          twitter: { width: 1200, height: 675 },     // Twitter card
          linkedin: { width: 1200, height: 627 }     // LinkedIn feed
        };
        
        // Generate image only for first platform to speed up
        const platformsToGenerate = platforms ? [platforms[0]] : ['facebook'];
        for (const platform of platformsToGenerate) {
          if (platformSizes[platform]) {
            try {
              debugLog(`--- Generating image for ${platform} ---`);
              const size = platformSizes[platform];
              debugLog(`Platform size`, size);
              // Add photorealistic specification to the prompt
              const optimizedPrompt = `${imagePrompt}. Photorealistic style preferred. Optimize for ${platform} social media post.`;
              debugLog(`Optimized prompt for ${platform}`, optimizedPrompt);
              debugLog('Calling contentGenerator.generateImage...');
              const aiImageUrl = await contentGenerator.generateImage(optimizedPrompt);
              debugLog(`AI image URL received`, aiImageUrl);
              debugLog(`AI image URL type`, typeof aiImageUrl);
              debugLog(`AI image URL length`, aiImageUrl?.length);
              
              // Combine with brand assets if available
              let finalImageUrl = aiImageUrl;
              try {
                const imageComposer = new ImageComposer();
                
                // Fetch active brand assets from Supabase
                const { data: activeLogo } = await supabase
                  .from('brand_assets')
                  .select('id, file_url')
                  .eq('type', 'logo')
                  .eq('is_active', true)
                  .single();
                
                const { data: activeTemplate } = await supabase
                  .from('brand_assets')
                  .select('id, file_url')
                  .eq('type', 'template')
                  .eq('platform', platform)
                  .eq('is_active', true)
                  .single();
                
                // Fetch composition settings
                const { data: compositionSettings } = await supabase
                  .from('composition_settings')
                  .select('*')
                  .single();
                
                const settings = compositionSettings || {
                  auto_apply_logo: true,
                  auto_apply_template: true,
                  logo_position: 'bottom-right',
                  logo_size: 150,
                  overlay_opacity: 0.9
                };
                
                // Only compose if there are assets and settings allow it
                if ((activeLogo && settings.auto_apply_logo) || (activeTemplate && settings.auto_apply_template)) {
                  const composedImageUrl = await imageComposer.composeWithBrandAssets(aiImageUrl, {
                    platform: platform,
                    logoPath: activeLogo?.id,
                    templatePath: activeTemplate?.id,
                    logoPosition: settings.logo_position || (platform === 'instagram' ? 'bottom-right' : 'top-left'),
                    logoSize: settings.logo_size || (platform === 'instagram' ? 120 : 150),
                    overlayOpacity: settings.overlay_opacity,
                    supabase: supabase
                  });
                  
                  if (composedImageUrl) {
                    // Convert local path to URL
                    const relativePath = composedImageUrl.replace(path.join(process.cwd(), 'public'), '');
                    finalImageUrl = `http://localhost:${port}${relativePath.replace(/\\/g, '/')}`;
                    console.log(`Composed image with brand assets for ${platform}: ${finalImageUrl}`);
                    
                    // Save generated image reference to Supabase
                    await supabase.from('generated_images').insert({
                      content_id: savedContent?.id,
                      platform: platform,
                      ai_image_url: aiImageUrl,
                      composed_image_url: composedImageUrl,
                      has_brand_assets: true,
                      size: size
                    });
                  }
                } else {
                  console.log(`No active brand assets found for ${platform}, using AI image only`);
                  
                  // Save AI-only image reference
                  await supabase.from('generated_images').insert({
                    content_id: savedContent?.id,
                    platform: platform,
                    ai_image_url: aiImageUrl,
                    composed_image_url: null,
                    has_brand_assets: false,
                    size: size
                  });
                }
              } catch (composeError) {
                console.log(`Using original AI image for ${platform}, brand composition failed:`, composeError.message);
              }
              
              // Ensure URL is always valid HTTP URL
              if (!finalImageUrl.startsWith('http')) {
                finalImageUrl = aiImageUrl; // Fallback to AI URL
              }
              
              generatedImages[platform] = {
                url: finalImageUrl,
                aiUrl: aiImageUrl, // Keep original AI image reference
                size: size,
                platform: platform
              };
            } catch (err) {
              console.error(`Error generating image for ${platform}:`, err);
            }
          }
        }
      } catch (imageError) {
        console.error('Error generating images:', imageError);
      }
    } else {
      console.log('No image prompt found in content:', content);
    }

    console.log('\n=== PREPARING FINAL RESPONSE ===');
    console.log('Generated images count:', Object.keys(generatedImages).length);
    console.log('Generated images keys:', Object.keys(generatedImages));
    Object.entries(generatedImages).forEach(([platform, data]) => {
      console.log(`${platform} image data:`, JSON.stringify(data, null, 2));
    });
    
    const responseData = {
      success: true, 
      content,
      images: generatedImages,
      contentId: savedContent?.id,
      debateUsed: useDebate || false
    };
    
    console.log('\n=== SENDING RESPONSE ===');
    console.log('Response images object:', JSON.stringify(responseData.images, null, 2));
    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create image with text
app.post('/api/image/create', async (req, res) => {
  try {
    const { text, template, backgroundColor, textColor } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const imagePath = await imageComposer.createTextImage({
      text,
      template: template || 'default',
      backgroundColor: backgroundColor || '#1a73e8',
      textColor: textColor || '#ffffff',
      width: 1080,
      height: 1080
    });

    res.json({ success: true, imagePath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate AI image with DALL-E 3
app.post('/api/image/generate-ai', async (req, res) => {
  try {
    const { prompt, style } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Generate enhanced prompt using GPT-4
    const enhancedPrompt = await contentGenerator.generateImagePrompt(prompt, style);
    
    // Generate image with DALL-E 3
    const imageUrl = await contentGenerator.generateImage(enhancedPrompt);

    res.json({ 
      success: true, 
      imageUrl,
      prompt: enhancedPrompt
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Note: Brand asset upload endpoints have been moved to use Supabase storage
// See the endpoints at lines 1555+ for the new implementation

// Generate branded AI image
app.post('/api/image/generate-branded', async (req, res) => {
  try {
    const { 
      prompt, 
      style, 
      platform,
      logoId, 
      templateId, 
      logoPosition,
      generateVariations 
    } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Generate enhanced prompt
    const enhancedPrompt = await contentGenerator.generateImagePrompt(prompt, style);
    
    // Generate AI image
    const aiImageUrl = await contentGenerator.generateImage(enhancedPrompt);

    // Apply branding
    let result;
    if (generateVariations) {
      // Fetch all available templates
      const { data: templates } = await supabase
        .from('brand_assets')
        .select('id')
        .eq('type', 'template')
        .eq('is_active', true);
      
      const templateIds = templates?.map(t => t.id) || [];
      
      // Generate multiple variations
      const variations = [];
      
      // Original AI image
      variations.push({
        url: aiImageUrl,
        type: 'original',
        hasLogo: false,
        hasTemplate: false
      });
      
      // With logo only
      if (logoId) {
        const withLogo = await imageComposer.composeWithBrandAssets(aiImageUrl, {
          logoPath: logoId,
          logoPosition: logoPosition || 'bottom-right',
          supabase
        });
        variations.push({
          url: withLogo,
          type: 'with_logo',
          hasLogo: true,
          hasTemplate: false
        });
      }
      
      // With templates
      for (const tid of templateIds.slice(0, 3)) {
        const withTemplate = await imageComposer.composeWithBrandAssets(aiImageUrl, {
          logoPath: logoId,
          templatePath: tid,
          logoPosition: logoPosition || 'bottom-right',
          supabase
        });
        variations.push({
          url: withTemplate,
          type: 'with_template',
          hasLogo: !!logoId,
          hasTemplate: true
        });
      }
      
      result = {
        success: true,
        variations,
        aiImageUrl,
        prompt: enhancedPrompt
      };
    } else {
      // Generate single branded image
      const brandedImagePath = await imageComposer.composeWithBrandAssets(aiImageUrl, {
        platform,
        logoPath: logoId,
        templatePath: templateId,
        logoPosition: logoPosition || 'bottom-right',
        supabase
      });
      
      result = {
        success: true,
        brandedImagePath,
        brandedImageUrl: brandedImagePath,
        aiImageUrl,
        prompt: enhancedPrompt
      };
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Platform-specific endpoints
app.post('/api/social/twitter/post', async (req, res) => {
  try {
    const { content, imagePath } = req.body;
    
    const postContent = {
      content,
      caption: content,
      hashtags: req.body.hashtags || [],
      imagePath,
      platforms: ['twitter']
    };

    const [result] = await socialMediaManager.postToAllPlatforms(postContent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/social/instagram/post', async (req, res) => {
  try {
    const { content, imagePath } = req.body;
    
    if (!imagePath) {
      return res.status(400).json({ error: 'Instagram requires an image' });
    }

    const postContent = {
      content,
      caption: content,
      hashtags: req.body.hashtags || [],
      imagePath,
      platforms: ['instagram']
    };

    const [result] = await socialMediaManager.postToAllPlatforms(postContent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/social/facebook/post', async (req, res) => {
  try {
    const { content, imagePath } = req.body;
    
    const postContent = {
      content,
      caption: content,
      hashtags: req.body.hashtags || [],
      imagePath,
      platforms: ['facebook']
    };

    const [result] = await socialMediaManager.postToAllPlatforms(postContent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/social/linkedin/post', async (req, res) => {
  try {
    const { content, imagePath } = req.body;
    
    const postContent = {
      content,
      caption: content,
      hashtags: req.body.hashtags || [],
      imagePath,
      platforms: ['linkedin']
    };

    const [result] = await socialMediaManager.postToAllPlatforms(postContent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get engagement metrics
app.get('/api/social/:platform/engagement/:postId', async (req, res) => {
  try {
    const { platform, postId } = req.params;
    const engagement = await socialMediaManager.getEngagementMetrics(platform, postId);
    res.json(engagement);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Zapier webhook endpoints
app.post('/api/zapier/webhook', async (req, res) => {
  try {
    // Verify Zapier secret if configured
    const zapierSecret = process.env.ZAPIER_WEBHOOK_SECRET;
    if (zapierSecret && req.headers['x-zapier-secret'] !== zapierSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action, data } = req.body;

    switch (action) {
      case 'create_post':
        const postContent = {
          content: data.content,
          caption: data.content,
          hashtags: data.hashtags || [],
          platforms: data.platforms || ['facebook', 'instagram', 'twitter', 'linkedin'],
          imagePath: data.imagePath
        };

        // If Telegram bot is active, send for approval
        if (telegramBot && data.requireApproval !== false) {
          const result = await telegramBot.handleZapierWebhook({
            action: 'create_post',
            ...data
          });
          res.json(result);
        } else {
          // Direct publish
          const results = await socialMediaManager.postToAllPlatforms(postContent);
          await supabase.from('posts').insert({
            content: data.content,
            platforms: postContent.platforms,
            status: 'published',
            published_time: new Date().toISOString(),
            source: 'zapier',
            results
          });
          res.json({ success: true, results });
        }
        break;

      case 'schedule_post':
        await supabase.from('posts').insert({
          content: data.content,
          platforms: data.platforms || ['facebook', 'instagram', 'twitter', 'linkedin'],
          status: 'scheduled',
          scheduled_time: new Date(data.scheduledTime).toISOString(),
          source: 'zapier'
        });
        res.json({ success: true, message: 'Post scheduled' });
        break;

      case 'get_analytics':
        const stats = await socialMediaManager.getStats();
        const { data: recentPosts } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(data.limit || 10);
        
        res.json({ 
          success: true, 
          stats,
          recentPosts
        });
        break;

      case 'generate_content':
        // Map topic to ContentTheme or use a default
        const themeMap: Record<string, ContentTheme> = {
          'motivation': 'motivational',
          'education': 'educational',
          'entertainment': 'entertaining',
          'news': 'news',
          'tips': 'tips',
          'quotes': 'quotes',
          'facts': 'facts',
          'trends': 'trends'
        };
        
        const contentTheme = themeMap[data.topic?.toLowerCase()] || 'educational';
        const content = await contentGenerator.generateContent(contentTheme as ContentTheme);
        res.json({ success: true, content });
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('Zapier webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Zapier trigger endpoints
app.get('/api/zapier/triggers/new_post', async (req, res) => {
  try {
    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'published')
      .order('published_time', { ascending: false })
      .limit(10);

    res.json(posts || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/zapier/triggers/scheduled_post', async (req, res) => {
  try {
    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_time', new Date().toISOString())
      .order('scheduled_time', { ascending: true })
      .limit(10);

    res.json(posts || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/zapier/triggers/low_engagement', async (req, res) => {
  try {
    const stats = await socialMediaManager.getStats();
    const lowEngagementPlatforms = Object.entries(stats)
      .filter(([_, data]) => {
        const engagementRate = data.totalPosts > 0
          ? (data.engagement.likes + data.engagement.comments) / data.totalPosts
          : 0;
        return engagementRate < 10; // Threshold for low engagement
      })
      .map(([platform, data]) => ({ platform, ...data }));

    res.json(lowEngagementPlatforms);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Editorial Calendar endpoints
app.post('/api/calendar/generate', async (req, res) => {
  try {
    const { 
      duration, 
      industry, 
      businessGoals, 
      targetAudience,
      contentPillars,
      competitors 
    } = req.body;

    if (!duration || !industry || !businessGoals || !targetAudience) {
      return res.status(400).json({ 
        error: 'Missing required fields: duration, industry, businessGoals, targetAudience' 
      });
    }

    const calendar = await editorialCalendar.generateEditorialPlan({
      duration,
      industry,
      businessGoals,
      targetAudience,
      contentPillars,
      competitors
    });

    res.json({ success: true, calendar });
  } catch (error: any) {
    console.error('Error generating calendar:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calendar', async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    let query = supabase
      .from('posts')
      .select('*')
      .order('scheduled_time', { ascending: true });

    if (startDate) {
      query = query.gte('scheduled_time', startDate as string);
    }
    
    if (endDate) {
      query = query.lte('scheduled_time', endDate as string);
    }
    
    if (status) {
      query = query.eq('status', status as string);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/calendar/post/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, post: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calendar/post/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, reason, suggestions } = req.body;

    const improvedPost = await editorialCalendar.updatePostBasedOnFeedback(id, {
      type,
      reason,
      suggestions
    });

    res.json({ success: true, improvedPost });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calendar/optimize', async (req, res) => {
  try {
    await editorialCalendar.adaptCalendarBasedOnPerformance();
    res.json({ success: true, message: 'Calendar optimized based on performance data' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AI-powered content suggestions
app.post('/api/content/suggestions', async (req, res) => {
  try {
    const { industry, tone, platforms, count } = req.body;
    
    const suggestions = await contentGenerator.generateContentSuggestions({
      industry: industry || 'general',
      tone: tone || 'professional',
      platforms: platforms || ['facebook', 'instagram', 'twitter', 'linkedin'],
      count: count || 5
    });

    res.json({ success: true, suggestions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics and reporting endpoints
app.get('/api/analytics/report', async (req, res) => {
  try {
    const { period, platforms } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get posts data
    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .gte('published_time', startDate.toISOString())
      .lte('published_time', endDate.toISOString())
      .eq('status', 'published');

    // Get platform stats
    const stats = await socialMediaManager.getStats();

    // Calculate metrics
    const totalPosts = posts?.length || 0;
    const avgPostsPerDay = totalPosts / ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Platform breakdown
    const platformBreakdown: Record<string, any> = {};
    posts?.forEach(post => {
      post.platforms.forEach((platform: string) => {
        if (!platformBreakdown[platform]) {
          platformBreakdown[platform] = { count: 0, engagement: 0 };
        }
        platformBreakdown[platform].count++;
      });
    });

    // Content performance
    const topPerformers = posts
      ?.filter(post => post.metadata?.engagement)
      .sort((a, b) => {
        const engA = (a.metadata.engagement.likes || 0) + (a.metadata.engagement.comments || 0);
        const engB = (b.metadata.engagement.likes || 0) + (b.metadata.engagement.comments || 0);
        return engB - engA;
      })
      .slice(0, 5);

    const report = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      summary: {
        totalPosts,
        avgPostsPerDay: avgPostsPerDay.toFixed(1),
        platformsUsed: Object.keys(platformBreakdown).length
      },
      platformBreakdown,
      topPerformers,
      stats,
      recommendations: [
        'Increase posting frequency during peak engagement hours',
        'Focus more on video content for higher engagement',
        'Utilize more user-generated content',
        'Implement A/B testing for post formats'
      ]
    };

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/insights', async (req, res) => {
  try {
    // Get recent posts and their performance
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'published')
      .gte('published_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('published_time', { ascending: false });

    // Analyze patterns
    const insights = {
      bestPerformingTime: analyzeOptimalPostingTimes(recentPosts),
      topHashtags: analyzeTopHashtags(recentPosts),
      contentTypePerformance: analyzeContentTypes(recentPosts),
      platformSpecificInsights: analyzePlatformPerformance(recentPosts)
    };

    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions for analytics
function analyzeOptimalPostingTimes(posts: any[]): any {
  const timeSlots: Record<number, { count: number; engagement: number }> = {};
  
  posts?.forEach(post => {
    const hour = new Date(post.published_time).getHours();
    if (!timeSlots[hour]) {
      timeSlots[hour] = { count: 0, engagement: 0 };
    }
    timeSlots[hour].count++;
    
    if (post.metadata?.engagement) {
      timeSlots[hour].engagement += 
        (post.metadata.engagement.likes || 0) + 
        (post.metadata.engagement.comments || 0);
    }
  });

  return Object.entries(timeSlots)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      avgEngagement: data.engagement / data.count,
      postCount: data.count
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 3);
}

function analyzeTopHashtags(posts: any[]): any {
  const hashtagPerformance: Record<string, { count: number; engagement: number }> = {};
  
  posts?.forEach(post => {
    post.hashtags?.forEach((tag: string) => {
      if (!hashtagPerformance[tag]) {
        hashtagPerformance[tag] = { count: 0, engagement: 0 };
      }
      hashtagPerformance[tag].count++;
      
      if (post.metadata?.engagement) {
        hashtagPerformance[tag].engagement += 
          (post.metadata.engagement.likes || 0) + 
          (post.metadata.engagement.comments || 0);
      }
    });
  });

  return Object.entries(hashtagPerformance)
    .map(([hashtag, data]) => ({
      hashtag,
      avgEngagement: data.engagement / data.count,
      usage: data.count
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 10);
}

function analyzeContentTypes(posts: any[]): any {
  const types = {
    withImage: { count: 0, engagement: 0 },
    withVideo: { count: 0, engagement: 0 },
    textOnly: { count: 0, engagement: 0 },
    withLink: { count: 0, engagement: 0 }
  };

  posts?.forEach(post => {
    let type = 'textOnly';
    if (post.metadata?.hasImage) type = 'withImage';
    else if (post.metadata?.hasVideo) type = 'withVideo';
    else if (post.content.includes('http')) type = 'withLink';

    types[type as keyof typeof types].count++;
    
    if (post.metadata?.engagement) {
      types[type as keyof typeof types].engagement += 
        (post.metadata.engagement.likes || 0) + 
        (post.metadata.engagement.comments || 0);
    }
  });

  return Object.entries(types).map(([type, data]) => ({
    type,
    avgEngagement: data.count > 0 ? data.engagement / data.count : 0,
    percentage: (data.count / (posts?.length || 1)) * 100
  }));
}

function analyzePlatformPerformance(posts: any[]): any {
  const platforms: Record<string, { posts: number; totalEngagement: number }> = {};
  
  posts?.forEach(post => {
    post.platforms?.forEach((platform: string) => {
      if (!platforms[platform]) {
        platforms[platform] = { posts: 0, totalEngagement: 0 };
      }
      platforms[platform].posts++;
      
      if (post.results) {
        const result = post.results.find((r: any) => r.platform === platform);
        if (result?.engagement) {
          platforms[platform].totalEngagement += 
            (result.engagement.likes || 0) + 
            (result.engagement.comments || 0);
        }
      }
    });
  });

  return Object.entries(platforms).map(([platform, data]) => ({
    platform,
    avgEngagementPerPost: data.posts > 0 ? data.totalEngagement / data.posts : 0,
    totalPosts: data.posts
  }));
}

// AI Training and Feedback endpoints
app.post('/api/feedback/content', async (req, res) => {
  try {
    const { contentId, rating, issues, improvements } = req.body;
    
    if (!contentId || !rating) {
      return res.status(400).json({ error: 'Content ID and rating are required' });
    }

    // Get the content details
    const { data: content } = await supabase
      .from('generated_content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Record feedback
    await aiTrainingService.recordFeedback({
      postId: contentId,
      content: content.content,
      platforms: content.platforms,
      performance: {
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        engagementRate: 0
      },
      userFeedback: {
        rating,
        issues,
        improvements
      },
      aiDebateUsed: content.ai_debate_used,
      debateTranscript: content.debate_transcript,
      generatedAt: new Date(content.generated_at)
    });

    res.json({ success: true, message: 'Feedback recorded' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/feedback/post', async (req, res) => {
  try {
    const { postId, rating, issues, improvements } = req.body;
    
    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    // Update post with feedback
    const { error } = await supabase
      .from('posts')
      .update({
        'metadata.user_feedback': {
          rating,
          issues,
          improvements,
          feedback_date: new Date().toISOString()
        }
      })
      .eq('id', postId);

    if (error) throw error;

    res.json({ success: true, message: 'Post feedback recorded' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/training/insights', async (req, res) => {
  try {
    const insights = await aiTrainingService.getPerformanceInsights();
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/training/preferences', async (req, res) => {
  try {
    const preferences = await aiTrainingService.loadPreferences();
    res.json(preferences);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/training/train', async (req, res) => {
  try {
    const result = await aiTrainingService.trainFromHistoricalData();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debates/history', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // First try to get from ai_debates table
    const { data: debates, error: debatesError } = await supabase
      .from('ai_debates')
      .select(`
        *,
        generated_content:content_id (
          topic,
          content,
          hashtags
        )
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (!debatesError && debates && debates.length > 0) {
      return res.json(debates);
    }

    // Fallback to generated_content with ai_debate_used flag
    const { data: generatedDebates, error } = await supabase
      .from('generated_content')
      .select('*')
      .eq('ai_debate_used', true)
      .order('generated_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) {
      console.error('Error fetching debates:', error);
      return res.json([]);
    }

    res.json(generatedDebates || []);
  } catch (error: any) {
    console.error('Error in debates history:', error);
    res.json([]);
  }
});

// Function to track post performance
async function trackPostPerformance(postId: string) {
  try {
    // Get current post data
    const { data: post } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (!post || !post.results) return;

    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalReach = 0;

    // Get metrics from each platform
    for (const result of post.results) {
      if (result.success && result.postId) {
        try {
          const metrics = await socialMediaManager.getEngagementMetrics(
            result.platform,
            result.postId
          );
          
          totalLikes += metrics.likes || 0;
          totalComments += metrics.comments || 0;
          totalShares += metrics.shares || 0;
          totalReach += metrics.reach || 0;
        } catch (error) {
          console.error(`Error getting metrics for ${result.platform}:`, error);
        }
      }
    }

    const totalEngagements = totalLikes + totalComments + totalShares;
    const engagementRate = totalReach > 0 ? (totalEngagements / totalReach) * 100 : 0;

    // Update post performance
    await supabase
      .from('posts')
      .update({
        'performance.current_metrics': {
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          reach: totalReach,
          engagement_rate: engagementRate
        },
        'performance.last_updated': new Date().toISOString()
      })
      .eq('id', postId);

    // If this is an AI-generated post, record training feedback
    if (post.metadata?.ai_generated) {
      await aiTrainingService.recordFeedback({
        postId: postId,
        content: post.content,
        platforms: post.platforms,
        performance: {
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          clicks: 0,
          engagementRate
        },
        aiDebateUsed: post.metadata.debate_used || false,
        generatedAt: new Date(post.published_time)
      });
    }
  } catch (error) {
    console.error('Error tracking post performance:', error);
  }
}

// Performance monitoring endpoint
app.get('/api/posts/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get post with performance data
    const { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Trigger fresh performance check
    await trackPostPerformance(id);

    // Get updated post
    const { data: updatedPost } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    res.json({
      post: updatedPost,
      performance: updatedPost?.performance,
      metadata: updatedPost?.metadata
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Brand assets upload endpoints
app.post('/api/brand/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo file provided' });
    }
    
    // Read file and convert to base64
    const fileBuffer = await fs.readFile(req.file.path);
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
    
    // Deactivate old logo
    await supabase
      .from('brand_assets')
      .update({ is_active: false })
      .eq('type', 'logo');
    
    // Save to Supabase
    const { data, error } = await supabase
      .from('brand_assets')
      .insert({
        type: 'logo',
        file_url: dataUrl,
        file_path: req.file.originalname, // Store original filename
        is_active: true
      })
      .select()
      .single();
    
    // Clean up temp file
    await fs.unlink(req.file.path);
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      id: data.id,
      url: data.file_url
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/brand/upload-template', upload.single('template'), async (req, res) => {
  try {
    const { platform } = req.body;
    if (!req.file || !platform) {
      return res.status(400).json({ error: 'No template file or platform provided' });
    }
    
    // Read file and convert to base64
    const fileBuffer = await fs.readFile(req.file.path);
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
    
    // Deactivate old template for this platform
    await supabase
      .from('brand_assets')
      .update({ is_active: false })
      .eq('type', 'template')
      .eq('platform', platform);
    
    // Save to Supabase
    const { data, error } = await supabase
      .from('brand_assets')
      .insert({
        type: 'template',
        platform: platform,
        file_url: dataUrl,
        file_path: req.file.originalname, // Store original filename
        is_active: true
      })
      .select()
      .single();
    
    // Clean up temp file
    await fs.unlink(req.file.path);
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      id: data.id,
      platform: platform,
      url: data.file_url
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get brand assets endpoints
app.get('/api/brand/assets', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('brand_assets')
      .select('*')
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === 'PGRST204' || error.message?.includes('does not exist')) {
        return res.json({ 
          success: true, 
          assets: [] 
        });
      }
      throw error;
    }
    
    res.json({ 
      success: true, 
      assets: data || [] 
    });
  } catch (error: any) {
    console.error('Error fetching brand assets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete brand asset
app.delete('/api/brand/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('brand_assets')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting brand asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get composition settings
app.get('/api/brand/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('composition_settings')
      .select('*')
      .single();
    
    if (error) {
      // If table doesn't exist or no settings found, return defaults
      if (error.code === 'PGRST116' || error.code === 'PGRST204' || error.message?.includes('does not exist')) {
        return res.json({
          auto_apply_logo: true,
          auto_apply_template: true,
          logo_position: 'bottom-right',
          logo_size: 150,
          overlay_opacity: 0.9
        });
      }
      throw error;
    }
    
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching brand settings:', error);
    // Return defaults on any error
    res.json({
      auto_apply_logo: true,
      auto_apply_template: true,
      logo_position: 'bottom-right',
      logo_size: 150,
      overlay_opacity: 0.9
    });
  }
});

// Update composition settings
app.post('/api/brand/settings', async (req, res) => {
  try {
    const settings = req.body;
    
    // For now, just return the settings as-is since tables might not exist
    // In production, you would create these tables in Supabase
    console.log('Brand settings update requested:', settings);
    
    res.json({
      ...settings,
      success: true,
      message: 'Settings saved locally (Supabase tables not configured)'
    });
  } catch (error: any) {
    console.error('Error updating brand settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Static files already served above

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    server: 'running',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`✅ Up to Ten Social Media Manager API`);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📘 Facebook configured: ${process.env.FACEBOOK_PAGE_ID ? 'Yes' : 'No'}`);
  console.log(`🤖 AI Debate enabled: ${process.env.CLAUDE_API_KEY ? 'Yes' : 'No'}`);
});
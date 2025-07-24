import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './lib/supabase';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://filippofiz.github.io'],
  credentials: true
}));
app.use(express.json());
app.use('/assets', express.static('public/assets'));

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

    if (data.error) {
      console.error('Facebook API Error:', data.error);
      return res.status(400).json({ 
        error: 'Facebook API Error', 
        details: data.error 
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
      postId: data.id,
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

    if (error && error.code === 'PGRST116') {
      // No settings found, return defaults
      return res.json({
        platforms: ['facebook', 'instagram', 'twitter', 'linkedin'],
        frequency_hours: 4,
        active_hours_start: '08:00',
        active_hours_end: '22:00',
        themes: ['tips_studio', 'motivazionale', 'spiegazioni_semplici'],
        competitor_analysis: true,
        ai_debate_enabled: false,
        auto_publish: false,
        is_active: false
      });
    }

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
app.post('/api/settings', async (req, res) => {
  try {
    const settings = req.body;
    
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
        .update(settings)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Create new
      result = await supabase
        .from('schedule_settings')
        .insert(settings)
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

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Up to Ten Social Media Manager API`);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📘 Facebook configured: ${process.env.FACEBOOK_PAGE_ID ? 'Yes' : 'No'}`);
});
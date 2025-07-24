import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for testing
  credentials: true
}));
app.use(express.json());

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

    console.log('Testing Facebook post...');
    console.log('Page ID:', pageId);
    console.log('Token length:', accessToken?.length || 0);

    if (!pageId || !accessToken) {
      return res.status(500).json({ error: 'Facebook credentials not configured' });
    }

    // Test post to Facebook
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/feed`,
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
    console.log('Facebook response:', data);

    if (data.error) {
      console.error('Facebook API Error:', data.error);
      return res.status(400).json({ 
        error: 'Facebook API Error', 
        details: data.error 
      });
    }

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

app.listen(port, () => {
  console.log(`✅ Up to Ten Social Media Manager - Test Server`);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📘 Facebook App ID: ${process.env.FACEBOOK_APP_ID ? '✓ Configured' : '✗ Missing'}`);
  console.log(`📘 Facebook Page ID: ${process.env.FACEBOOK_PAGE_ID ? '✓ Configured' : '✗ Missing'}`);
  console.log(`📘 Facebook Token: ${process.env.FACEBOOK_PAGE_ACCESS_TOKEN ? '✓ Configured' : '✗ Missing'}`);
});
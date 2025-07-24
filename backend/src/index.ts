import express from 'express';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { ContentGenerator } from './services/ContentGenerator';
import { ImageComposer } from './services/ImageComposer';
import { SocialMediaManager } from './services/SocialMediaManager';
import { Scheduler } from './services/Scheduler';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const contentGenerator = new ContentGenerator();
const imageComposer = new ImageComposer();
const socialMediaManager = new SocialMediaManager();
const scheduler = new Scheduler(contentGenerator, imageComposer, socialMediaManager);

app.get('/health', (req, res) => {
  res.json({ status: 'active', timestamp: new Date().toISOString() });
});

app.post('/generate-post', async (req, res) => {
  try {
    const { theme, platforms } = req.body;
    const result = await scheduler.createAndPublishPost(theme, platforms);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/stats', async (req, res) => {
  try {
    const stats = await socialMediaManager.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

scheduler.start();

app.listen(port, () => {
  console.log(`Social Media Manager running on port ${port}`);
  console.log('Autonomous posting system activated');
});
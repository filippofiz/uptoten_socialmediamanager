import OpenAI from 'openai';
import { ContentTheme, GeneratedContent } from '../types/content';

export class ContentGenerator {
  private openai: OpenAI;
  private themes: ContentTheme[] = [
    'motivational', 'educational', 'entertaining', 
    'news', 'tips', 'quotes', 'facts', 'trends'
  ];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateContent(theme?: ContentTheme): Promise<GeneratedContent> {
    const selectedTheme = theme || this.getRandomTheme();
    
    const contentPrompt = `Generate engaging social media content for theme: ${selectedTheme}.
    Include:
    1. A catchy caption (max 280 characters)
    2. Relevant hashtags (5-10)
    3. An image description for DALL-E
    4. Best posting time suggestion
    Format as JSON.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: contentPrompt }],
      response_format: { type: "json_object" }
    });

    const content = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      caption: content.caption,
      hashtags: content.hashtags,
      imagePrompt: content.imageDescription,
      theme: selectedTheme,
      suggestedTime: content.postingTime || this.getOptimalPostingTime(),
      generatedAt: new Date()
    };
  }

  async generateImagePrompt(theme: string, style?: string): Promise<string> {
    const styleGuide = style || 'modern, professional, vibrant colors';
    
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{
        role: "user",
        content: `Create a DALL-E prompt for a ${theme} social media image. Style: ${styleGuide}. Make it visually striking and shareable.`
      }],
      max_tokens: 150
    });

    return response.choices[0].message.content || '';
  }

  async generateImage(prompt: string): Promise<string> {
    const response = await this.openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "vivid"
    });

    return response.data[0].url || '';
  }

  private getRandomTheme(): ContentTheme {
    return this.themes[Math.floor(Math.random() * this.themes.length)];
  }

  private getOptimalPostingTime(): string {
    const optimalHours = [9, 12, 15, 17, 19, 21];
    const hour = optimalHours[Math.floor(Math.random() * optimalHours.length)];
    return `${hour}:00`;
  }

  async analyzeTrends(): Promise<string[]> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{
        role: "user",
        content: "List 5 current trending topics suitable for social media content. Return as JSON array."
      }],
      response_format: { type: "json_object" }
    });

    const trends = JSON.parse(response.choices[0].message.content || '{"trends":[]}');
    return trends.trends || [];
  }
}
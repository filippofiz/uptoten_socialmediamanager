import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ContentTheme, GeneratedContent } from '../types/content';
import { QuotaMonitor } from './QuotaMonitor';

export class ClaudeContentGenerator {
  private anthropic: Anthropic;
  private openai: OpenAI;
  public quotaMonitor: QuotaMonitor;
  private themes: ContentTheme[] = [
    'motivational', 'educational', 'entertaining', 
    'news', 'tips', 'quotes', 'facts', 'trends'
  ];

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY || '',
    });
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.quotaMonitor = new QuotaMonitor(this.openai);
  }

  async generateContent(theme?: ContentTheme): Promise<GeneratedContent> {
    const selectedTheme = theme || this.getRandomTheme();
    
    const contentPrompt = `Generate engaging social media content for theme: ${selectedTheme}.
    Include:
    1. A catchy caption (max 280 characters)
    2. Relevant hashtags (5-10)
    3. An image description for DALL-E
    4. Best posting time suggestion
    
    Context: You are creating content for Up to Ten, Milan's premier center for scientific tutoring specializing in Mathematics, Physics, Computer Science, and STEM subjects for middle school, high school, and university students.
    
    Return the response as a JSON object with these fields: caption, hashtags (array), imageDescription, postingTime.`;

    try {
      const completion = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: contentPrompt
          }
        ]
      });

      const content = JSON.parse(completion.content[0].type === 'text' ? completion.content[0].text : '{}');
      
      return {
        caption: content.caption,
        hashtags: content.hashtags,
        imagePrompt: content.imageDescription,
        theme: selectedTheme,
        suggestedTime: content.postingTime || this.getOptimalPostingTime(),
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Claude generation error, falling back to GPT-4:', error);
      // Fallback to GPT-4 if Claude fails
      return this.generateContentWithGPT(selectedTheme);
    }
  }

  private async generateContentWithGPT(theme: ContentTheme): Promise<GeneratedContent> {
    const contentPrompt = `Generate engaging social media content for theme: ${theme}.
    Include:
    1. A catchy caption (max 280 characters)
    2. Relevant hashtags (5-10)
    3. An image description for DALL-E
    4. Best posting time suggestion
    
    Context: You are creating content for Up to Ten, Milan's premier center for scientific tutoring specializing in Mathematics, Physics, Computer Science, and STEM subjects for middle school, high school, and university students.
    
    Return the response as a JSON object with these fields: caption, hashtags (array), imageDescription, postingTime.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: contentPrompt }],
      response_format: { type: "json_object" }
    });

    const content = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      caption: content.caption,
      hashtags: content.hashtags,
      imagePrompt: content.imageDescription,
      theme: theme,
      suggestedTime: content.postingTime || this.getOptimalPostingTime(),
      generatedAt: new Date()
    };
  }

  async generateImagePrompt(theme: string, style?: string): Promise<string> {
    const styleGuide = style || 'modern, professional, vibrant colors';
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Create a DALL-E prompt for a ${theme} social media image. Style: ${styleGuide}. Make it visually striking and shareable.`
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error) {
      console.error('Claude image prompt error, falling back to GPT-4:', error);
      // Fallback to GPT-4
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [{
          role: "user",
          content: `Create a DALL-E prompt for a ${theme} social media image. Style: ${styleGuide}. Make it visually striking and shareable.`
        }],
        max_tokens: 150
      });

      return response.choices[0].message.content || '';
    }
  }

  async generateImage(prompt: string, options?: { width?: number; height?: number }): Promise<string> {
    // Check quota before attempting
    const quotaStatus = await this.quotaMonitor.checkQuotaStatus();
    if (!quotaStatus.isAvailable) {
      console.error('Quota not available:', quotaStatus.recommendations);
      throw new Error('OpenAI quota exceeded. ' + quotaStatus.recommendations.join('. '));
    }
    
    // DALL-E 3 supports only specific sizes
    // We'll use the closest match for each platform
    let size: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024";
    
    if (options?.width && options?.height) {
      const aspectRatio = options.width / options.height;
      if (aspectRatio > 1.5) {
        size = "1792x1024"; // Wide format (1.75:1)
      } else if (aspectRatio < 0.67) {
        size = "1024x1792"; // Tall format (1:1.75)
      } else {
        size = "1024x1024"; // Square format (1:1)
      }
    }
    
    try {
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size,
        quality: "hd",
        style: "vivid"
      });
      
      // Record success
      this.quotaMonitor.recordSuccess('image');
      
      return response.data[0].url || '';
    } catch (error: any) {
      // Record error
      this.quotaMonitor.recordError(error, 'image');
      throw error;
    }
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
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: "List 5 current trending topics suitable for social media content. Return as a JSON object with a 'trends' array."
        }]
      });

      const trends = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{"trends":[]}');
      return trends.trends || [];
    } catch (error) {
      console.error('Claude trends error, falling back to GPT-4:', error);
      // Fallback to GPT-4
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{
          role: "user",
          content: "List 5 current trending topics suitable for social media content. Return as a JSON object with a 'trends' array."
        }],
        response_format: { type: "json_object" }
      });

      const trends = JSON.parse(response.choices[0].message.content || '{"trends":[]}');
      return trends.trends || [];
    }
  }

  async generateContentWithParams(params: {
    topic: string;
    tone: string;
    length: string;
    includeHashtags: boolean;
    platforms: string[];
    companyContext?: any;
  }): Promise<any> {
    const companyInfo = params.companyContext ? `
Company: ${params.companyContext.name}
Industry: ${params.companyContext.industry}
Description: ${params.companyContext.description}
Target Audience: ${params.companyContext.targetAudience}
Brand Voice: ${params.companyContext.brandVoice}
Business Goals: ${params.companyContext.businessGoals}
` : `Company: Up to Ten - Milan's premier center for scientific tutoring specializing in Mathematics, Physics, Computer Science, and STEM subjects.`;

    const prompt = `Generate social media content with these parameters:
Topic: ${params.topic}
Tone: ${params.tone}
Length: ${params.length}
Platforms: ${params.platforms.join(', ')}
Include hashtags: ${params.includeHashtags}

${companyInfo}

Create platform-optimized content with:
1. Main content text
2. Platform-specific variations if needed
3. Relevant hashtags
4. Suggested posting times
5. Image suggestions

Return as a JSON object with:
1. An "imagePrompt" field with a DALL-E 3 prompt for generating the main image. Prefer photorealistic images unless the content clearly requires graphics, illustrations, or infographics.
2. Fields for each platform:
   - Facebook: {main_content_text, posting_time, image_suggestions, relevant_hashtags}
   - Instagram: {main_content_text, posting_time, image_suggestions, relevant_hashtags}
   - Twitter: {main_content_text, posting_time, image_suggestions, relevant_hashtags}
   - LinkedIn: {main_content_text, posting_time, image_suggestions, relevant_hashtags}

Only include the platforms specified. Format hashtags as space-separated strings.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}');
    } catch (error) {
      console.error('Claude content generation error, falling back to GPT-4:', error);
      // Fallback to GPT-4
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert social media content creator who crafts engaging, platform-optimized content. Always return valid JSON."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    }
  }

  async generateContentSuggestions(params: {
    industry: string;
    tone: string;
    platforms: string[];
    count?: number;
  }): Promise<any[]> {
    const count = params.count || 5;

    try {
      const prompt = `Generate ${count} social media content suggestions for:
Industry: ${params.industry}
Tone: ${params.tone}
Platforms: ${params.platforms.join(', ')}

For each suggestion provide:
1. Topic/theme
2. Content preview (first 100 characters)
3. Relevant hashtags
4. Best platforms for this content
5. Estimated engagement level (1-10)

Format the response as a JSON object with a "suggestions" array containing objects with the specified fields.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const data = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{"suggestions": []}');
      return data.suggestions || [];
    } catch (error) {
      console.error('Error generating suggestions with Claude, falling back to GPT-4:', error);
      // Fallback to GPT-4
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert social media strategist who creates engaging content ideas.'
          },
          { role: 'user', content: `Generate ${count} social media content suggestions for:
Industry: ${params.industry}
Tone: ${params.tone}
Platforms: ${params.platforms.join(', ')}

For each suggestion provide:
1. Topic/theme
2. Content preview (first 100 characters)
3. Relevant hashtags
4. Best platforms for this content
5. Estimated engagement level (1-10)

Format the response as a JSON object with a "suggestions" array containing objects with the specified fields.` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8
      });

      const data = JSON.parse(response.choices[0].message.content || '{"suggestions": []}');
      return data.suggestions || [];
    }
  }
}
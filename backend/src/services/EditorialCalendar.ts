import { ContentGenerator } from './ContentGenerator';
import { supabase } from '../lib/supabase';
import { CompetitorAnalyzer } from './CompetitorAnalyzer';
import OpenAI from 'openai';

interface CalendarPost {
  id: string;
  content: string;
  platforms: string[];
  scheduledTime: Date;
  topic: string;
  tone: string;
  hashtags: string[];
  imagePrompt?: string;
  status: 'draft' | 'scheduled' | 'published';
  aiGenerated: boolean;
  engagementPrediction?: number;
}

interface EditorialStrategy {
  businessGoals: string[];
  targetAudience: string;
  contentPillars: string[];
  postingFrequency: {
    daily: number;
    weeklyDistribution: Record<string, number>;
    optimalTimes: string[];
  };
  toneGuidelines: string;
  hashtagStrategy: string[];
}

export class EditorialCalendar {
  private openai: OpenAI;
  private contentGenerator: ContentGenerator;
  private competitorAnalyzer: CompetitorAnalyzer;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.contentGenerator = new ContentGenerator();
    this.competitorAnalyzer = new CompetitorAnalyzer({} as any);
  }

  async generateEditorialPlan(params: {
    duration: 'week' | 'month' | 'quarter';
    industry: string;
    businessGoals: string[];
    targetAudience: string;
    contentPillars?: string[];
    competitors?: string[];
    previousPerformance?: any;
  }): Promise<CalendarPost[]> {
    try {
      // Analyze competitors if provided
      let competitorInsights = '';
      if (params.competitors && params.competitors.length > 0) {
        const analysis = await (this.competitorAnalyzer as any).analyze(params.competitors);
        competitorInsights = this.formatCompetitorInsights(analysis);
      }

      // Get previous performance data
      const performanceInsights = await this.analyzeHistoricalPerformance();

      // Generate editorial strategy
      const strategy = await this.generateEditorialStrategy({
        ...params,
        competitorInsights,
        performanceInsights
      });

      // Generate content calendar
      const calendar = await this.generateCalendarPosts(strategy, params.duration);

      // Save to database
      await this.saveCalendarToDatabase(calendar);

      return calendar;
    } catch (error: any) {
      console.error('Error generating editorial plan:', error);
      throw error;
    }
  }

  private async generateEditorialStrategy(params: any): Promise<EditorialStrategy> {
    const prompt = `Generate a comprehensive editorial strategy for social media.

Industry: ${params.industry}
Business Goals: ${params.businessGoals.join(', ')}
Target Audience: ${params.targetAudience}
Content Pillars: ${params.contentPillars?.join(', ') || 'To be determined'}
Duration: ${params.duration}

${params.competitorInsights ? `Competitor Insights:\n${params.competitorInsights}` : ''}
${params.performanceInsights ? `Historical Performance:\n${params.performanceInsights}` : ''}

Create a detailed editorial strategy including:
1. Refined content pillars (4-6 pillars)
2. Posting frequency and distribution
3. Optimal posting times
4. Tone and voice guidelines
5. Hashtag strategy
6. Content mix recommendations

Format as JSON.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert social media strategist specializing in creating data-driven editorial calendars that maximize engagement and achieve business goals.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const strategyData = JSON.parse(response.choices[0].message.content || '{}');

    return {
      businessGoals: params.businessGoals,
      targetAudience: params.targetAudience,
      contentPillars: strategyData.contentPillars || [],
      postingFrequency: {
        daily: strategyData.postsPerDay || 2,
        weeklyDistribution: strategyData.weeklyDistribution || {},
        optimalTimes: strategyData.optimalTimes || ['09:00', '13:00', '18:00']
      },
      toneGuidelines: strategyData.toneGuidelines || 'professional yet approachable',
      hashtagStrategy: strategyData.hashtagStrategy || []
    };
  }

  private async generateCalendarPosts(strategy: EditorialStrategy, duration: string): Promise<CalendarPost[]> {
    const daysToGenerate = duration === 'week' ? 7 : duration === 'month' ? 30 : 90;
    const posts: CalendarPost[] = [];
    const startDate = new Date();

    for (let day = 0; day < daysToGenerate; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + day);
      
      const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const postsForDay = strategy.postingFrequency.weeklyDistribution[dayOfWeek] || strategy.postingFrequency.daily;

      for (let postIndex = 0; postIndex < postsForDay; postIndex++) {
        const postTime = new Date(currentDate);
        const optimalTime = strategy.postingFrequency.optimalTimes[postIndex % strategy.postingFrequency.optimalTimes.length];
        const [hours, minutes] = optimalTime.split(':');
        postTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // Select content pillar for this post
        const pillar = strategy.contentPillars[day % strategy.contentPillars.length];

        // Generate post content
        const post = await this.generateSinglePost({
          pillar,
          strategy,
          scheduledTime: postTime,
          dayContext: this.getDayContext(currentDate),
          recentPosts: posts.slice(-5) // Avoid repetition
        });

        posts.push(post);
      }
    }

    return posts;
  }

  private async generateSinglePost(params: {
    pillar: string;
    strategy: EditorialStrategy;
    scheduledTime: Date;
    dayContext: string;
    recentPosts: CalendarPost[];
  }): Promise<CalendarPost> {
    const recentTopics = params.recentPosts.map(p => p.topic).join(', ');

    const prompt = `Generate a social media post for the following context:

Content Pillar: ${params.pillar}
Target Audience: ${params.strategy.targetAudience}
Business Goals: ${params.strategy.businessGoals.join(', ')}
Tone: ${params.strategy.toneGuidelines}
Day Context: ${params.dayContext}
Recent Topics (avoid repetition): ${recentTopics}

Create an engaging post that:
1. Aligns with the content pillar
2. Resonates with the target audience
3. Supports business goals
4. Is optimized for maximum engagement
5. Includes relevant hashtags

Also suggest:
- Specific topic/angle
- Best platforms for this content
- Image prompt for visual creation
- Predicted engagement level (1-10)

Format as JSON with fields: content, topic, platforms, hashtags, imagePrompt, engagementPrediction`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a creative social media content expert who creates highly engaging, platform-optimized content.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8
    });

    const postData = JSON.parse(response.choices[0].message.content || '{}');

    return {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: postData.content,
      platforms: postData.platforms || ['facebook', 'instagram', 'twitter', 'linkedin'],
      scheduledTime: params.scheduledTime,
      topic: postData.topic,
      tone: params.strategy.toneGuidelines,
      hashtags: postData.hashtags || [],
      imagePrompt: postData.imagePrompt,
      status: 'draft',
      aiGenerated: true,
      engagementPrediction: postData.engagementPrediction
    };
  }

  private getDayContext(date: Date): string {
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const dayOfMonth = date.getDate();

    // Check for holidays or special days
    const specialDays = this.getSpecialDays(date);
    if (specialDays.length > 0) {
      return `${dayOfWeek}, ${month} ${dayOfMonth} - ${specialDays.join(', ')}`;
    }

    // Check for beginning/end of month
    if (dayOfMonth === 1) return `First day of ${month} - Fresh start, new goals`;
    if (dayOfMonth >= 28) return `End of ${month} - Monthly recap, achievements`;

    // Day-specific contexts
    const dayContexts: Record<string, string> = {
      'Monday': 'Motivation Monday - Fresh week start',
      'Tuesday': 'Transformation Tuesday - Growth and change',
      'Wednesday': 'Wisdom Wednesday - Tips and insights',
      'Thursday': 'Throwback Thursday - Success stories',
      'Friday': 'Feature Friday - Highlights and celebrations',
      'Saturday': 'Social Saturday - Community engagement',
      'Sunday': 'Sunday Reflection - Planning ahead'
    };

    return dayContexts[dayOfWeek] || dayOfWeek;
  }

  private getSpecialDays(date: Date): string[] {
    const specialDays: string[] = [];
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Add major holidays and observances
    const holidays: Record<string, string> = {
      '1-1': 'New Year\'s Day',
      '2-14': 'Valentine\'s Day',
      '3-8': 'International Women\'s Day',
      '4-22': 'Earth Day',
      '5-1': 'International Workers\' Day',
      '6-5': 'World Environment Day',
      '9-1': 'Labor Day',
      '10-31': 'Halloween',
      '11-11': 'Veterans Day',
      '12-25': 'Christmas'
    };

    const dateKey = `${month}-${day}`;
    if (holidays[dateKey]) {
      specialDays.push(holidays[dateKey]);
    }

    return specialDays;
  }

  private async analyzeHistoricalPerformance(): Promise<string> {
    try {
      // Get posts from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .gte('published_time', thirtyDaysAgo.toISOString())
        .eq('status', 'published');

      if (!posts || posts.length === 0) {
        return 'No historical data available';
      }

      // Analyze performance patterns
      const insights: string[] = [];

      // Best performing content types
      const contentTypes: Record<string, number> = {};
      posts.forEach(post => {
        const type = this.detectContentType(post.content);
        contentTypes[type] = (contentTypes[type] || 0) + 1;
      });

      // Best performing times
      const timePerformance: Record<string, number> = {};
      posts.forEach(post => {
        const hour = new Date(post.published_time).getHours();
        timePerformance[hour] = (timePerformance[hour] || 0) + 1;
      });

      insights.push(`Content mix: ${JSON.stringify(contentTypes)}`);
      insights.push(`Best posting times: ${Object.entries(timePerformance).sort(([,a], [,b]) => b - a).slice(0, 3).map(([hour]) => `${hour}:00`).join(', ')}`);

      return insights.join('\n');
    } catch (error) {
      console.error('Error analyzing performance:', error);
      return 'Unable to analyze historical performance';
    }
  }

  private detectContentType(content: string): string {
    if (content.includes('?')) return 'question';
    if (content.match(/^\d+\./m)) return 'listicle';
    if (content.includes('http')) return 'link';
    if (content.length < 100) return 'short';
    return 'standard';
  }

  private formatCompetitorInsights(analysis: any): string {
    const insights: string[] = [];
    
    Object.entries(analysis).forEach(([competitor, data]: [string, any]) => {
      insights.push(`${competitor}: Posts ${data.postFrequency}/week, Avg engagement ${data.avgEngagement}, Top topics: ${data.topTopics.join(', ')}`);
    });

    return insights.join('\n');
  }

  private async saveCalendarToDatabase(calendar: CalendarPost[]): Promise<void> {
    const posts = calendar.map(post => ({
      content: post.content,
      platforms: post.platforms,
      scheduled_time: post.scheduledTime.toISOString(),
      status: 'scheduled',
      topic: post.topic,
      hashtags: post.hashtags,
      ai_generated: true,
      metadata: {
        tone: post.tone,
        imagePrompt: post.imagePrompt,
        engagementPrediction: post.engagementPrediction
      }
    }));

    await supabase.from('posts').insert(posts);
  }

  async updatePostBasedOnFeedback(postId: string, feedback: {
    type: 'positive' | 'negative';
    reason?: string;
    suggestions?: string;
  }): Promise<CalendarPost> {
    // Get the original post
    const { data: originalPost } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (!originalPost) {
      throw new Error('Post not found');
    }

    // Generate improved version based on feedback
    const prompt = `Improve this social media post based on feedback:

Original Post: ${originalPost.content}
Feedback Type: ${feedback.type}
Reason: ${feedback.reason || 'Not specified'}
Suggestions: ${feedback.suggestions || 'None'}

Generate an improved version that addresses the feedback while maintaining the original intent.
Include: content, hashtags, and explanation of changes.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at refining social media content based on feedback.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });

    const improved = JSON.parse(response.choices[0].message.content || '{}');

    // Update the post
    const updatedPost = {
      ...originalPost,
      content: improved.content,
      hashtags: improved.hashtags,
      metadata: {
        ...originalPost.metadata,
        lastFeedback: feedback,
        improvementExplanation: improved.explanation
      }
    };

    await supabase
      .from('posts')
      .update(updatedPost)
      .eq('id', postId);

    return updatedPost as CalendarPost;
  }

  async adaptCalendarBasedOnPerformance(): Promise<void> {
    // Get recent performance data
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'published')
      .gte('published_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('published_time', { ascending: false });

    if (!recentPosts || recentPosts.length === 0) return;

    // Analyze what's working
    const highPerformers = recentPosts.filter(post => {
      // Define high performance criteria
      const engagement = post.metadata?.engagement || {};
      return (engagement.likes || 0) + (engagement.comments || 0) + (engagement.shares || 0) > 50;
    });

    // Update future scheduled posts based on insights
    const { data: upcomingPosts } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_time', new Date().toISOString())
      .limit(10);

    if (!upcomingPosts) return;

    // Apply learnings to upcoming posts
    for (const post of upcomingPosts) {
      if (post.ai_generated) {
        // Regenerate with performance insights
        const improvedPost = await this.improvePostWithInsights(post, highPerformers);
        
        await supabase
          .from('posts')
          .update({
            content: improvedPost.content,
            hashtags: improvedPost.hashtags,
            metadata: {
              ...post.metadata,
              adaptedAt: new Date().toISOString(),
              performanceOptimized: true
            }
          })
          .eq('id', post.id);
      }
    }
  }

  private async improvePostWithInsights(post: any, highPerformers: any[]): Promise<any> {
    const insights = this.extractInsights(highPerformers);

    const prompt = `Optimize this scheduled post based on recent high-performing content insights:

Original Post: ${post.content}
Topic: ${post.topic}
Current Hashtags: ${post.hashtags.join(', ')}

High Performance Insights:
${insights}

Generate an optimized version that incorporates successful patterns while maintaining the topic.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are an expert at optimizing social media content based on performance data.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private extractInsights(highPerformers: any[]): string {
    const insights: string[] = [];

    // Common patterns in high performers
    const commonWords = this.findCommonWords(highPerformers.map(p => p.content));
    const commonHashtags = this.findCommonElements(highPerformers.map(p => p.hashtags).flat());
    const avgLength = highPerformers.reduce((acc, p) => acc + p.content.length, 0) / highPerformers.length;

    insights.push(`Common successful themes: ${commonWords.join(', ')}`);
    insights.push(`Effective hashtags: ${commonHashtags.join(', ')}`);
    insights.push(`Optimal content length: ~${Math.round(avgLength)} characters`);

    return insights.join('\n');
  }

  private findCommonWords(contents: string[]): string[] {
    const wordFreq: Record<string, number> = {};
    
    contents.forEach(content => {
      const words = content.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 4) { // Ignore short words
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
    });

    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  private findCommonElements(elements: string[]): string[] {
    const freq: Record<string, number> = {};
    
    elements.forEach(element => {
      freq[element] = (freq[element] || 0) + 1;
    });

    return Object.entries(freq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([element]) => element);
  }
}
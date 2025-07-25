import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

interface DebateParticipant {
  name: string;
  role: string;
  personality: string;
  expertise: string;
}

interface DebateResult {
  finalContent: string;
  refinements: string[];
  consensusReached: boolean;
  insights: string[];
}

export class AIDebateService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private debateHistory: any[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY || '',
    });
  }

  async createPerfectPost(params: {
    topic: string;
    platforms: string[];
    tone: string;
    businessGoals?: string;
    targetAudience?: string;
    companyContext?: any;
  }): Promise<{
    content: string;
    hashtags: string[];
    imagePrompt: string;
    insights: string[];
  }> {
    // Define AI participants for the debate
    const participants: DebateParticipant[] = [
      {
        name: "ContentStrategist",
        role: "Chief Content Strategist",
        personality: "Creative, trendy, audience-focused",
        expertise: "Social media trends, viral content, engagement strategies"
      },
      {
        name: "BrandManager",
        role: "Brand Consistency Manager", 
        personality: "Professional, detail-oriented, brand-focused",
        expertise: "Brand voice, consistency, corporate messaging"
      },
      {
        name: "DataAnalyst",
        role: "Performance Analyst",
        personality: "Analytical, data-driven, results-oriented",
        expertise: "Metrics, engagement rates, optimal timing, hashtag performance"
      }
    ];

    // Clear debate history for new debate
    this.debateHistory = [];
    
    // Start the debate process
    const debateResult = await this.conductDebate({
      topic: params.topic,
      platforms: params.platforms,
      tone: params.tone,
      businessGoals: params.businessGoals,
      targetAudience: params.targetAudience,
      companyContext: params.companyContext,
      participants
    });

    // Generate the final optimized content
    const finalContent = await this.synthesizeDebateResults(debateResult);

    return finalContent;
  }

  private async conductDebate(params: {
    topic: string;
    platforms: string[];
    tone: string;
    businessGoals?: string;
    targetAudience?: string;
    companyContext?: any;
    participants: DebateParticipant[];
  }): Promise<DebateResult> {
    const refinements: string[] = [];
    const insights: string[] = [];
    let currentProposal = "";
    let consensusReached = false;
    let rounds = 0;
    const maxRounds = 3;

    // Record debate topic
    this.debateHistory.push({
      agent: 'Sistema',
      type: 'topic',
      message: `🎯 Argomento: ${params.topic}\n📱 Piattaforme: ${params.platforms.join(', ')}\n🎨 Tono: ${params.tone}`
    });
    
    // Initial proposal from Claude (now primary)
    const initialProposal = await this.generateInitialProposal(params);
    currentProposal = initialProposal;
    refinements.push(`Initial Proposal: ${initialProposal}`);
    
    // Record initial proposal
    this.debateHistory.push({
      agent: 'Claude',
      type: 'proposal',
      round: 0,
      message: `💡 Proposta iniziale:\n${initialProposal}`
    });

    while (!consensusReached && rounds < maxRounds) {
      rounds++;

      // Get GPT-4's critique and suggestions (now the critic)
      const gptCritique = await this.getGPTCritique({
        proposal: currentProposal,
        topic: params.topic,
        platforms: params.platforms,
        tone: params.tone,
        round: rounds
      });

      insights.push(...gptCritique.insights);
      refinements.push(`Round ${rounds} - GPT-4: ${gptCritique.feedback}`);
      
      // Record GPT-4's critique
      this.debateHistory.push({
        agent: 'GPT-4',
        type: 'critique',
        round: rounds,
        message: `🔍 Analisi critica (Round ${rounds}):\n${gptCritique.feedback}\n\n💡 Suggerimenti: ${gptCritique.suggestions.join(', ')}`
      });

      // Get Claude's response and refinement (now the refiner)
      const claudeRefinement = await this.getClaudeRefinement({
        originalProposal: currentProposal,
        critique: gptCritique.feedback,
        suggestions: gptCritique.suggestions
      });

      currentProposal = claudeRefinement.refinedContent;
      refinements.push(`Round ${rounds} - Claude: ${claudeRefinement.changes}`);
      
      // Record Claude's refinement
      this.debateHistory.push({
        agent: 'Claude',
        type: 'refinement',
        round: rounds,
        message: `✏️ Versione migliorata (Round ${rounds}):\n${claudeRefinement.refinedContent}`
      });

      // Check for consensus
      consensusReached = await this.checkConsensus({
        content: currentProposal,
        round: rounds,
        previousCritiques: refinements
      });
      
      // Record consensus check
      this.debateHistory.push({
        agent: 'Claude',
        type: 'consensus',
        round: rounds,
        message: consensusReached ? '✅ Consenso raggiunto! Il contenuto è ottimizzato.' : '🔄 Continuiamo a migliorare...'
      });
    }

    // Add final summary
    this.debateHistory.push({
      agent: 'Sistema',
      type: 'summary',
      message: `🏆 Dibattito concluso dopo ${rounds} round.\n${consensusReached ? '✅ Consenso raggiunto!' : '⏰ Limite di round raggiunto.'}\n\n📝 Contenuto finale:\n${currentProposal}`
    });
    
    return {
      finalContent: currentProposal,
      refinements,
      consensusReached,
      insights
    };
  }

  private async generateInitialProposal(params: any): Promise<string> {
    const companyInfo = params.companyContext ? `
Company: ${params.companyContext.name || 'Up to Ten'}
Industry: ${params.companyContext.industry || 'Education'}
Description: ${params.companyContext.description || ''}
` : '';

    const prompt = `Create a social media post with these requirements:
Topic: ${params.topic}
Platforms: ${params.platforms.join(', ')}
Tone: ${params.tone}
${params.businessGoals ? `Business Goals: ${params.businessGoals}` : ''}
${params.targetAudience ? `Target Audience: ${params.targetAudience}` : ''}
${companyInfo}
Create an engaging post that will perform well across all specified platforms.
Return the content as plain text, not JSON.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error) {
      console.error('Claude initial proposal error:', error);
      // Fallback to GPT-4 if Claude fails
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert social media content creator. Create engaging posts."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.8
      });

      return response.choices[0].message.content || '';
    }
  }

  private async getClaudeCritique(params: {
    proposal: string;
    topic: string;
    platforms: string[];
    tone: string;
    round: number;
  }): Promise<{
    feedback: string;
    suggestions: string[];
    insights: string[];
  }> {
    const prompt = `You are an AI critic specializing in social media optimization. Review this content:

Content: "${params.proposal}"
Topic: ${params.topic}
Platforms: ${params.platforms.join(', ')}
Desired Tone: ${params.tone}

Provide:
1. Specific critique points
2. Concrete suggestions for improvement
3. Platform-specific insights
4. Engagement optimization tips

Be constructive but thorough in your analysis.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Parse Claude's response
      const suggestions = this.extractSuggestions(content);
      const insights = this.extractInsights(content);

      return {
        feedback: content,
        suggestions,
        insights
      };
    } catch (error) {
      console.error('Claude API error:', error);
      // Fallback to GPT-4 if Claude fails
      return this.getGPTCritique(params);
    }
  }

  private async getGPTCritique(params: {
    proposal: string;
    topic: string;
    platforms: string[];
    tone: string;
    round: number;
  }): Promise<{
    feedback: string;
    suggestions: string[];
    insights: string[];
  }> {
    const prompt = `You are an AI critic specializing in social media optimization. Review this content:

Content: "${params.proposal}"
Topic: ${params.topic}
Platforms: ${params.platforms.join(', ')}
Desired Tone: ${params.tone}

Provide:
1. Specific critique points
2. Concrete suggestions for improvement
3. Platform-specific insights
4. Engagement optimization tips

Be constructive but thorough in your analysis.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are a critical analyst for social media content optimization."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const content = response.choices[0].message.content || '';
    return {
      feedback: content,
      suggestions: this.extractSuggestions(content),
      insights: this.extractInsights(content)
    };
  }

  private async getGPTRefinement(params: {
    originalProposal: string;
    critique: string;
    suggestions: string[];
  }): Promise<{
    refinedContent: string;
    changes: string;
  }> {
    const prompt = `Based on this critique, refine the social media post:

Original: "${params.originalProposal}"
Critique: ${params.critique}
Suggestions: ${params.suggestions.join(', ')}

Create an improved version that addresses all feedback while maintaining the core message.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at refining social media content based on feedback."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    const refinedContent = response.choices[0].message.content || '';
    
    return {
      refinedContent,
      changes: "Refined based on critique: improved engagement hooks, platform optimization, and clarity"
    };
  }

  private async checkConsensus(params: {
    content: string;
    round: number;
    previousCritiques: string[];
  }): Promise<boolean> {
    // Force exit after 3 rounds to prevent infinite loops
    if (params.round >= 3) {
      console.log(`AI Debate: Reached maximum rounds (${params.round}), ending debate`);
      return true;
    }
    
    // Use GPT-4 to evaluate if consensus is reached
    const prompt = `Evaluate if this social media content has reached optimal quality:

Content: "${params.content}"
Iteration: ${params.round}

Previous refinements:
${params.previousCritiques.slice(-2).join('\n')}

Is this content now optimized enough, or does it need more refinement? Answer with only YES (if optimized) or NO (if needs more work).`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at evaluating content quality. Answer only YES or NO.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      });

      const answer = response.choices[0].message.content?.trim().toUpperCase() || '';
      console.log(`AI Debate: Round ${params.round} consensus check - ${answer}`);
      
      // Check if answer contains YES
      return answer.includes('YES') || answer.startsWith('YES');
    } catch (error) {
      console.error('AI Debate: Error checking consensus:', error);
      // If GPT-4 fails, end after 2 rounds
      return params.round >= 2;
    }
  }

  private async getClaudeRefinement(params: {
    originalProposal: string;
    critique: string;
    suggestions: string[];
  }): Promise<{
    refinedContent: string;
    changes: string;
  }> {
    const prompt = `Based on this critique, refine the social media post:

Original: "${params.originalProposal}"
Critique: ${params.critique}
Suggestions: ${params.suggestions.join(', ')}

Create an improved version that addresses all feedback while maintaining the core message.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const refinedContent = response.content[0].type === 'text' ? response.content[0].text : '';
      
      return {
        refinedContent,
        changes: "Refined based on critique: improved engagement hooks, platform optimization, and clarity"
      };
    } catch (error) {
      console.error('Claude refinement error:', error);
      // Fallback to GPT-4 if Claude fails
      return this.getGPTRefinement(params);
    }
  }

  private async synthesizeDebateResults(debateResult: DebateResult): Promise<{
    content: string;
    hashtags: string[];
    imagePrompt: string;
    insights: string[];
  }> {
    // Generate hashtags based on the final content using Claude
    try {
      const hashtagsResponse = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Generate 5-10 relevant hashtags for this social media post: "${debateResult.finalContent}"\n\nReturn as a JSON object with a "hashtags" array.`
          }
        ]
      });

      const hashtagsContent = hashtagsResponse.content[0].type === 'text' ? hashtagsResponse.content[0].text : '{"hashtags":[]}';
      const hashtags = JSON.parse(hashtagsContent).hashtags;

      // Generate image prompt using Claude
      const imagePromptResponse = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Create a DALL-E 3 prompt for a photorealistic image to accompany this social media post: "${debateResult.finalContent}". Prefer high-quality photography with natural lighting over illustrations or graphics unless the content specifically requires them.`
          }
        ]
      });

      const imagePrompt = imagePromptResponse.content[0].type === 'text' ? imagePromptResponse.content[0].text : '';

      return {
        content: debateResult.finalContent,
        hashtags,
        imagePrompt,
        insights: debateResult.insights
      };
    } catch (error) {
      console.error('Claude synthesis error, falling back to GPT-4:', error);
      
      // Fallback to GPT-4 if Claude fails
      const hashtagsResponse = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "Generate relevant hashtags for social media posts."
          },
          {
            role: "user",
            content: `Generate 5-10 relevant hashtags for this post: "${debateResult.finalContent}"`
          }
        ],
        response_format: { type: "json_object" }
      });

      const hashtags = JSON.parse(hashtagsResponse.choices[0].message.content || '{"hashtags":[]}').hashtags;

      // Generate image prompt
      const imagePromptResponse = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "Create DALL-E 3 prompts for social media visuals."
          },
          {
            role: "user",
            content: `Create a DALL-E 3 prompt for a photorealistic image to accompany this post: "${debateResult.finalContent}". Prefer high-quality photography with natural lighting over illustrations or graphics unless the content specifically requires them.`
          }
        ]
      });

      const imagePrompt = imagePromptResponse.choices[0].message.content || '';

      return {
        content: debateResult.finalContent,
        hashtags,
        imagePrompt,
        insights: debateResult.insights
      };
    }
  }

  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('suggest') || line.includes('recommend') || line.includes('could') || line.includes('should')) {
        suggestions.push(line.trim());
      }
    });

    return suggestions.slice(0, 5);
  }

  private extractInsights(text: string): string[] {
    const insights: string[] = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('insight') || line.includes('important') || line.includes('key') || line.includes('note')) {
        insights.push(line.trim());
      }
    });

    return insights.slice(0, 5);
  }

  async generateDebateContent(params: {
    topic: string;
    tone: string;
    platforms: string[];
    businessGoals?: string;
    targetAudience?: string;
    companyContext?: any;
    iterations?: number;
  }): Promise<any> {
    // Store debate history
    this.debateHistory = [];
    
    // This is the main method that will be called from the API
    const result = await this.createPerfectPost({
      topic: params.topic,
      platforms: params.platforms,
      tone: params.tone,
      businessGoals: params.businessGoals,
      targetAudience: params.targetAudience,
      companyContext: params.companyContext
    });

    return {
      content: result.content,
      hashtags: result.hashtags,
      imagePrompt: result.imagePrompt,
      insights: result.insights,
      debateHistory: this.debateHistory,
      platforms: params.platforms,
      tone: params.tone,
      optimizedFor: 'maximum engagement through AI consensus'
    };
  }
}
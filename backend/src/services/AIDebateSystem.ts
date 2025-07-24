import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ContentTheme, GeneratedContent } from '../types/content';

interface AIResponse {
  model: 'gpt' | 'claude';
  content: GeneratedContent;
  reasoning: string;
  confidence: number;
}

interface DebateResult {
  finalContent: GeneratedContent;
  improvements: string[];
  consensusScore: number;
  iterations: number;
}

export class AIDebateSystem {
  private openai: OpenAI;
  private anthropic: Anthropic;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
  }

  async generateOptimizedContent(theme: ContentTheme, context: string = ''): Promise<DebateResult> {
    const maxIterations = 3;
    let currentIteration = 0;
    let improvements: string[] = [];
    
    // Round 1: Initial proposals
    const gptProposal = await this.getGPTProposal(theme, context);
    const claudeProposal = await this.getClaudeProposal(theme, context);
    
    console.log('🤖 GPT proposta:', gptProposal.content.caption);
    console.log('🎭 Claude proposta:', claudeProposal.content.caption);
    
    // Round 2: Cross-review and critique
    const gptCritique = await this.getGPTCritique(claudeProposal.content, theme);
    const claudeCritique = await this.getClaudeCritique(gptProposal.content, theme);
    
    improvements.push(gptCritique, claudeCritique);
    
    // Round 3: Synthesis and final optimization
    const finalContent = await this.synthesizeResults(
      gptProposal, 
      claudeProposal, 
      gptCritique, 
      claudeCritique,
      theme
    );
    
    const consensusScore = this.calculateConsensusScore(gptProposal, claudeProposal);
    
    return {
      finalContent,
      improvements,
      consensusScore,
      iterations: currentIteration + 1
    };
  }

  private async getGPTProposal(theme: ContentTheme, context: string): Promise<AIResponse> {
    const prompt = `
    Sei un esperto di social media marketing per Up to Ten, centro di ripetizioni scientifiche a Milano.
    
    Tema: ${theme}
    Contesto: ${context}
    
    Crea un post social coinvolgente che:
    - Rifletta la personalità del brand (innovativo, accessibile, orientato ai risultati)
    - Parli agli studenti e genitori di Milano
    - Integri scienza e sport quando possibile
    - Sia educativo ma non noioso
    
    Rispondi in JSON con: caption, hashtags, imagePrompt, reasoning, confidence (1-10)
    `;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      model: 'gpt',
      content: {
        caption: result.caption,
        hashtags: result.hashtags || [],
        imagePrompt: result.imagePrompt,
        theme,
        suggestedTime: this.getOptimalTime(),
        generatedAt: new Date()
      },
      reasoning: result.reasoning || '',
      confidence: result.confidence || 7
    };
  }

  private async getClaudeProposal(theme: ContentTheme, context: string): Promise<AIResponse> {
    const prompt = `
    Sei un content strategist specializzato in educazione STEM per Up to Ten Milano.
    
    Tema: ${theme}
    Contesto: ${context}
    
    Proponi un contenuto social che:
    - Sfrutti l'approccio pratico attraverso lo sport (USP di Up to Ten)
    - Sia autenticamente milanese nel tono
    - Crei curiosità verso le materie scientifiche
    - Includa un elemento di storytelling
    
    Formato JSON: caption, hashtags, imagePrompt, reasoning, confidence (1-10)
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const result = JSON.parse(content.text);
        
        return {
          model: 'claude',
          content: {
            caption: result.caption,
            hashtags: result.hashtags || [],
            imagePrompt: result.imagePrompt,
            theme,
            suggestedTime: this.getOptimalTime(),
            generatedAt: new Date()
          },
          reasoning: result.reasoning || '',
          confidence: result.confidence || 7
        };
      }
    } catch (error) {
      console.log('Claude API non disponibile, uso GPT come fallback');
      return await this.getGPTProposal(theme, context + ' (enhanced creative mode)');
    }

    return await this.getGPTProposal(theme, context);
  }

  private async getGPTCritique(content: GeneratedContent, theme: ContentTheme): Promise<string> {
    const prompt = `
    Analizza questo contenuto per Up to Ten come esperto di marketing educativo:
    
    Caption: "${content.caption}"
    Hashtags: ${content.hashtags.join(', ')}
    
    Valuta:
    1. Chiarezza del messaggio
    2. Appeal per target (studenti/genitori Milano)
    3. Allineamento con brand Up to Ten
    4. Potenziale di engagement
    5. Call-to-action efficacia
    
    Suggerisci 2-3 miglioramenti specifici.
    `;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300
    });

    return response.choices[0].message.content || '';
  }

  private async getClaudeCritique(content: GeneratedContent, theme: ContentTheme): Promise<string> {
    const prompt = `
    Recensisci questo post per Up to Ten dal punto di vista pedagogico e di engagement:
    
    Caption: "${content.caption}"  
    Hashtags: ${content.hashtags.join(', ')}
    
    Focus su:
    - Efficacia educativa
    - Connessione emotiva con studenti
    - Differenziazione dai competitor
    - Integrazione sport-scienza
    
    Proponi miglioramenti concreti.
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }]
      });

      const content_text = response.content[0];
      return content_text.type === 'text' ? content_text.text : '';
    } catch (error) {
      return 'Claude critique non disponibile';
    }
  }

  private async synthesizeResults(
    gptProposal: AIResponse,
    claudeProposal: AIResponse,
    gptCritique: string,
    claudeCritique: string,
    theme: ContentTheme
  ): Promise<GeneratedContent> {
    const synthesisPrompt = `
    Sintetizza le migliori idee da questi due contenuti per Up to Ten:
    
    PROPOSTA GPT:
    Caption: "${gptProposal.content.caption}"
    Hashtags: ${gptProposal.content.hashtags.join(', ')}
    Reasoning: ${gptProposal.reasoning}
    
    PROPOSTA CLAUDE:
    Caption: "${claudeProposal.content.caption}"
    Hashtags: ${claudeProposal.content.hashtags.join(', ')}
    Reasoning: ${claudeProposal.reasoning}
    
    CRITICHE:
    GPT dice: ${gptCritique}
    Claude dice: ${claudeCritique}
    
    Crea la versione FINALE ottimizzata che integra i punti di forza di entrambe.
    JSON: caption, hashtags, imagePrompt
    `;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: synthesisPrompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      caption: result.caption,
      hashtags: result.hashtags || [],
      imagePrompt: result.imagePrompt,
      theme,
      suggestedTime: this.getOptimalTime(),
      generatedAt: new Date()
    };
  }

  private calculateConsensusScore(proposal1: AIResponse, proposal2: AIResponse): number {
    // Calcola similarità tra le proposte (semplificato)
    const caption1Words = proposal1.content.caption.toLowerCase().split(' ');
    const caption2Words = proposal2.content.caption.toLowerCase().split(' ');
    
    const commonWords = caption1Words.filter(word => 
      caption2Words.includes(word) && word.length > 3
    );
    
    const similarity = (commonWords.length * 2) / (caption1Words.length + caption2Words.length);
    const avgConfidence = (proposal1.confidence + proposal2.confidence) / 2;
    
    return Math.round((similarity + avgConfidence / 10) * 50);
  }

  private getOptimalTime(): string {
    const optimalHours = [8, 13, 17, 19, 21];
    const hour = optimalHours[Math.floor(Math.random() * optimalHours.length)];
    return `${hour}:00`;
  }

  async evaluateContentPerformance(content: GeneratedContent, actualEngagement?: any): Promise<{
    score: number;
    insights: string[];
    suggestions: string[];
  }> {
    const evaluationPrompt = `
    Valuta questo contenuto Up to Ten post-pubblicazione:
    
    Caption: "${content.caption}"
    Engagement: ${actualEngagement ? JSON.stringify(actualEngagement) : 'Non disponibile'}
    
    Analizza:
    1. Qualità del copy (1-10)
    2. Rilevanza hashtags (1-10)  
    3. Appeal visuale prompt (1-10)
    4. Engagement previsto vs reale
    
    Restituisci JSON: score (media), insights (array), suggestions (array)
    `;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: evaluationPrompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      score: result.score || 7,
      insights: result.insights || [],
      suggestions: result.suggestions || []
    };
  }
}
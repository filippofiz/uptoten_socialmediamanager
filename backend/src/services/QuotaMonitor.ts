import OpenAI from 'openai';
import { appendFileSync } from 'fs';
import path from 'path';

interface QuotaInfo {
  available: boolean;
  errorCount: number;
  lastError?: string;
  lastErrorTime?: Date;
  lastSuccessTime?: Date;
  estimatedTokensUsed: number;
  imageGenerationAttempts: number;
  imageGenerationSuccesses: number;
}

export class QuotaMonitor {
  private openai: OpenAI;
  private quotaInfo: QuotaInfo = {
    available: true,
    errorCount: 0,
    estimatedTokensUsed: 0,
    imageGenerationAttempts: 0,
    imageGenerationSuccesses: 0
  };

  constructor(openai: OpenAI) {
    this.openai = openai;
    this.loadQuotaInfo();
  }

  private loadQuotaInfo() {
    // In production, you might want to persist this in a database
    // For now, we'll keep it in memory
  }

  private saveQuotaLog() {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...this.quotaInfo
    };
    
    try {
      appendFileSync(
        path.join(process.cwd(), 'quota-monitor.log'),
        JSON.stringify(logEntry) + '\n'
      );
    } catch (e) {
      console.error('Failed to save quota log:', e);
    }
  }

  recordSuccess(type: 'text' | 'image', tokensUsed?: number) {
    this.quotaInfo.available = true;
    this.quotaInfo.lastSuccessTime = new Date();
    
    if (tokensUsed) {
      this.quotaInfo.estimatedTokensUsed += tokensUsed;
    }
    
    if (type === 'image') {
      this.quotaInfo.imageGenerationSuccesses++;
    }
    
    this.saveQuotaLog();
  }

  recordError(error: any, type: 'text' | 'image') {
    this.quotaInfo.errorCount++;
    this.quotaInfo.lastError = error.message || error.toString();
    this.quotaInfo.lastErrorTime = new Date();
    
    if (type === 'image') {
      this.quotaInfo.imageGenerationAttempts++;
    }
    
    // Check if it's a quota error
    if (error.message && error.message.includes('429')) {
      this.quotaInfo.available = false;
    }
    
    this.saveQuotaLog();
  }

  async checkQuotaStatus(): Promise<{
    isAvailable: boolean;
    quotaInfo: QuotaInfo;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    // If we've had recent quota errors, don't retry too soon
    if (!this.quotaInfo.available && this.quotaInfo.lastErrorTime) {
      const timeSinceError = Date.now() - this.quotaInfo.lastErrorTime.getTime();
      const waitTime = 60 * 60 * 1000; // 1 hour
      
      if (timeSinceError < waitTime) {
        recommendations.push(`Attendere ancora ${Math.ceil((waitTime - timeSinceError) / 60000)} minuti prima di riprovare`);
      }
    }
    
    // Try a simple API call to check if quota is available
    if (!this.quotaInfo.available) {
      try {
        // Use a minimal model call to check quota
        await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        });
        
        this.quotaInfo.available = true;
        this.quotaInfo.errorCount = 0;
      } catch (error: any) {
        if (error.message && error.message.includes('429')) {
          recommendations.push('Quota OpenAI esaurita. Controlla il tuo piano su https://platform.openai.com/account/billing');
        }
      }
    }
    
    // General recommendations based on usage
    if (this.quotaInfo.errorCount > 5) {
      recommendations.push('Molti errori rilevati. Verifica le tue credenziali API');
    }
    
    if (this.quotaInfo.imageGenerationAttempts > 0) {
      const successRate = (this.quotaInfo.imageGenerationSuccesses / this.quotaInfo.imageGenerationAttempts) * 100;
      if (successRate < 50) {
        recommendations.push(`Basso tasso di successo per generazione immagini (${successRate.toFixed(1)}%)`);
      }
    }
    
    return {
      isAvailable: this.quotaInfo.available,
      quotaInfo: this.quotaInfo,
      recommendations
    };
  }

  getQuotaInfo(): QuotaInfo {
    return { ...this.quotaInfo };
  }

  resetErrorCount() {
    this.quotaInfo.errorCount = 0;
    this.quotaInfo.available = true;
  }
}
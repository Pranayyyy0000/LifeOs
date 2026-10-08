import {
  AIPlanResponse,
  BigTaskBreakdownResponse,
  FocusContentResponse,
  ProviderStatus,
  QuizResponse,
} from '../../src/types';
import { AIProvider } from './AIProvider';
import { GeminiProvider } from './GeminiProvider';
import { GroqProvider } from './GroqProvider';
import { OpenRouterProvider } from './OpenRouterProvider';

export class AIManager {
  private providers: AIProvider[];

  constructor() {
    this.providers = [
      new GeminiProvider(),
      new GroqProvider(),
      new OpenRouterProvider(),
    ];
  }

  public getStatus(): ProviderStatus {
    const gemini = this.providers[0].isConfigured();
    const groq = this.providers[1].isConfigured();
    const openrouter = this.providers[2].isConfigured();

    let active = 'None configured';
    if (gemini) active = 'Google Gemini (Primary)';
    else if (groq) active = 'Groq (Fallback)';
    else if (openrouter) active = 'OpenRouter (Fallback)';

    return {
      geminiConfigured: gemini,
      groqConfigured: groq,
      openrouterConfigured: openrouter,
      activeProvider: active,
    };
  }

  private async executeWithFallback<T>(
    operationName: string,
    operation: (provider: AIProvider) => Promise<T>
  ): Promise<T> {
    const configuredProviders = this.providers.filter((p) => p.isConfigured());

    if (configuredProviders.length === 0) {
      console.warn(`[AI] ${operationName}: No AI providers configured.`);
      throw new Error(
        'No AI provider is configured. Please provide GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.'
      );
    }

    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of configuredProviders) {
      let attempts = 0;
      const maxAttempts = 2; // 1 initial + 1 retry

      while (attempts < maxAttempts) {
        attempts++;
        try {
          console.log(`[AI] ${operationName}: Trying ${provider.name} (attempt ${attempts}/${maxAttempts})...`);
          const result = await operation(provider);
          console.log(`[AI] ${operationName}: Success with ${provider.name}`);
          return result;
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.warn(`[AI] ${operationName}: ${provider.name} attempt ${attempts} failed: ${errorMsg}`);

          if (attempts < maxAttempts) {
            // Wait 1 second before retrying the same provider
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            errors.push({ provider: provider.name, error: errorMsg });
            console.log(`[AI] ${operationName}: Falling back from ${provider.name} to next provider...`);
          }
        }
      }
    }

    console.error(`[AI] ${operationName}: All configured providers failed.`, errors);
    throw new Error(
      'LifeOS couldn\'t complete this request right now. The AI services are temporarily unavailable.'
    );
  }

  public async extractAndPlan(input: string, nowIso: string): Promise<AIPlanResponse> {
    return this.executeWithFallback('extractAndPlan', (p) => p.extractAndPlan(input, nowIso));
  }

  public async breakDownBigTask(task: string, level: string): Promise<BigTaskBreakdownResponse> {
    return this.executeWithFallback('breakDownBigTask', (p) => p.breakDownBigTask(task, level));
  }

  public async generateFocusContent(
    taskTitle: string,
    taskDescription: string,
    category: string
  ): Promise<FocusContentResponse> {
    return this.executeWithFallback('generateFocusContent', (p) =>
      p.generateFocusContent(taskTitle, taskDescription, category)
    );
  }

  public async generateQuiz(topic: string, taskTitle: string): Promise<QuizResponse> {
    return this.executeWithFallback('generateQuiz', (p) => p.generateQuiz(topic, taskTitle));
  }

  public async adaptPlan(
    currentPlan: AIPlanResponse,
    triggerEvent: string,
    actionsLog?: string
  ): Promise<AIPlanResponse> {
    return this.executeWithFallback('adaptPlan', (p) =>
      p.adaptPlan(currentPlan, triggerEvent, actionsLog)
    );
  }
}

export const aiManager = new AIManager();

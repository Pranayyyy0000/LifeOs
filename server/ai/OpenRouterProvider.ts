import {
  AIPlanResponse,
  BigTaskBreakdownResponse,
  FocusContentResponse,
  QuizResponse,
} from '../../src/types';
import { AIProvider } from './AIProvider';
import {
  ADAPT_PLAN_PROMPT,
  BIG_TASK_PROMPT,
  FOCUS_PROMPT,
  PLAN_EXTRACTION_PROMPT,
  QUIZ_PROMPT,
} from './prompts';
import {
  validateAIPlanResponse,
  validateBigTaskResponse,
  validateFocusContentResponse,
  validateQuizResponse,
} from './validate';

export class OpenRouterProvider implements AIProvider {
  public readonly name = 'OpenRouter';

  public isConfigured(): boolean {
    const key = process.env.OPENROUTER_API_KEY;
    return !!(key && key.trim().length > 0);
  }

  private getModelName(): string {
    return process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';
  }

  private async generateJson<T>(prompt: string): Promise<T> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not configured');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key.trim()}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'LifeOS',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.getModelName(),
          messages: [
            {
              role: 'system',
              content: 'You are the LifeOS intelligence engine. Always respond with strictly valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API returned HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenRouter returned an empty response');
      }

      return JSON.parse(content.trim()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async extractAndPlan(input: string, nowIso: string): Promise<AIPlanResponse> {
    const prompt = PLAN_EXTRACTION_PROMPT(input, nowIso);
    const parsed = await this.generateJson<unknown>(prompt);
    return validateAIPlanResponse(parsed, nowIso, input);
  }

  public async breakDownBigTask(task: string, level: string): Promise<BigTaskBreakdownResponse> {
    const prompt = BIG_TASK_PROMPT(task, level);
    const parsed = await this.generateJson<unknown>(prompt);
    return validateBigTaskResponse(parsed, task, level);
  }

  public async generateFocusContent(
    taskTitle: string,
    taskDescription: string,
    category: string
  ): Promise<FocusContentResponse> {
    const prompt = FOCUS_PROMPT(taskTitle, taskDescription, category);
    const parsed = await this.generateJson<unknown>(prompt);
    return validateFocusContentResponse(parsed, taskTitle);
  }

  public async generateQuiz(topic: string, taskTitle: string): Promise<QuizResponse> {
    const prompt = QUIZ_PROMPT(topic, taskTitle);
    const parsed = await this.generateJson<unknown>(prompt);
    return validateQuizResponse(parsed, topic, taskTitle);
  }

  public async adaptPlan(
    currentPlan: AIPlanResponse,
    triggerEvent: string,
    actionsLog?: string
  ): Promise<AIPlanResponse> {
    const prompt = ADAPT_PLAN_PROMPT(JSON.stringify(currentPlan), triggerEvent, actionsLog);
    const parsed = await this.generateJson<unknown>(prompt);
    return validateAIPlanResponse(parsed, new Date().toISOString(), triggerEvent);
  }
}

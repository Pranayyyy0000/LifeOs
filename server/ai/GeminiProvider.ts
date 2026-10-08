import { GoogleGenAI } from '@google/genai';
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

export class GeminiProvider implements AIProvider {
  public readonly name = 'Google Gemini';
  private client: GoogleGenAI | null = null;

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (key && key.trim().length > 0) {
      this.client = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
          timeout: 90000,
        },
      });
    }
  }

  public isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!(key && key.trim().length > 0);
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY is not configured');
      this.client = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
          timeout: 90000,
        },
      });
    }
    return this.client;
  }

  private getCandidateModels(): string[] {
    const configured = process.env.GEMINI_MODEL;
    if (configured) {
      return [configured, 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    }
    return ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  }

  private async generateJson<T>(prompt: string): Promise<T> {
    const ai = this.getClient();
    const candidateModels = this.getCandidateModels();
    let lastError: unknown = null;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const raw = response.text;
        if (!raw) {
          throw new Error(`Gemini (${model}) returned an empty response`);
        }

        try {
          return JSON.parse(raw.trim()) as T;
        } catch {
          const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          return JSON.parse(cleaned) as T;
        }
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[AI] Gemini model ${model} failed: ${msg}. Attempting next model...`);
        // If it's a quota or rate limit error, immediately try the alternate model
        continue;
      }
    }

    throw lastError || new Error('All Gemini candidate models failed');
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

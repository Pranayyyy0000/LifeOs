import {
  AIPlanResponse,
  BigTaskBreakdownResponse,
  FocusContentResponse,
  ProviderStatus,
  QuizResponse,
} from '../types';

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = {
  async getStatus(): Promise<ProviderStatus> {
    const res = await fetch('/api/ai/status');
    const data = await res.json() as { success: boolean; data?: ProviderStatus; error?: string };
    if (!res.ok || !data.success || !data.data) {
      throw new ApiError(data.error || 'Failed to fetch AI provider status', res.status);
    }
    return data.data;
  },

  async extractAndPlan(input: string): Promise<AIPlanResponse> {
    const res = await fetch('/api/ai/extract-and-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        nowIso: new Date().toISOString(),
      }),
    });

    const data = await res.json() as { success: boolean; data?: AIPlanResponse; error?: string };
    if (!res.ok || !data.success || !data.data) {
      throw new ApiError(data.error || 'Something went wrong while creating your plan.', res.status);
    }
    return data.data;
  },

  async breakDownBigTask(task: string, level: string): Promise<BigTaskBreakdownResponse> {
    const res = await fetch('/api/ai/breakdown-big-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, level }),
    });

    const data = await res.json() as { success: boolean; data?: BigTaskBreakdownResponse; error?: string };
    if (!res.ok || !data.success || !data.data) {
      throw new ApiError(data.error || 'Failed to break down this task.', res.status);
    }
    return data.data;
  },

  async generateFocusContent(
    taskTitle: string,
    taskDescription: string,
    category: string
  ): Promise<FocusContentResponse> {
    const res = await fetch('/api/ai/focus-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskTitle, taskDescription, category }),
    });

    const data = await res.json() as { success: boolean; data?: FocusContentResponse; error?: string };
    if (!res.ok || !data.success || !data.data) {
      throw new ApiError(data.error || 'Failed to generate focus content.', res.status);
    }
    return data.data;
  },

  async generateQuiz(topic: string, taskTitle: string): Promise<QuizResponse> {
    const res = await fetch('/api/ai/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, taskTitle }),
    });

    const data = await res.json() as { success: boolean; data?: QuizResponse; error?: string };
    if (!res.ok || !data.success || !data.data) {
      throw new ApiError(data.error || 'Failed to generate quiz.', res.status);
    }
    return data.data;
  },

  async adaptPlan(
    currentPlan: AIPlanResponse,
    triggerEvent: string,
    actionsLog?: string
  ): Promise<AIPlanResponse> {
    const res = await fetch('/api/ai/adapt-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan, triggerEvent, actionsLog }),
    });

    const data = await res.json() as { success: boolean; data?: AIPlanResponse; error?: string };
    if (!res.ok || !data.success || !data.data) {
      throw new ApiError(data.error || 'Failed to adapt plan.', res.status);
    }
    return data.data;
  },
};

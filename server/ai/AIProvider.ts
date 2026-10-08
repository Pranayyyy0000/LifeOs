import {
  AIPlanResponse,
  BigTaskBreakdownResponse,
  FocusContentResponse,
  QuizResponse,
} from '../../src/types';

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  extractAndPlan(input: string, nowIso: string, context?: unknown): Promise<AIPlanResponse>;
  breakDownBigTask(task: string, level: string): Promise<BigTaskBreakdownResponse>;
  generateFocusContent(taskTitle: string, taskDescription: string, category: string): Promise<FocusContentResponse>;
  generateQuiz(topic: string, taskTitle: string): Promise<QuizResponse>;
  adaptPlan(currentPlan: AIPlanResponse, triggerEvent: string, actionsLog?: string): Promise<AIPlanResponse>;
}

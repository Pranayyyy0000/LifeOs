import { AIPlanResponse, BigTaskBreakdownResponse, QuizResult, Task, UserAction } from '../types';

const STORAGE_KEYS = {
  CURRENT_PLAN: 'lifeos_current_plan',
  BIG_TASKS: 'lifeos_big_tasks',
  QUIZ_RESULTS: 'lifeos_quiz_results',
  USER_PREFERENCES: 'lifeos_user_preferences',
  ACTION_JOURNAL: 'lifeos_action_journal',
} as const;

export interface UserPreferences {
  wakeTime: string; // "07:00"
  sleepTime: string; // "23:00"
  preferredStudyBlockHours: number; // e.g. 2
}

const DEFAULT_PREFS: UserPreferences = {
  wakeTime: '07:00',
  sleepTime: '23:00',
  preferredStudyBlockHours: 2,
};

export const storage = {
  savePlan(plan: AIPlanResponse): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_PLAN, JSON.stringify(plan));
    } catch (e) {
      console.error('Failed to save plan to storage', e);
    }
  },

  loadPlan(): AIPlanResponse | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_PLAN);
      if (!data) return null;
      return JSON.parse(data) as AIPlanResponse;
    } catch (e) {
      console.error('Failed to load plan from storage', e);
      return null;
    }
  },

  updateTaskInPlan(updatedTask: Task): AIPlanResponse | null {
    const current = this.loadPlan();
    if (!current) return null;

    const taskIndex = current.tasks.findIndex((t) => t.id === updatedTask.id);
    if (taskIndex === -1) {
      current.tasks.push(updatedTask);
    } else {
      current.tasks[taskIndex] = updatedTask;
    }

    this.savePlan(current);
    return current;
  },

  deleteTaskFromPlan(taskId: string): AIPlanResponse | null {
    const current = this.loadPlan();
    if (!current) return null;

    current.tasks = current.tasks.filter((t) => t.id !== taskId);
    this.savePlan(current);
    return current;
  },

  saveBigTask(bigTask: BigTaskBreakdownResponse): void {
    try {
      const list = this.loadBigTasks();
      const existingIdx = list.findIndex((b) => b.id === bigTask.id || b.bigTask === bigTask.bigTask);
      if (existingIdx !== -1) {
        list[existingIdx] = bigTask;
      } else {
        list.unshift(bigTask);
      }
      localStorage.setItem(STORAGE_KEYS.BIG_TASKS, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save big task', e);
    }
  },

  loadBigTasks(): BigTaskBreakdownResponse[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BIG_TASKS);
      if (!data) return [];
      return JSON.parse(data) as BigTaskBreakdownResponse[];
    } catch (e) {
      console.error('Failed to load big tasks', e);
      return [];
    }
  },

  saveQuizResult(result: QuizResult): void {
    try {
      const list = this.loadQuizResults();
      list.unshift(result);
      localStorage.setItem(STORAGE_KEYS.QUIZ_RESULTS, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save quiz result', e);
    }
  },

  loadQuizResults(): QuizResult[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUIZ_RESULTS);
      if (!data) return [];
      return JSON.parse(data) as QuizResult[];
    } catch (e) {
      console.error('Failed to load quiz results', e);
      return [];
    }
  },

  savePreferences(prefs: UserPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs));
    } catch (e) {
      console.error('Failed to save user preferences', e);
    }
  },

  loadPreferences(): UserPreferences {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      if (!data) return DEFAULT_PREFS;
      return { ...DEFAULT_PREFS, ...JSON.parse(data) };
    } catch (e) {
      return DEFAULT_PREFS;
    }
  },

  recordAction(action: Omit<UserAction, 'id' | 'timestamp'>): UserAction {
    const newAction: UserAction = {
      ...action,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    try {
      const list = this.loadActions();
      list.unshift(newAction);
      // Keep recent 50 actions
      localStorage.setItem(STORAGE_KEYS.ACTION_JOURNAL, JSON.stringify(list.slice(0, 50)));
    } catch (e) {
      console.error('Failed to save user action', e);
    }
    return newAction;
  },

  loadActions(): UserAction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTION_JOURNAL);
      if (!data) return [];
      return JSON.parse(data) as UserAction[];
    } catch (e) {
      console.error('Failed to load user actions', e);
      return [];
    }
  },

  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_PLAN);
      localStorage.removeItem(STORAGE_KEYS.BIG_TASKS);
      localStorage.removeItem(STORAGE_KEYS.QUIZ_RESULTS);
      localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
      localStorage.removeItem(STORAGE_KEYS.ACTION_JOURNAL);
    } catch (e) {
      console.error('Failed to reset storage', e);
    }
  },
};

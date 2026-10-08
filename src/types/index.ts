export type TaskImportance = 'low' | 'medium' | 'high';

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'missed';

export type ScheduleCategory = 'work' | 'break' | 'fixed' | 'meal' | 'sleep';

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  estimatedHours: number;
  importance: TaskImportance;
  priorityReason: string;
  dependencies: string[];
  status: TaskStatus;
  category: ScheduleCategory;
  scheduledStart?: string; // HH:MM or ISO
  scheduledEnd?: string;   // HH:MM or ISO
  date?: string;           // YYYY-MM-DD
}

export interface FixedCommitment {
  id: string;
  title: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  days?: string[];   // e.g. ["Monday", "Tuesday"] or ["daily"]
}

export interface ScheduleTightness {
  isTight: boolean;
  requiredHours: number;
  availableHours: number;
  shortageHours?: number;
  message?: string;
  suggestions?: string[];
}

export interface DoThisFirst {
  taskId: string;
  taskTitle: string;
  reason: string;
  firstMove: string;
}

export interface UserAction {
  id: string;
  type:
    | 'task_completed'
    | 'task_uncompleted'
    | 'task_missed'
    | 'task_duration_changed'
    | 'task_importance_changed'
    | 'task_deleted'
    | 'task_added';
  taskId: string;
  taskTitle: string;
  details?: string;
  timestamp: string;
}

export interface AdaptationNotice {
  headline: string; // e.g. "Your plan changed."
  explanation: string; // e.g. "SQL practice moved to tomorrow so your interview revision stays protected."
  actionSummary?: string[];
  timestamp: string;
}

export interface AIPlanResponse {
  id?: string;
  createdAt: string;
  goal: string;
  tasks: Task[];
  constraints: string[];
  assumptions: string[];
  clarifyingQuestions: string[];
  scheduleTightness: ScheduleTightness;
  doThisFirst: DoThisFirst;
  adaptationNotice?: AdaptationNotice;
}

export interface BigTaskStep {
  stepNumber: number;
  title: string;
  explanation: string;
  estimatedTime: string;
  deliverable: string;
  prerequisites: string[];
  firstMove: string;
  copyReadyPrompt: string;
}

export interface BigTaskBreakdownResponse {
  id?: string;
  createdAt: string;
  bigTask: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  overview: string;
  firstMove: string;
  steps: BigTaskStep[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface QuizResponse {
  id?: string;
  topic: string;
  taskTitle: string;
  questions: QuizQuestion[];
  recommendationIfPassed: string;
  recommendationIfStruggled: string;
}

export interface QuizResult {
  quizId: string;
  taskTitle: string;
  topic: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  completedAt: string;
  recommendation: string;
}

export interface FocusContentResponse {
  taskTitle: string;
  whyItMatters: string;
  estimatedTime: string;
  firstMove: string;
  conciseGuide: string[];
  potentialPitfalls: string[];
  quickSelfCheckQuestion: string;
}

export interface ProviderStatus {
  geminiConfigured: boolean;
  groqConfigured: boolean;
  openrouterConfigured: boolean;
  activeProvider: string;
}

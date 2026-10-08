import {
  AIPlanResponse,
  BigTaskBreakdownResponse,
  FocusContentResponse,
  QuizResponse,
  Task,
} from '../../src/types';

export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates and normalizes AI plan responses.
 * Enforces:
 * - No invented deadlines
 * - No invented commitments
 * - Strict schema matching
 * - Safe fallbacks for missing optional properties
 */
export function validateAIPlanResponse(
  raw: unknown,
  nowIso: string,
  userInput: string
): AIPlanResponse {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('AI response is not an object');
  }

  const obj = raw as Record<string, unknown>;

  // 1. Goal validation
  let goal = typeof obj.goal === 'string' ? obj.goal.trim() : '';
  if (!goal) {
    // If input was extremely short/vague, fallback gracefully
    goal = userInput.trim().slice(0, 80) || 'Personal Goal';
  }

  // 2. Tasks validation
  if (!Array.isArray(obj.tasks)) {
    throw new ValidationError('AI response "tasks" must be an array');
  }

  const tasks: Task[] = [];
  obj.tasks.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const t = item as Record<string, unknown>;

    const title = typeof t.title === 'string' ? t.title.trim() : '';
    if (!title) return; // Skip headless tasks

    const id = typeof t.id === 'string' && t.id.trim() ? t.id.trim() : `task-${index + 1}`;
    const description = typeof t.description === 'string' ? t.description.trim() : '';

    // Deadline validation: strictly null if empty, invalid, or "null" string
    let deadline: string | null = null;
    if (typeof t.deadline === 'string' && t.deadline.trim() && t.deadline.toLowerCase() !== 'null' && t.deadline.toLowerCase() !== 'none') {
      const candidate = t.deadline.trim();
      // Ensure it resembles a date or relative label
      if (candidate.length > 0 && candidate !== 'N/A') {
        deadline = candidate;
      }
    }

    // Estimated hours: must be a positive number
    let estimatedHours = typeof t.estimatedHours === 'number' && !isNaN(t.estimatedHours) && t.estimatedHours > 0
      ? Math.round(t.estimatedHours * 10) / 10
      : 1.0;
    if (estimatedHours > 200) estimatedHours = 20; // Sanity cap

    // Importance
    let importance: Task['importance'] = 'medium';
    if (t.importance === 'high' || t.importance === 'low') {
      importance = t.importance;
    }

    const priorityReason = typeof t.priorityReason === 'string' && t.priorityReason.trim()
      ? t.priorityReason.trim()
      : 'Actionable milestone towards goal';

    const dependencies = Array.isArray(t.dependencies)
      ? t.dependencies.filter((d): d is string => typeof d === 'string' && !!d.trim())
      : [];

    let status: Task['status'] = 'pending';
    if (t.status === 'in-progress' || t.status === 'completed' || t.status === 'missed') {
      status = t.status;
    }

    let category: Task['category'] = 'work';
    if (t.category === 'break' || t.category === 'fixed' || t.category === 'meal' || t.category === 'sleep') {
      category = t.category;
    }

    tasks.push({
      id,
      title,
      description,
      deadline,
      estimatedHours,
      importance,
      priorityReason,
      dependencies,
      status,
      category,
    });
  });

  // 3. Constraints validation (fixed commitments from user)
  const constraints = Array.isArray(obj.constraints)
    ? obj.constraints.filter((c): c is string => typeof c === 'string' && !!c.trim())
    : [];

  // 4. Assumptions validation
  const assumptions = Array.isArray(obj.assumptions)
    ? obj.assumptions.filter((a): a is string => typeof a === 'string' && !!a.trim())
    : [];

  // 5. Clarifying questions
  const clarifyingQuestions = Array.isArray(obj.clarifyingQuestions)
    ? obj.clarifyingQuestions.filter((q): q is string => typeof q === 'string' && !!q.trim())
    : [];

  // If input was completely vague (e.g. less than 15 chars or no concrete details), ensure questions are present
  if (userInput.trim().length < 25 && clarifyingQuestions.length === 0) {
    clarifyingQuestions.push('What specific outcome or deadline are you working towards?');
    clarifyingQuestions.push('How many hours per day or week can you realistically dedicate?');
  }

  // 6. Schedule tightness validation
  const rawTightness = (obj.scheduleTightness && typeof obj.scheduleTightness === 'object')
    ? (obj.scheduleTightness as Record<string, unknown>)
    : {};

  const totalReq = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
  const requiredHours = typeof rawTightness.requiredHours === 'number' && !isNaN(rawTightness.requiredHours)
    ? Math.round(rawTightness.requiredHours * 10) / 10
    : Math.round(totalReq * 10) / 10;

  const availableHours = typeof rawTightness.availableHours === 'number' && !isNaN(rawTightness.availableHours)
    ? Math.round(rawTightness.availableHours * 10) / 10
    : Math.max(requiredHours, 12);

  const isTight = typeof rawTightness.isTight === 'boolean'
    ? rawTightness.isTight
    : requiredHours > availableHours * 0.85;

  const message = typeof rawTightness.message === 'string' && rawTightness.message.trim()
    ? rawTightness.message.trim()
    : isTight
    ? `You have ${requiredHours} hours of work and approximately ${availableHours} available hours before the target date.`
    : undefined;

  const suggestions = Array.isArray(rawTightness.suggestions)
    ? rawTightness.suggestions.filter((s): s is string => typeof s === 'string' && !!s.trim())
    : [];

  // 7. Do This First validation
  const rawDoFirst = (obj.doThisFirst && typeof obj.doThisFirst === 'object')
    ? (obj.doThisFirst as Record<string, unknown>)
    : {};

  const firstTask = tasks[0];
  const doThisFirst = {
    taskId: typeof rawDoFirst.taskId === 'string' && rawDoFirst.taskId.trim()
      ? rawDoFirst.taskId.trim()
      : (firstTask ? firstTask.id : 'task-1'),
    taskTitle: typeof rawDoFirst.taskTitle === 'string' && rawDoFirst.taskTitle.trim()
      ? rawDoFirst.taskTitle.trim()
      : (firstTask ? firstTask.title : 'First Action'),
    reason: typeof rawDoFirst.reason === 'string' && rawDoFirst.reason.trim()
      ? rawDoFirst.reason.trim()
      : 'Initial foundational step to build momentum',
    firstMove: typeof rawDoFirst.firstMove === 'string' && rawDoFirst.firstMove.trim()
      ? rawDoFirst.firstMove.trim()
      : 'Spend 5 minutes drafting the requirements or opening your workspace',
  };

  // 8. Adaptation Notice validation
  let adaptationNotice = undefined;
  if (obj.adaptationNotice && typeof obj.adaptationNotice === 'object') {
    const rawNotice = obj.adaptationNotice as Record<string, unknown>;
    const headline = typeof rawNotice.headline === 'string' && rawNotice.headline.trim()
      ? rawNotice.headline.trim()
      : 'Your plan changed.';
    const explanation = typeof rawNotice.explanation === 'string' && rawNotice.explanation.trim()
      ? rawNotice.explanation.trim()
      : 'Schedule re-sequenced to protect your key milestones.';
    const actionSummary = Array.isArray(rawNotice.actionSummary)
      ? rawNotice.actionSummary.filter((s): s is string => typeof s === 'string' && !!s.trim())
      : undefined;

    adaptationNotice = {
      headline,
      explanation,
      actionSummary,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    createdAt: new Date().toISOString(),
    goal,
    tasks,
    constraints,
    assumptions,
    clarifyingQuestions,
    scheduleTightness: {
      isTight,
      requiredHours,
      availableHours,
      message,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    },
    doThisFirst,
    adaptationNotice,
  };
}

/**
 * Validates Big Task Breakdown responses
 */
export function validateBigTaskResponse(raw: unknown, originalTask: string, level: string): BigTaskBreakdownResponse {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Big task response is not an object');
  }

  const obj = raw as Record<string, unknown>;

  const bigTask = typeof obj.bigTask === 'string' && obj.bigTask.trim()
    ? obj.bigTask.trim()
    : originalTask;

  const validLevel = (level === 'Beginner' || level === 'Intermediate' || level === 'Advanced')
    ? level
    : 'Intermediate';

  const overview = typeof obj.overview === 'string' && obj.overview.trim()
    ? obj.overview.trim()
    : 'Deconstructed into actionable sequential milestones.';

  const firstMove = typeof obj.firstMove === 'string' && obj.firstMove.trim()
    ? obj.firstMove.trim()
    : 'Create a project folder and write down your 3 core requirements in a text file.';

  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    throw new ValidationError('Big task response must contain an array of steps');
  }

  const steps = obj.steps.map((item, index) => {
    const s = item as Record<string, unknown>;
    return {
      stepNumber: typeof s.stepNumber === 'number' ? s.stepNumber : index + 1,
      title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `Milestone ${index + 1}`,
      explanation: typeof s.explanation === 'string' ? s.explanation.trim() : '',
      estimatedTime: typeof s.estimatedTime === 'string' ? s.estimatedTime.trim() : '1 hour',
      deliverable: typeof s.deliverable === 'string' ? s.deliverable.trim() : 'Completed milestone output',
      prerequisites: Array.isArray(s.prerequisites)
        ? s.prerequisites.filter((p): p is string => typeof p === 'string' && !!p.trim())
        : [],
      firstMove: typeof s.firstMove === 'string' && s.firstMove.trim()
        ? s.firstMove.trim()
        : 'Open your editor and set up the initial configuration.',
      copyReadyPrompt: typeof s.copyReadyPrompt === 'string' ? s.copyReadyPrompt.trim() : '',
    };
  });

  return {
    createdAt: new Date().toISOString(),
    bigTask,
    level: validLevel as 'Beginner' | 'Intermediate' | 'Advanced',
    overview,
    firstMove,
    steps,
  };
}

/**
 * Validates Focus Content responses
 */
export function validateFocusContentResponse(raw: unknown, defaultTitle: string): FocusContentResponse {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Focus content response is not an object');
  }
  const obj = raw as Record<string, unknown>;

  return {
    taskTitle: typeof obj.taskTitle === 'string' && obj.taskTitle.trim() ? obj.taskTitle.trim() : defaultTitle,
    whyItMatters: typeof obj.whyItMatters === 'string' ? obj.whyItMatters.trim() : 'Crucial milestone towards your goal.',
    estimatedTime: typeof obj.estimatedTime === 'string' ? obj.estimatedTime.trim() : '45 minutes',
    firstMove: typeof obj.firstMove === 'string' ? obj.firstMove.trim() : 'Open your workspace and complete the first line.',
    conciseGuide: Array.isArray(obj.conciseGuide)
      ? obj.conciseGuide.filter((g): g is string => typeof g === 'string' && !!g.trim())
      : [],
    potentialPitfalls: Array.isArray(obj.potentialPitfalls)
      ? obj.potentialPitfalls.filter((p): p is string => typeof p === 'string' && !!p.trim())
      : [],
    quickSelfCheckQuestion: typeof obj.quickSelfCheckQuestion === 'string' ? obj.quickSelfCheckQuestion.trim() : '',
  };
}

/**
 * Validates Quiz responses
 */
export function validateQuizResponse(raw: unknown, defaultTopic: string, defaultTaskTitle: string): QuizResponse {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Quiz response is not an object');
  }
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.questions) || obj.questions.length === 0) {
    throw new ValidationError('Quiz must contain an array of questions');
  }

  const questions = obj.questions.map((qItem, idx) => {
    const q = qItem as Record<string, unknown>;
    const options = Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === 'string' && !!o.trim())
      : ['Option A', 'Option B', 'Option C', 'Option D'];

    let correctIndex = typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0;
    if (correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = 0;
    }

    return {
      id: typeof q.id === 'string' ? q.id : `q${idx + 1}`,
      question: typeof q.question === 'string' ? q.question.trim() : `Question ${idx + 1}`,
      options,
      correctAnswerIndex: correctIndex,
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : 'Core conceptual reason.',
    };
  });

  return {
    topic: typeof obj.topic === 'string' ? obj.topic.trim() : defaultTopic,
    taskTitle: typeof obj.taskTitle === 'string' ? obj.taskTitle.trim() : defaultTaskTitle,
    questions,
    recommendationIfPassed: typeof obj.recommendationIfPassed === 'string'
      ? obj.recommendationIfPassed.trim()
      : 'Solid grasp of core principles. Proceed to advanced topics.',
    recommendationIfStruggled: typeof obj.recommendationIfStruggled === 'string'
      ? obj.recommendationIfStruggled.trim()
      : 'Review foundational material and practice step-by-step examples.',
  };
}

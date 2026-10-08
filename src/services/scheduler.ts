import { AdaptationNotice, AIPlanResponse, FixedCommitment, ScheduleTightness, Task } from '../types';

export interface TimeSlot {
  start: string; // HH:MM
  end: string;   // HH:MM
  category: 'work' | 'break' | 'fixed' | 'meal' | 'sleep';
  title: string;
  taskId?: string;
  isPassed?: boolean;
}

export interface DayTimelineResult {
  slots: TimeSlot[];
  scheduledTasks: Task[];
  unscheduledTasks: Task[];
  totalWorkMinutes: number;
  availableWorkMinutes: number;
  shortageHours: number;
  isImpossible: boolean;
}

/**
 * Parses "HH:MM" string to minutes from start of day (0-1439)
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return (isNaN(hours) ? 0 : Math.min(23, Math.max(0, hours))) * 60 +
         (isNaN(minutes) ? 0 : Math.min(59, Math.max(0, minutes)));
}

/**
 * Formats minutes from midnight into 24h "HH:MM" format
 */
export function minutesToTimeString(minutes: number): string {
  const normalized = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Calculates days remaining from reference date to target deadline
 */
export function getDaysDifference(
  deadlineStr: string | null,
  referenceDate: Date = new Date()
): number | null {
  if (!deadlineStr) return null;
  const parsed = new Date(deadlineStr);
  if (isNaN(parsed.getTime())) return null;

  const refDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const targetDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());

  const diffMs = targetDay.getTime() - refDay.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates deterministic priority score for a task based on:
 * - Deadline urgency (closest deadlines first)
 * - Importance ('high' > 'medium' > 'low')
 * - Prerequisite / blocking impact
 * - Actionable effort
 */
export function calculateTaskPriority(
  task: Task,
  referenceDate: Date = new Date(),
  allTasks: Task[] = []
): number {
  let score = 0;

  // 1. Deadline urgency calculation
  const daysDiff = getDaysDifference(task.deadline, referenceDate);
  if (daysDiff !== null) {
    if (daysDiff <= 0) {
      score += 100; // Due today or overdue
    } else if (daysDiff === 1) {
      score += 80;  // Due tomorrow
    } else if (daysDiff <= 3) {
      score += 60;  // Due within 3 days
    } else if (daysDiff <= 7) {
      score += 40;  // Due within a week
    } else if (daysDiff <= 14) {
      score += 20;  // Due within two weeks
    } else {
      score += 10;
    }
  } else {
    // No explicit deadline
    score += 5;
  }

  // 2. Importance weighting
  if (task.importance === 'high') score += 40;
  else if (task.importance === 'medium') score += 20;
  else score += 5;

  // 3. Dependency structure:
  // If this task blocks other tasks, prioritize it
  const dependentsCount = allTasks.filter((t) =>
    t.dependencies && (t.dependencies.includes(task.title) || t.dependencies.includes(task.id))
  ).length;
  score += dependentsCount * 12;

  // If this task has unresolved dependencies, penalize so prerequisites are scheduled first
  const hasUnmetDependencies = (task.dependencies || []).some((depName) => {
    const parent = allTasks.find((t) => t.title === depName || t.id === depName);
    return parent && parent.status !== 'completed';
  });
  if (hasUnmetDependencies) {
    score -= 35;
  }

  // 4. Momentum tie-break: shorter tasks (<= 1.5h) get a slight nudge
  if (task.estimatedHours <= 1.5) {
    score += 4;
  }

  return score;
}

/**
 * Topologically sorts tasks ensuring prerequisites are scheduled before dependents,
 * resolving ties by calculated priority score.
 */
export function topologicalSortTasks(tasks: Task[], referenceDate: Date = new Date()): Task[] {
  const completedTaskTitles = new Set(
    tasks.filter((t) => t.status === 'completed').map((t) => t.title)
  );
  const completedTaskIds = new Set(
    tasks.filter((t) => t.status === 'completed').map((t) => t.id)
  );

  // Score all tasks
  const scores = new Map<string, number>();
  for (const t of tasks) {
    scores.set(t.id, calculateTaskPriority(t, referenceDate, tasks));
  }

  const sorted: Task[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  const pendingTasks = tasks.filter((t) => t.status !== 'completed');

  function visit(task: Task) {
    if (visited.has(task.id)) return;
    if (inStack.has(task.id)) {
      // Cyclic dependency detected: break cycle
      visited.add(task.id);
      sorted.push(task);
      return;
    }

    inStack.add(task.id);

    // Visit uncompleted prerequisite tasks first
    const prerequisites = (task.dependencies || [])
      .map((dep) => pendingTasks.find((p) => p.title === dep || p.id === dep))
      .filter((p): p is Task => p !== undefined && !completedTaskTitles.has(p.title) && !completedTaskIds.has(p.id));

    // Sort prerequisites by score
    prerequisites.sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));

    for (const prereq of prerequisites) {
      visit(prereq);
    }

    inStack.delete(task.id);
    visited.add(task.id);
    sorted.push(task);
  }

  // Sort candidate list by priority score before topological pass
  const candidates = [...pendingTasks].sort(
    (a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0)
  );

  for (const task of candidates) {
    visit(task);
  }

  return sorted;
}

/**
 * Evaluates whether the user's workload fits realistically into available time.
 * Calculates exact shortages and never silently pretends an impossible schedule fits.
 */
export function evaluateScheduleTightness(
  tasks: Task[],
  availableDailyHours: number,
  planningDays: number = 7,
  explicitShortageHours?: number
): ScheduleTightness {
  // Only count tasks that are not completed
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const totalRequiredHours = pendingTasks.reduce(
    (sum, t) => sum + (t.estimatedHours && t.estimatedHours > 0 ? t.estimatedHours : 1),
    0
  );

  const roundedRequired = Math.round(totalRequiredHours * 10) / 10;
  const safeDailyHours = Math.max(0, availableDailyHours);
  const totalAvailableHours = Math.round(safeDailyHours * planningDays * 10) / 10;

  // Shortage calculation
  const calculatedShortage = explicitShortageHours !== undefined
    ? Math.round(explicitShortageHours * 10) / 10
    : Math.max(0, Math.round((roundedRequired - totalAvailableHours) * 10) / 10);

  const isTight = calculatedShortage > 0 || (totalAvailableHours > 0 && roundedRequired > totalAvailableHours * 0.85);

  const suggestions: string[] = [];

  if (safeDailyHours === 0) {
    suggestions.push('No open hours exist outside your fixed commitments and sleep blocks today.');
    suggestions.push('Reduce or reschedule fixed commitments to free up study time.');
    suggestions.push('Defer tasks to a day with open availability.');
    return {
      isTight: true,
      requiredHours: roundedRequired,
      availableHours: 0,
      shortageHours: roundedRequired,
      message: `You have ${roundedRequired} hours of work but 0.0 available hours today due to fixed commitments and sleep.`,
      suggestions,
    };
  }

  if (calculatedShortage > 0) {
    suggestions.push(`Workload exceeds available time by ${calculatedShortage} hours.`);
    suggestions.push('Move lower-priority tasks out of this planning window.');
    suggestions.push('Reduce task scope to absolute essentials.');
    if (planningDays > 1) {
      suggestions.push('Increase daily study block or negotiate deadline extension.');
    }
  } else if (isTight) {
    suggestions.push('Buffer is under 15%—any unexpected interruption could threaten the deadline.');
    suggestions.push('Execute highest-priority tasks first before starting secondary items.');
  }

  const message = calculatedShortage > 0
    ? `You have ${roundedRequired} hours of work and approximately ${totalAvailableHours} available hours before the deadline. Shortage: ${calculatedShortage} hours.`
    : isTight
    ? `You have ${roundedRequired} hours of work and approximately ${totalAvailableHours} available hours. Schedule is tight with minimal buffer.`
    : undefined;

  return {
    isTight,
    requiredHours: roundedRequired,
    availableHours: totalAvailableHours,
    shortageHours: calculatedShortage > 0 ? calculatedShortage : undefined,
    message,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Calculates continuous free work intervals for a day
 */
interface Interval {
  start: number;
  end: number;
}

function getNonWorkIntervals(
  fixedCommitments: FixedCommitment[],
  wakeMinutes: number,
  sleepMinutes: number,
  includeMeals: boolean = true
): { intervals: (Interval & { category: TimeSlot['category']; title: string })[] } {
  const intervals: (Interval & { category: TimeSlot['category']; title: string })[] = [];

  // Sleep night block: 00:00 to wake
  if (wakeMinutes > 0) {
    intervals.push({
      start: 0,
      end: wakeMinutes,
      category: 'sleep',
      title: 'Sleep & Recovery',
    });
  }

  // Morning routine & breakfast: 45 min after wake
  const morningEnd = Math.min(wakeMinutes + 45, sleepMinutes);
  if (morningEnd > wakeMinutes) {
    intervals.push({
      start: wakeMinutes,
      end: morningEnd,
      category: 'meal',
      title: 'Morning routine & Breakfast',
    });
  }

  // Sleep evening block: sleep to 23:59
  if (sleepMinutes < 1440) {
    intervals.push({
      start: sleepMinutes,
      end: 1440,
      category: 'sleep',
      title: 'Sleep & Wind-down',
    });
  }

  // Fixed commitments (college, sports, etc.)
  for (const f of fixedCommitments) {
    const s = parseTimeToMinutes(f.startTime);
    const e = parseTimeToMinutes(f.endTime);
    if (e > s) {
      intervals.push({
        start: s,
        end: e,
        category: 'fixed',
        title: f.title || 'Fixed Commitment',
      });
    }
  }

  // Default meal intervals (if they don't collide with fixed commitments)
  if (includeMeals) {
    const lunchStart = 13 * 60; // 13:00
    const lunchEnd = 13 * 60 + 45; // 13:45
    const dinnerStart = 20 * 60; // 20:00
    const dinnerEnd = 20 * 60 + 45; // 20:45

    const lunchBlocked = fixedCommitments.some((f) => {
      const s = parseTimeToMinutes(f.startTime);
      const e = parseTimeToMinutes(f.endTime);
      return Math.max(s, lunchStart) < Math.min(e, lunchEnd);
    });

    const dinnerBlocked = fixedCommitments.some((f) => {
      const s = parseTimeToMinutes(f.startTime);
      const e = parseTimeToMinutes(f.endTime);
      return Math.max(s, dinnerStart) < Math.min(e, dinnerEnd);
    });

    if (!lunchBlocked && lunchEnd <= sleepMinutes && lunchStart >= morningEnd) {
      intervals.push({
        start: lunchStart,
        end: lunchEnd,
        category: 'meal',
        title: 'Lunch',
      });
    }

    if (!dinnerBlocked && dinnerEnd <= sleepMinutes && dinnerStart >= morningEnd) {
      intervals.push({
        start: dinnerStart,
        end: dinnerEnd,
        category: 'meal',
        title: 'Dinner',
      });
    }
  }

  // Sort chronologically
  intervals.sort((a, b) => a.start - b.start);

  return { intervals };
}

/**
 * Generates an actual, non-overlapping, mathematical schedule timeline for a given day.
 * - Never creates overlapping blocks.
 * - Never schedules work during fixed commitments.
 * - Never schedules work during sleep.
 * - Never silently compresses an impossible schedule; highlights shortage and unscheduled tasks.
 */
export function generateDayTimeline(
  tasks: Task[],
  fixedCommitments: FixedCommitment[],
  wakeTime: string = '07:00',
  sleepTime: string = '23:00',
  nowTime?: string,
  dailyStudyCapHours?: number,
  referenceDate: Date = new Date()
): DayTimelineResult {
  const wakeM = parseTimeToMinutes(wakeTime);
  const sleepM = parseTimeToMinutes(sleepTime);

  // 1. Get all reserved non-work intervals
  const { intervals: reserved } = getNonWorkIntervals(fixedCommitments, wakeM, sleepM);

  // Merge overlapping reserved intervals to guarantee non-overlapping constraints
  const mergedReserved: Array<{ start: number; end: number; category: TimeSlot['category']; title: string }> = [];
  for (const r of reserved) {
    if (mergedReserved.length === 0) {
      mergedReserved.push({ ...r });
    } else {
      const last = mergedReserved[mergedReserved.length - 1];
      if (r.start < last.end) {
        // Overlap: prioritize fixed commitments, then sleep, then meals
        if (r.category === 'fixed' || (last.category !== 'fixed' && r.category === 'sleep')) {
          last.category = r.category;
          last.title = r.title;
        }
        last.end = Math.max(last.end, r.end);
      } else {
        mergedReserved.push({ ...r });
      }
    }
  }

  // 2. Compute free open intervals between reserved blocks
  const freeIntervals: Interval[] = [];
  let cursor = 0;

  for (const r of mergedReserved) {
    if (r.start > cursor) {
      freeIntervals.push({ start: cursor, end: r.start });
    }
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < 1440) {
    freeIntervals.push({ start: cursor, end: 1440 });
  }

  // Filter free intervals strictly to daytime (inside wake and sleep boundaries)
  const availableWorkIntervals: Interval[] = [];
  for (const interval of freeIntervals) {
    const s = Math.max(interval.start, wakeM);
    const e = Math.min(interval.end, sleepM);
    if (e - s >= 20) {
      availableWorkIntervals.push({ start: s, end: e });
    }
  }

  const rawAvailableMinutes = availableWorkIntervals.reduce((sum, int) => sum + (int.end - int.start), 0);
  const availableWorkMinutes = dailyStudyCapHours && dailyStudyCapHours > 0
    ? Math.min(rawAvailableMinutes, Math.round(dailyStudyCapHours * 60))
    : rawAvailableMinutes;

  // 3. Sort pending tasks by dependency-first topological sort and priority
  const orderedPendingTasks = topologicalSortTasks(tasks, referenceDate);

  // 4. Allocate tasks into available work intervals without exceeding capacity
  const slots: TimeSlot[] = [];
  const scheduledTasks: Task[] = [];
  const unscheduledTasks: Task[] = [];

  let allocatedWorkMinutes = 0;
  let taskCursor = 0;

  // Clone work intervals
  for (const interval of availableWorkIntervals) {
    let intCursor = interval.start;

    while (intCursor < interval.end && taskCursor < orderedPendingTasks.length) {
      // Check if daily study cap was reached
      if (dailyStudyCapHours && allocatedWorkMinutes >= availableWorkMinutes) {
        break;
      }

      const task = orderedPendingTasks[taskCursor];
      const taskMinutes = Math.max(20, Math.round((task.estimatedHours || 1) * 60));
      const remainingIntervalGap = interval.end - intCursor;
      const remainingDailyCap = availableWorkMinutes - allocatedWorkMinutes;

      // Maximum duration we can schedule in this current slot
      const feasibleMinutes = Math.min(taskMinutes, remainingIntervalGap, remainingDailyCap);

      if (feasibleMinutes >= 20) {
        slots.push({
          start: minutesToTimeString(intCursor),
          end: minutesToTimeString(intCursor + feasibleMinutes),
          category: 'work',
          title: task.title,
          taskId: task.id,
        });

        intCursor += feasibleMinutes;
        allocatedWorkMinutes += feasibleMinutes;
        scheduledTasks.push(task);
        taskCursor++;

        // Add 10-15 minute transition break if gap remains before next block
        if (intCursor + 15 <= interval.end) {
          slots.push({
            start: minutesToTimeString(intCursor),
            end: minutesToTimeString(intCursor + 15),
            category: 'break',
            title: 'Transition & Reset',
          });
          intCursor += 15;
        }
      } else {
        // Gap in current interval is too small (< 20m)
        if (remainingIntervalGap > 0) {
          slots.push({
            start: minutesToTimeString(intCursor),
            end: minutesToTimeString(interval.end),
            category: 'break',
            title: 'Buffer Window',
          });
        }
        intCursor = interval.end;
      }
    }

    // If interval has remaining space not used by tasks
    if (intCursor < interval.end) {
      slots.push({
        start: minutesToTimeString(intCursor),
        end: minutesToTimeString(interval.end),
        category: 'break',
        title: 'Open Window / Buffer',
      });
    }
  }

  // Any remaining tasks that couldn't fit
  while (taskCursor < orderedPendingTasks.length) {
    unscheduledTasks.push(orderedPendingTasks[taskCursor]);
    taskCursor++;
  }

  // 5. Add all reserved non-work intervals (sleep, meals, fixed commitments)
  for (const r of mergedReserved) {
    slots.push({
      start: minutesToTimeString(r.start),
      end: minutesToTimeString(r.end),
      category: r.category,
      title: r.title,
    });
  }

  // 6. Sort all slots chronologically
  slots.sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));

  // 7. Verify NO overlapping blocks exist (clean boundary clamp)
  for (let i = 0; i < slots.length - 1; i++) {
    const curEnd = parseTimeToMinutes(slots[i].end);
    const nextStart = parseTimeToMinutes(slots[i + 1].start);
    if (curEnd > nextStart) {
      // Resolve boundary clamp
      slots[i].end = minutesToTimeString(nextStart);
    }
  }

  // Filter zero-duration slots if any resulted from clamps
  const cleanSlots = slots.filter(
    (s) => parseTimeToMinutes(s.end) > parseTimeToMinutes(s.start)
  );

  // 8. Mark past slots if nowTime is provided
  if (nowTime) {
    const nowM = parseTimeToMinutes(nowTime);
    for (const slot of cleanSlots) {
      if (parseTimeToMinutes(slot.end) <= nowM) {
        slot.isPassed = true;
      }
    }
  }

  // 9. Calculate total workload and shortage
  const totalPendingWorkMinutes = orderedPendingTasks.reduce(
    (sum, t) => sum + Math.round((t.estimatedHours || 1) * 60),
    0
  );
  const shortageMinutes = Math.max(0, totalPendingWorkMinutes - availableWorkMinutes);
  const shortageHours = Math.round((shortageMinutes / 60) * 10) / 10;
  const isImpossible = availableWorkMinutes === 0 || shortageMinutes > 0;

  return {
    slots: cleanSlots,
    scheduledTasks,
    unscheduledTasks,
    totalWorkMinutes: totalPendingWorkMinutes,
    availableWorkMinutes,
    shortageHours,
    isImpossible,
  };
}

export interface PlanActionContext {
  type:
    | 'complete'
    | 'uncomplete'
    | 'miss'
    | 'duration_change'
    | 'importance_change'
    | 'delete'
    | 'add'
    | 'recalculate';
  taskId?: string;
  taskTitle: string;
  oldHours?: number;
  newHours?: number;
  oldImportance?: Task['importance'];
  newImportance?: Task['importance'];
  reason?: string;
}

/**
 * Re-evaluates plan priorities and schedule tightness dynamically when tasks are edited,
 * completed, deleted, missed, or duration/importance changes.
 * Produces a calm, transparent adaptationNotice explaining the exact change.
 */
export function recalculatePlanOnTaskChange(
  currentPlan: AIPlanResponse,
  dailyAvailableHours: number = 2,
  planningDays: number = 7,
  referenceDate: Date = new Date(),
  actionContext?: PlanActionContext
): AIPlanResponse {
  const tasks = currentPlan.tasks;

  // Recalculate priority order
  const sorted = topologicalSortTasks(tasks, referenceDate);
  const topTask = sorted.find((t) => t.status !== 'completed');

  const doThisFirst = topTask
    ? {
        taskId: topTask.id,
        taskTitle: topTask.title,
        reason: topTask.priorityReason || 'Top priority based on deadline and importance.',
        firstMove: currentPlan.doThisFirst?.firstMove || 'Spend 5 minutes drafting the first step.',
      }
    : {
        taskId: '',
        taskTitle: 'All tasks completed',
        reason: 'You have completed all planned tasks.',
        firstMove: 'Review achievements or plan your next milestone.',
      };

  const scheduleTightness = evaluateScheduleTightness(
    tasks,
    dailyAvailableHours,
    planningDays
  );

  let adaptationNotice: AdaptationNotice | undefined = currentPlan.adaptationNotice;

  if (actionContext) {
    let explanation = '';
    const summaryItems: string[] = [];

    // Find if there is a protected high-priority or upcoming interview/exam deadline
    const highPriorityTarget = tasks.find(
      (t) => t.id !== actionContext.taskId && (t.importance === 'high' || (t.deadline !== null && t.status !== 'completed'))
    );
    const protectedName = highPriorityTarget ? highPriorityTarget.title.toLowerCase() : 'your goal milestones';

    switch (actionContext.type) {
      case 'miss': {
        const titleLower = actionContext.taskTitle.toLowerCase();
        if (titleLower.includes('sql') || titleLower.includes('interview')) {
          explanation = `${actionContext.taskTitle} moved to tomorrow so your interview revision stays protected.`;
        } else if (actionContext.reason) {
          explanation = `${actionContext.taskTitle} rescheduled (${actionContext.reason}) so ${protectedName} stays protected.`;
        } else {
          explanation = `${actionContext.taskTitle} moved to tomorrow so ${protectedName} stays protected.`;
        }
        summaryItems.push(`Rescheduled "${actionContext.taskTitle}" to next open study window`);
        if (topTask && topTask.id !== actionContext.taskId) {
          summaryItems.push(`Protected priority: "${topTask.title}" scheduled first`);
        }
        break;
      }

      case 'duration_change': {
        const oldH = actionContext.oldHours ?? 1;
        const newH = actionContext.newHours ?? 1;
        if (newH < oldH) {
          const saved = Math.round((oldH - newH) * 10) / 10;
          explanation = `${actionContext.taskTitle} reduced from ${oldH}h to ${newH}h, freeing up ${saved}h of buffer today.`;
          summaryItems.push(`Reduced duration of "${actionContext.taskTitle}" by ${saved} hours`);
        } else {
          const added = Math.round((newH - oldH) * 10) / 10;
          explanation = `${actionContext.taskTitle} increased to ${newH}h; remaining schedule shifted to protect your sleep.`;
          summaryItems.push(`Increased duration of "${actionContext.taskTitle}" by ${added} hours`);
        }
        break;
      }

      case 'complete': {
        explanation = topTask
          ? `${actionContext.taskTitle} completed. "${topTask.title}" is now your active priority.`
          : `${actionContext.taskTitle} completed. All planned milestones are finished!`;
        summaryItems.push(`Marked "${actionContext.taskTitle}" as completed`);
        if (topTask) {
          summaryItems.push(`Shifted next focus to "${topTask.title}"`);
        }
        break;
      }

      case 'uncomplete': {
        explanation = `${actionContext.taskTitle} returned to active tasks and re-integrated into today's timeline.`;
        summaryItems.push(`Reopened "${actionContext.taskTitle}"`);
        break;
      }

      case 'importance_change': {
        explanation = `${actionContext.taskTitle} importance changed to ${actionContext.newImportance}; priority sequence updated.`;
        summaryItems.push(`Priority changed for "${actionContext.taskTitle}" to ${actionContext.newImportance}`);
        break;
      }

      case 'delete': {
        explanation = `${actionContext.taskTitle} removed, freeing up scheduled time in your day.`;
        summaryItems.push(`Removed "${actionContext.taskTitle}" from plan`);
        break;
      }

      case 'add': {
        explanation = `${actionContext.taskTitle} added and scheduled into available time without displacing fixed commitments.`;
        summaryItems.push(`Added "${actionContext.taskTitle}" to plan`);
        break;
      }

      case 'recalculate': {
        explanation = `Schedule recalculated based on your actual pace and remaining commitments.`;
        summaryItems.push(`Re-sequenced remaining ${tasks.filter((t) => t.status !== 'completed').length} tasks`);
        break;
      }
    }

    adaptationNotice = {
      headline: 'Your plan changed.',
      explanation,
      actionSummary: summaryItems,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    ...currentPlan,
    tasks,
    doThisFirst,
    scheduleTightness,
    adaptationNotice,
  };
}

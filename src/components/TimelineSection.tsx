import React, { useMemo, useState } from 'react';
import {
  DayTimelineResult,
  generateDayTimeline,
  minutesToTimeString,
  parseTimeToMinutes,
  recalculatePlanOnTaskChange,
  TimeSlot,
} from '../services/scheduler';
import { storage } from '../services/storage';
import { AIPlanResponse, FixedCommitment, Task } from '../types';

interface TimelineSectionProps {
  plan: AIPlanResponse;
  onUpdatePlan: (updatedPlan: AIPlanResponse) => void;
  onOpenFocus: (task: Task) => void;
  onAdaptPlan: (missedTaskTitle: string, reason?: string) => void;
  isAdapting: boolean;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({
  plan,
  onUpdatePlan,
  onOpenFocus,
  onAdaptPlan,
  isAdapting,
}) => {
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [adaptationReason, setAdaptationReason] = useState<string>('');
  const [showAdaptModal, setShowAdaptModal] = useState<boolean>(false);
  const [targetMissedTask, setTargetMissedTask] = useState<Task | null>(null);

  // Extract fixed commitments from plan constraints
  const fixedCommitments = useMemo<FixedCommitment[]>(() => {
    const list: FixedCommitment[] = [];
    for (const c of plan.constraints) {
      // Check for times like 9 to 4 or 09:00-16:00
      const match24 = c.match(/(\d{1,2}:\d{2})\s*[-–to]\s*(\d{1,2}:\d{2})/i);
      const match12 = c.match(/(\d{1,2})\s*(?:am|pm)?\s*to\s*(\d{1,2})\s*(?:am|pm)?/i);

      if (match24) {
        list.push({
          id: `fixed-${list.length}`,
          title: c,
          startTime: match24[1],
          endTime: match24[2],
        });
      } else if (match12) {
        let s = parseInt(match12[1], 10);
        let e = parseInt(match12[2], 10);
        if (s < 7) s += 12; // e.g. 9 to 4 means 09:00 to 16:00
        if (e < 12 && e <= s) e += 12;
        list.push({
          id: `fixed-${list.length}`,
          title: c,
          startTime: `${s.toString().padStart(2, '0')}:00`,
          endTime: `${e.toString().padStart(2, '0')}:00`,
        });
      }
    }
    return list;
  }, [plan.constraints]);

  // Current local time
  const now = new Date();
  const currentNowTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const currentNowMinutes = parseTimeToMinutes(currentNowTime);

  // Generate schedule timeline
  const timelineResult = useMemo<DayTimelineResult>(() => {
    return generateDayTimeline(
      plan.tasks,
      fixedCommitments,
      '07:00',
      '23:00',
      currentNowTime
    );
  }, [plan.tasks, fixedCommitments, currentNowTime]);

  const timelineSlots = timelineResult.slots;

  // Handle task status toggle
  const handleToggleTask = (taskId: string) => {
    const task = plan.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const willBeCompleted = task.status !== 'completed';
    const nextStatus = willBeCompleted ? 'completed' : 'pending';
    const updatedTasks = plan.tasks.map((t) =>
      t.id === taskId ? { ...t, status: nextStatus as Task['status'] } : t
    );

    storage.recordAction({
      type: willBeCompleted ? 'task_completed' : 'task_uncompleted',
      taskId,
      taskTitle: task.title,
    });

    const recalculated = recalculatePlanOnTaskChange(
      { ...plan, tasks: updatedTasks },
      2,
      7,
      new Date(),
      {
        type: willBeCompleted ? 'complete' : 'uncomplete',
        taskId,
        taskTitle: task.title,
      }
    );
    onUpdatePlan(recalculated);
  };

  const handlePromptMissed = (task: Task) => {
    setTargetMissedTask(task);
    setShowAdaptModal(true);
  };

  const confirmAdaptation = () => {
    if (!targetMissedTask) return;

    const updatedTasks = plan.tasks.map((t) =>
      t.id === targetMissedTask.id ? { ...t, status: 'missed' as Task['status'] } : t
    );

    storage.recordAction({
      type: 'task_missed',
      taskId: targetMissedTask.id,
      taskTitle: targetMissedTask.title,
      details: adaptationReason || 'Fell behind schedule',
    });

    const recalculated = recalculatePlanOnTaskChange(
      { ...plan, tasks: updatedTasks },
      2,
      7,
      new Date(),
      {
        type: 'miss',
        taskId: targetMissedTask.id,
        taskTitle: targetMissedTask.title,
        reason: adaptationReason || 'Fell behind schedule',
      }
    );
    onUpdatePlan(recalculated);

    // Also trigger server-side adaptation if available
    onAdaptPlan(targetMissedTask.title, adaptationReason || 'Fell behind schedule');
    setShowAdaptModal(false);
    setTargetMissedTask(null);
    setAdaptationReason('');
  };

  return (
    <section className="py-12 border-t border-[#16150F]/10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between pb-8 border-b border-[#16150F]/10 gap-2">
          <div>
            <span className="text-xs font-mono-data uppercase tracking-wider text-[#5E5A50]">
              Calculated Schedule
            </span>
            <h2 className="font-editorial text-3xl font-normal text-[#16150F] mt-1">
              Today’s Timeline
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono-data text-[#5E5A50]">
            <span>Current local time: {currentNowTime}</span>
          </div>
        </div>

        {/* Reality Check Shortage Warning if Impossible */}
        {timelineResult.shortageHours > 0 && (
          <div className="my-6 p-5 bg-[#EAE5DA] border border-[#16150F]/20 space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-editorial text-lg text-[#16150F]">
                Reality Check: Schedule Shortage
              </h3>
              <span className="text-xs font-mono-data text-[#D93A17] font-medium">
                Short by {timelineResult.shortageHours} hours today
              </span>
            </div>
            <p className="text-xs text-[#5E5A50] leading-relaxed">
              Your remaining work requires {Math.round((timelineResult.totalWorkMinutes / 60) * 10) / 10} hours, but today only has {Math.round((timelineResult.availableWorkMinutes / 60) * 10) / 10} hours of open time outside fixed commitments and sleep.
            </p>
            {timelineResult.unscheduledTasks.length > 0 && (
              <div className="pt-1">
                <span className="text-xs font-medium text-[#16150F]">
                  Cannot fit into today’s schedule without displacing sleep:
                </span>
                <ul className="text-xs text-[#5E5A50] mt-1 space-y-1 list-disc list-inside">
                  {timelineResult.unscheduledTasks.map((t) => (
                    <li key={t.id}>
                      <span className="font-medium text-[#16150F]">{t.title}</span> ({t.estimatedHours}h, {t.importance} priority)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="py-4 flex flex-wrap items-center gap-6 text-xs text-[#5E5A50] border-b border-[#16150F]/10">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#16150F]" />
            <span>Work (Ink)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 border border-[#16150F]" />
            <span>Break</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#EAE5DA] border border-[#16150F]/20" />
            <span>Fixed commitment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 border border-dashed border-[#16150F]" />
            <span>Meal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#0E0E0C]" />
            <span>Sleep</span>
          </div>
        </div>

        {/* Vertical Timeline */}
        <div className="mt-8 relative pl-16 sm:pl-20 space-y-3">
          {/* Vertical axis line */}
          <div className="absolute top-0 bottom-0 left-12 sm:left-16 w-[1px] bg-[#16150F]/15" />

          {/* "NOW" Indicator line */}
          {currentNowMinutes >= parseTimeToMinutes('07:00') &&
            currentNowMinutes <= parseTimeToMinutes('23:00') && (
              <div
                className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                style={{
                  top: `${((currentNowMinutes - 420) / (1380 - 420)) * 100}%`,
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#D93A17] -ml-1.5" />
                <div className="h-[1.5px] flex-1 bg-[#D93A17]" />
                <span className="text-[10px] font-mono-data bg-[#D93A17] text-[#F3EFE7] px-1 py-0.2 tracking-wider ml-2">
                  NOW
                </span>
              </div>
            )}

          {timelineSlots.map((slot, idx) => {
            const isWork = slot.category === 'work';
            const isBreak = slot.category === 'break';
            const isFixed = slot.category === 'fixed';
            const isMeal = slot.category === 'meal';
            const isSleep = slot.category === 'sleep';

            const relatedTask = slot.taskId
              ? plan.tasks.find((t) => t.id === slot.taskId)
              : null;
            const isCompleted = relatedTask?.status === 'completed';

            return (
              <div
                key={`${slot.start}-${slot.end}-${idx}`}
                className="relative group transition-all"
              >
                {/* Time label on the left */}
                <span className="absolute -left-16 sm:-left-20 top-3 text-xs font-mono-data text-[#5E5A50] w-12 text-right">
                  {slot.start}
                </span>

                {/* Timeline block styling based on exact design system */}
                <div
                  className={`p-4 transition-all relative ${
                    isWork
                      ? 'bg-[#16150F] text-[#F3EFE7]'
                      : isBreak
                      ? 'bg-transparent border border-[#16150F]/30 text-[#16150F]'
                      : isFixed
                      ? 'bg-[#EAE5DA] border border-[#16150F]/10 text-[#16150F]'
                      : isMeal
                      ? 'bg-transparent border border-dashed border-[#16150F]/40 text-[#16150F]'
                      : 'bg-[#0E0E0C] text-[#A9A599]'
                  } ${isCompleted ? 'opacity-40' : ''}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {isWork && relatedTask && (
                        <button
                          type="button"
                          onClick={() => handleToggleTask(relatedTask.id)}
                          className={`w-4 h-4 rounded-none border border-[#F3EFE7] flex items-center justify-center cursor-pointer transition-colors ${
                            isCompleted ? 'bg-[#F3EFE7]' : 'bg-transparent'
                          }`}
                          aria-label={
                            isCompleted ? 'Mark as incomplete' : 'Mark as complete'
                          }
                        >
                          {isCompleted && (
                            <span className="block w-2 h-2 bg-[#16150F]" />
                          )}
                        </button>
                      )}

                      <div>
                        <h4
                          className={`text-sm sm:text-base font-normal ${
                            isCompleted ? 'line-through' : ''
                          }`}
                        >
                          {slot.title}
                        </h4>
                        <div
                          className={`text-xs mt-0.5 font-mono-data ${
                            isWork
                              ? 'text-[#A9A599]'
                              : isSleep
                              ? 'text-[#5E5A50]'
                              : 'text-[#5E5A50]'
                          }`}
                        >
                          {slot.start} – {slot.end}
                          {relatedTask?.importance && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span className="capitalize">{relatedTask.importance} importance</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons for work blocks */}
                    {isWork && relatedTask && (
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => onOpenFocus(relatedTask)}
                          className="text-xs text-[#F3EFE7] hover:text-[#FF6A45] transition-colors py-1 px-1 cursor-pointer underline underline-offset-2"
                        >
                          Focus
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromptMissed(relatedTask)}
                          className="text-xs text-[#A9A599] hover:text-[#FF6A45] transition-colors py-1 px-1 cursor-pointer"
                        >
                          Missed / Adapt
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Adapt Plan Modal / Confirmation */}
        {showAdaptModal && targetMissedTask && (
          <div
            className="fixed inset-0 z-50 bg-[#16150F]/60 flex items-center justify-center p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adapt-title"
          >
            <div className="bg-[#F3EFE7] max-w-md w-full p-6 border border-[#16150F]/20 space-y-4">
              <span className="text-xs font-mono-data uppercase tracking-wider text-[#D93A17]">
                Adaptive Planning
              </span>
              <h3 id="adapt-title" className="font-editorial text-2xl text-[#16150F]">
                Fell behind on “{targetMissedTask.title}”?
              </h3>
              <p className="text-xs text-[#5E5A50] leading-relaxed">
                LifeOS will recalculate the remaining schedule, shift tasks to realistic open slots, and protect your critical deadlines.
              </p>
              <div>
                <label className="block text-xs font-mono-data text-[#5E5A50] mb-1">
                  Optional reason or note
                </label>
                <input
                  type="text"
                  value={adaptationReason}
                  onChange={(e) => setAdaptationReason(e.target.value)}
                  placeholder="e.g. Stuck on bug, college ran late, need break"
                  className="w-full text-xs bg-[#EAE5DA] p-2 border border-[#16150F]/15 focus:outline-none focus:border-[#16150F]"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAdaptModal(false)}
                  disabled={isAdapting}
                  className="px-4 py-2 text-[#5E5A50] hover:text-[#16150F] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmAdaptation}
                  disabled={isAdapting}
                  className="px-4 py-2 bg-[#16150F] text-[#F3EFE7] hover:bg-[#2A2821] disabled:opacity-50 transition-colors"
                >
                  {isAdapting ? 'Recalculating...' : 'Adapt remaining schedule'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

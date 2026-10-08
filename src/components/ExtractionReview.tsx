import React, { useState } from 'react';
import { recalculatePlanOnTaskChange } from '../services/scheduler';
import { storage } from '../services/storage';
import { AIPlanResponse, Task } from '../types';

interface ExtractionReviewProps {
  plan: AIPlanResponse;
  onUpdatePlan: (updatedPlan: AIPlanResponse) => void;
  onConfirmPlan: () => void;
  onOpenFocus: (task: Task) => void;
}

export const ExtractionReview: React.FC<ExtractionReviewProps> = ({
  plan,
  onUpdatePlan,
  onConfirmPlan,
  onOpenFocus,
}) => {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editHours, setEditHours] = useState<number>(1);
  const [editImportance, setEditImportance] = useState<'low' | 'medium' | 'high'>('medium');

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditHours(task.estimatedHours);
    setEditImportance(task.importance);
  };

  const saveEdit = (task: Task) => {
    const oldHours = task.estimatedHours;
    const oldImportance = task.importance;
    const newHours = editHours > 0 ? editHours : 1;
    const newImportance = editImportance;

    const updatedTasks = plan.tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            title: editTitle.trim() || t.title,
            estimatedHours: newHours,
            importance: newImportance,
          }
        : t
    );

    const title = editTitle.trim() || task.title;

    if (newHours !== oldHours) {
      storage.recordAction({
        type: 'task_duration_changed',
        taskId: task.id,
        taskTitle: title,
        details: `Duration changed from ${oldHours}h to ${newHours}h`,
      });
      const recalculated = recalculatePlanOnTaskChange(
        { ...plan, tasks: updatedTasks },
        2,
        7,
        new Date(),
        {
          type: 'duration_change',
          taskId: task.id,
          taskTitle: title,
          oldHours,
          newHours,
        }
      );
      onUpdatePlan(recalculated);
    } else if (newImportance !== oldImportance) {
      storage.recordAction({
        type: 'task_importance_changed',
        taskId: task.id,
        taskTitle: title,
        details: `Importance changed to ${newImportance}`,
      });
      const recalculated = recalculatePlanOnTaskChange(
        { ...plan, tasks: updatedTasks },
        2,
        7,
        new Date(),
        {
          type: 'importance_change',
          taskId: task.id,
          taskTitle: title,
          oldImportance,
          newImportance,
        }
      );
      onUpdatePlan(recalculated);
    } else {
      const recalculated = recalculatePlanOnTaskChange({ ...plan, tasks: updatedTasks });
      onUpdatePlan(recalculated);
    }

    setEditingTaskId(null);
  };

  const removeTask = (taskId: string) => {
    const target = plan.tasks.find((t) => t.id === taskId);
    const updatedTasks = plan.tasks.filter((t) => t.id !== taskId);
    if (target) {
      storage.recordAction({
        type: 'task_deleted',
        taskId,
        taskTitle: target.title,
      });
    }
    const recalculated = recalculatePlanOnTaskChange(
      { ...plan, tasks: updatedTasks },
      2,
      7,
      new Date(),
      target ? { type: 'delete', taskId, taskTitle: target.title } : undefined
    );
    onUpdatePlan(recalculated);
  };

  const handleToggleTaskStatus = (taskId: string) => {
    const target = plan.tasks.find((t) => t.id === taskId);
    if (!target) return;

    const willBeCompleted = target.status !== 'completed';
    const nextStatus: Task['status'] = willBeCompleted ? 'completed' : 'pending';

    const updatedTasks = plan.tasks.map((t) =>
      t.id === taskId ? { ...t, status: nextStatus } : t
    );

    storage.recordAction({
      type: willBeCompleted ? 'task_completed' : 'task_uncompleted',
      taskId,
      taskTitle: target.title,
    });

    const recalculated = recalculatePlanOnTaskChange(
      { ...plan, tasks: updatedTasks },
      2,
      7,
      new Date(),
      {
        type: willBeCompleted ? 'complete' : 'uncomplete',
        taskId,
        taskTitle: target.title,
      }
    );
    onUpdatePlan(recalculated);
  };

  const handleMarkMissed = (taskId: string) => {
    const target = plan.tasks.find((t) => t.id === taskId);
    if (!target) return;

    const isAlreadyMissed = target.status === 'missed';
    const nextStatus: Task['status'] = isAlreadyMissed ? 'pending' : 'missed';

    const updatedTasks = plan.tasks.map((t) =>
      t.id === taskId ? { ...t, status: nextStatus } : t
    );

    storage.recordAction({
      type: isAlreadyMissed ? 'task_uncompleted' : 'task_missed',
      taskId,
      taskTitle: target.title,
      details: isAlreadyMissed ? 'Re-opened' : 'Fell behind schedule',
    });

    const recalculated = recalculatePlanOnTaskChange(
      { ...plan, tasks: updatedTasks },
      2,
      7,
      new Date(),
      {
        type: isAlreadyMissed ? 'uncomplete' : 'miss',
        taskId,
        taskTitle: target.title,
        reason: 'Fell behind schedule',
      }
    );
    onUpdatePlan(recalculated);
  };

  const handleManualRegenerate = () => {
    const recalculated = recalculatePlanOnTaskChange(
      plan,
      2,
      7,
      new Date(),
      { type: 'recalculate', taskTitle: 'Schedule' }
    );
    onUpdatePlan(recalculated);
  };

  const { scheduleTightness, doThisFirst } = plan;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-12">
      {/* Editorial Header */}
      <div className="border-b border-[#16150F]/10 pb-6">
        <span className="text-xs font-mono-data uppercase tracking-wider text-[#5E5A50]">
          Extracted Plan
        </span>
        <h2 className="font-editorial text-2xl sm:text-3xl font-normal text-[#16150F] mt-1">
          Here’s what I understood
        </h2>
        {plan.goal && (
          <p className="text-sm text-[#5E5A50] mt-2 font-normal">
            Primary focus: <span className="text-[#16150F] font-medium">{plan.goal}</span>
          </p>
        )}
      </div>

      {/* Constraints & Assumptions (Editorial notes) */}
      {(plan.constraints.length > 0 || plan.assumptions.length > 0) && (
        <div className="space-y-4 text-xs text-[#5E5A50] bg-[#EAE5DA] p-4 rounded-xs border-l-2 border-[#16150F]/20">
          {plan.constraints.length > 0 && (
            <div>
              <span className="font-medium text-[#16150F]">Fixed commitments: </span>
              {plan.constraints.join(' · ')}
            </div>
          )}
          {plan.assumptions.length > 0 && (
            <div>
              <span className="font-medium text-[#16150F]">Assumptions: </span>
              {plan.assumptions.join(' · ')}
            </div>
          )}
          {plan.clarifyingQuestions.length > 0 && (
            <div className="text-[#16150F] pt-1">
              <span className="font-medium">Question to consider: </span>
              {plan.clarifyingQuestions.join(' ')}
            </div>
          )}
        </div>
      )}

      {/* Reality Check if Tight */}
      {scheduleTightness && scheduleTightness.isTight && (
        <div className="p-5 bg-[#EAE5DA] border border-[#16150F]/15 space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-editorial text-lg font-medium text-[#16150F]">
              This is tight.
            </h3>
            <span className="text-xs font-mono-data text-[#5E5A50]">
              {scheduleTightness.requiredHours}h needed vs {scheduleTightness.availableHours}h available
            </span>
          </div>
          <p className="text-xs text-[#5E5A50] leading-relaxed">
            {scheduleTightness.message ||
              `You have approximately ${scheduleTightness.requiredHours} hours of tasks to fit into ${scheduleTightness.availableHours} available hours.`}
          </p>
          {scheduleTightness.suggestions && scheduleTightness.suggestions.length > 0 && (
            <ul className="text-xs text-[#16150F] space-y-1 pt-1 list-disc list-inside">
              {scheduleTightness.suggestions.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Priority Engine: DO THIS FIRST */}
      {doThisFirst && (
        <div className="p-6 bg-[#16150F] text-[#F3EFE7] space-y-4">
          <div className="flex items-center justify-between text-xs font-mono-data tracking-wider text-[#A9A599] uppercase">
            <span>Priority Engine</span>
            <span>01 / Do this first</span>
          </div>
          <div>
            <h3 className="font-editorial text-2xl font-normal text-[#F3EFE7]">
              {doThisFirst.taskTitle}
            </h3>
            <p className="text-xs text-[#A9A599] mt-2 leading-relaxed">
              <span className="font-medium text-[#F3EFE7]">Why: </span>
              {doThisFirst.reason}
            </p>
          </div>
          {doThisFirst.firstMove && (
            <div className="pt-3 border-t border-[#F3EFE7]/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono-data uppercase text-[#FF6A45] block">
                  Your first move (10 min)
                </span>
                <p className="text-xs text-[#F3EFE7] mt-0.5">{doThisFirst.firstMove}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const target = plan.tasks.find(
                    (t) => t.id === doThisFirst.taskId || t.title === doThisFirst.taskTitle
                  );
                  if (target) onOpenFocus(target);
                }}
                className="self-start sm:self-auto px-4 py-2 text-xs font-medium bg-[#F3EFE7] text-[#16150F] hover:bg-[#FAF7F2] transition-colors whitespace-nowrap cursor-pointer"
              >
                Start now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Extracted Tasks: Editorial Rows */}
      <div className="space-y-1">
        <div className="flex items-center justify-between pb-3 border-b border-[#16150F]/10 text-xs font-mono-data text-[#5E5A50] uppercase">
          <span>Identified Actions ({plan.tasks.length})</span>
          <span>Duration · Importance</span>
        </div>

        {plan.tasks.map((task, index) => {
          const isEditing = editingTaskId === task.id;

          if (isEditing) {
            return (
              <div
                key={task.id}
                className="py-4 px-3 bg-[#EAE5DA] border-b border-[#16150F]/10 space-y-3"
              >
                <div className="space-y-1">
                  <label className="text-[11px] font-mono-data text-[#5E5A50]">Task Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-sm bg-[#F3EFE7] px-3 py-1.5 border border-[#16150F]/20 focus:outline-none focus:border-[#16150F]"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono-data text-[#5E5A50]">Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="40"
                      value={editHours}
                      onChange={(e) => setEditHours(parseFloat(e.target.value) || 1)}
                      className="w-20 text-sm bg-[#F3EFE7] px-2 py-1.5 border border-[#16150F]/20 focus:outline-none focus:border-[#16150F]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono-data text-[#5E5A50]">Importance</label>
                    <select
                      value={editImportance}
                      onChange={(e) => setEditImportance(e.target.value as 'low' | 'medium' | 'high')}
                      className="text-sm bg-[#F3EFE7] px-2 py-1.5 border border-[#16150F]/20 focus:outline-none focus:border-[#16150F]"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2 pt-5">
                    <button
                      type="button"
                      onClick={() => saveEdit(task)}
                      className="px-3 py-1.5 text-xs bg-[#16150F] text-[#F3EFE7] hover:bg-[#2A2821] transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTaskId(null)}
                      className="px-3 py-1.5 text-xs text-[#5E5A50] hover:text-[#16150F] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          const isCompleted = task.status === 'completed';

          return (
            <div
              key={task.id}
              className={`group py-4 border-b border-[#16150F]/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors hover:bg-[#EAE5DA]/40 px-2 -mx-2 ${
                isCompleted ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Minimal checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggleTaskStatus(task.id)}
                  className={`mt-1 w-4 h-4 rounded-none border border-[#16150F] flex items-center justify-center transition-colors cursor-pointer ${
                    isCompleted ? 'bg-[#16150F]' : 'bg-transparent'
                  }`}
                  aria-label={isCompleted ? `Mark ${task.title} as incomplete` : `Mark ${task.title} as complete`}
                >
                  {isCompleted && (
                    <span className="block w-2 h-2 bg-[#F3EFE7]" />
                  )}
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono-data text-[#5E5A50]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h4
                      className={`text-sm md:text-base font-normal text-[#16150F] ${
                        isCompleted ? 'line-through text-[#5E5A50]' : ''
                      }`}
                    >
                      {task.title}
                    </h4>
                    {task.status === 'missed' && (
                      <span className="text-[10px] font-mono-data text-[#D93A17] uppercase tracking-wider bg-[#D93A17]/10 px-1.5 py-0.5 ml-1">
                        Missed · Rescheduled
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-[#5E5A50] mt-1 pl-6 leading-relaxed max-w-xl">
                      {task.description}
                    </p>
                  )}
                  {/* Clean unboxed metadata */}
                  <div className="flex items-center gap-2 text-xs text-[#5E5A50] mt-1.5 pl-6">
                    {task.deadline && (
                      <>
                        <span>Due {task.deadline}</span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span>{task.estimatedHours}h</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{task.importance} importance</span>
                  </div>
                </div>
              </div>

              {/* Row actions */}
              <div className="flex items-center gap-3 pl-6 sm:pl-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => onOpenFocus(task)}
                  className="text-xs text-[#16150F] hover:underline underline-offset-2 transition-colors py-1 px-1 cursor-pointer"
                >
                  Focus
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkMissed(task.id)}
                  className={`text-xs transition-colors py-1 px-1 cursor-pointer ${
                    task.status === 'missed'
                      ? 'text-[#D93A17] hover:underline font-medium'
                      : 'text-[#5E5A50] hover:text-[#D93A17]'
                  }`}
                  title={task.status === 'missed' ? 'Undo missed' : 'Mark task as missed and adapt plan'}
                >
                  {task.status === 'missed' ? 'Rescheduled' : 'Mark missed'}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(task)}
                  className="text-xs text-[#5E5A50] hover:text-[#16150F] transition-colors py-1 px-1 cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeTask(task.id)}
                  className="text-xs text-[#5E5A50] hover:text-[#D93A17] transition-colors py-1 px-1 cursor-pointer"
                  title="Remove task"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Make my plan and Regenerate actions */}
      <div className="pt-6 border-t border-[#16150F]/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-xs text-[#5E5A50]">
          Schedule protects your fixed commitments, study blocks, and sleep.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualRegenerate}
            className="px-4 py-2.5 text-xs text-[#16150F] hover:bg-[#EAE5DA] border border-[#16150F]/20 transition-colors whitespace-nowrap cursor-pointer rounded-xs"
          >
            Regenerate schedule
          </button>
          <button
            type="button"
            onClick={onConfirmPlan}
            className="px-6 py-2.5 text-sm font-medium bg-[#16150F] text-[#F3EFE7] hover:bg-[#2A2821] active:bg-[#000000] transition-colors whitespace-nowrap cursor-pointer rounded-xs"
          >
            Make my plan
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { AdaptationNoticeBanner } from './components/AdaptationNoticeBanner';
import { BigTaskSection } from './components/BigTaskSection';
import { ChaosToOrderCanvas } from './components/ChaosToOrderCanvas';
import { ExtractionReview } from './components/ExtractionReview';
import { FocusModal } from './components/FocusModal';
import { Navigation } from './components/Navigation';
import { PlanInputSection } from './components/PlanInputSection';
import { ProductStorySection } from './components/ProductStorySection';
import { QuizModal } from './components/QuizModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { TimelineSection } from './components/TimelineSection';
import { apiClient } from './services/apiClient';
import { recalculatePlanOnTaskChange } from './services/scheduler';
import { storage } from './services/storage';
import { AIPlanResponse, Task } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'plan' | 'focus' | 'big-task'>('plan');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Reading what you wrote.');
  const [error, setError] = useState<string | null>(null);

  // Real plan loaded from storage (or null on pristine first launch)
  const [plan, setPlan] = useState<AIPlanResponse | null>(() => {
    return storage.loadPlan();
  });

  // Focus modal state
  const [focusTask, setFocusTask] = useState<Task | null>(null);

  // Quiz modal state
  const [quizState, setQuizState] = useState<{ topic: string; taskTitle: string } | null>(null);

  // Reset modal state
  const [showResetModal, setShowResetModal] = useState(false);

  // Adaptive planning loader
  const [isAdapting, setIsAdapting] = useState(false);

  // 3D Visual Order toggle
  const [canvasOrdered, setCanvasOrdered] = useState<boolean>(() => {
    return !!plan;
  });

  useEffect(() => {
    if (plan) {
      setCanvasOrdered(true);
    }
  }, [plan]);

  const handlePlanSubmit = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);
    setLoadingStep('Reading what you wrote.');

    // Step messages during realistic planning
    const stepTimer1 = setTimeout(() => {
      setLoadingStep('Working out what matters.');
    }, 1800);

    const stepTimer2 = setTimeout(() => {
      setLoadingStep('Finding your first move.');
    }, 3800);

    try {
      const generatedPlan = await apiClient.extractAndPlan(input.trim());
      setPlan(generatedPlan);
      storage.savePlan(generatedPlan);
      setCanvasOrdered(true);
      setActiveTab('plan');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'LifeOS couldn’t create your plan right now. The AI services are temporarily unavailable.'
      );
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsLoading(false);
    }
  };

  const handleUpdatePlan = (updatedPlan: AIPlanResponse) => {
    setPlan(updatedPlan);
    storage.savePlan(updatedPlan);
  };

  const handleConfirmPlan = () => {
    // Scroll smoothly to timeline
    const timelineEl = document.getElementById('timeline-view');
    if (timelineEl) {
      timelineEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleToggleTaskCompletion = (taskId: string) => {
    if (!plan) return;
    const target = plan.tasks.find((t) => t.id === taskId);
    if (!target) return;

    const willBeCompleted = target.status !== 'completed';
    const nextStatus = willBeCompleted ? 'completed' : 'pending';
    const updatedTasks = plan.tasks.map((t) =>
      t.id === taskId ? { ...t, status: nextStatus as Task['status'] } : t
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
    handleUpdatePlan(recalculated);
  };

  const handleDismissNotice = () => {
    if (!plan) return;
    const updated = { ...plan, adaptationNotice: undefined };
    handleUpdatePlan(updated);
  };

  const handleAdaptPlan = async (missedTaskTitle: string, reason?: string) => {
    if (!plan) return;
    setIsAdapting(true);
    try {
      const recentActions = storage.loadActions();
      const actionsLog = recentActions
        .slice(0, 8)
        .map(
          (a) =>
            `${a.type.replace('_', ' ')}: "${a.taskTitle}"${a.details ? ` (${a.details})` : ''}`
        )
        .join('\n');
      const adapted = await apiClient.adaptPlan(plan, missedTaskTitle, actionsLog);
      handleUpdatePlan(adapted);
    } catch (err: unknown) {
      console.warn('AI adaptation fallback to deterministic scheduler:', err);
    } finally {
      setIsAdapting(false);
    }
  };

  const handleResetWorkspace = () => {
    storage.reset();
    setPlan(null);
    setInput('');
    setCanvasOrdered(false);
    setActiveTab('plan');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F3EFE7] text-[#16150F]">
      {/* Minimal Top Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenReset={() => setShowResetModal(true)}
        hasActivePlan={!!plan}
      />

      <main className="flex-1">
        {activeTab === 'plan' && (
          <>
            {/* Main Input Hero */}
            <PlanInputSection
              input={input}
              setInput={setInput}
              onSubmit={handlePlanSubmit}
              isLoading={isLoading}
              loadingStep={loadingStep}
              error={error}
              onClearError={() => setError(null)}
            />

            {/* Meaningful 3D Procedural Visual: Chaos -> Order */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 my-4">
              <div className="border border-[#16150F]/10 bg-[#EAE5DA]/50 p-2 relative">
                <ChaosToOrderCanvas
                  isOrdered={canvasOrdered}
                  onToggleState={() => setCanvasOrdered(!canvasOrdered)}
                />
              </div>
            </div>

            {/* Extracted Plan Review (Shown when user has a plan) */}
            {plan ? (
              <>
                {/* Calm Adaptation Notice (Shown when user actions adapted the plan) */}
                {plan.adaptationNotice && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
                    <AdaptationNoticeBanner
                      notice={plan.adaptationNotice}
                      onDismiss={handleDismissNotice}
                      onTriggerDeepAdapt={() => handleAdaptPlan('Schedule rebalance')}
                      isDeepAdapting={isAdapting}
                    />
                  </div>
                )}

                <ExtractionReview
                  plan={plan}
                  onUpdatePlan={handleUpdatePlan}
                  onConfirmPlan={handleConfirmPlan}
                  onOpenFocus={(t) => setFocusTask(t)}
                />

                <div id="timeline-view">
                  <TimelineSection
                    plan={plan}
                    onUpdatePlan={handleUpdatePlan}
                    onOpenFocus={(t) => setFocusTask(t)}
                    onAdaptPlan={handleAdaptPlan}
                    isAdapting={isAdapting}
                  />
                </div>
              </>
            ) : (
              /* Polished Empty State for First Launch */
              <div className="max-w-md mx-auto text-center py-16 px-4 space-y-3">
                <div className="w-8 h-[1px] bg-[#16150F]/20 mx-auto mb-4" />
                <h3 className="font-editorial text-xl font-normal text-[#16150F]">
                  Nothing planned yet.
                </h3>
                <p className="text-xs text-[#5E5A50] leading-relaxed">
                  Tell us what’s on your mind in the box above. We will pull out the goals, tasks, constraints, and calculate an authentic schedule.
                </p>
              </div>
            )}

            {/* Editorial "How it works" story section */}
            <ProductStorySection />
          </>
        )}

        {activeTab === 'focus' && (
          <div className="py-12 max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="border-b border-[#16150F]/10 pb-6">
              <span className="text-xs font-mono-data uppercase tracking-wider text-[#D93A17]">
                Deep Work Chamber
              </span>
              <h2 className="font-editorial text-3xl font-normal text-[#16150F] mt-1">
                Active Task Focus
              </h2>
              <p className="text-xs text-[#5E5A50] mt-1">
                Zero-distraction view for your current single priority.
              </p>
            </div>

            {plan && plan.tasks.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono-data text-[#5E5A50]">
                  <span>Select a task to enter focus mode</span>
                </div>
                <div className="space-y-2">
                  {plan.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 bg-[#EAE5DA] border border-[#16150F]/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-[#16150F]/40 transition-colors"
                    >
                      <div>
                        <h4 className="text-sm font-medium text-[#16150F]">
                          {task.title}
                        </h4>
                        <div className="text-xs text-[#5E5A50] font-mono-data mt-0.5">
                          {task.estimatedHours}h · {task.importance} importance
                          {task.status === 'completed' && ' · Completed'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setFocusTask(task)}
                          className="px-4 py-2 text-xs font-medium bg-[#16150F] text-[#F3EFE7] hover:bg-[#2A2821] transition-colors cursor-pointer"
                        >
                          Open Focus
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuizState({ topic: task.title, taskTitle: task.title })}
                          className="text-xs text-[#16150F] hover:underline"
                        >
                          Diagnostic Quiz
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 space-y-3">
                <h3 className="font-editorial text-xl font-normal text-[#16150F]">
                  No active tasks yet.
                </h3>
                <p className="text-xs text-[#5E5A50]">
                  Generate a plan first, then select any task to enter focus mode.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('plan')}
                  className="px-5 py-2 text-xs font-medium bg-[#16150F] text-[#F3EFE7] hover:bg-[#2A2821]"
                >
                  Go to Plan
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'big-task' && (
          <BigTaskSection
            onAddToPlan={(step) => {
              if (plan) {
                const newTask: Task = {
                  id: `task-${Date.now()}`,
                  title: step.title,
                  description: step.explanation,
                  deadline: null,
                  estimatedHours: 2,
                  importance: 'high',
                  priorityReason: 'Added from Big Task breakdown',
                  dependencies: step.prerequisites || [],
                  status: 'pending',
                  category: 'work',
                };
                storage.recordAction({
                  type: 'task_added',
                  taskId: newTask.id,
                  taskTitle: newTask.title,
                  details: 'Added from Big Task breakdown',
                });
                const updatedPlan = recalculatePlanOnTaskChange(
                  { ...plan, tasks: [...plan.tasks, newTask] },
                  2,
                  7,
                  new Date(),
                  {
                    type: 'add',
                    taskId: newTask.id,
                    taskTitle: newTask.title,
                  }
                );
                handleUpdatePlan(updatedPlan);
                setActiveTab('plan');
              }
            }}
          />
        )}
      </main>

      {/* Focus Modal View */}
      {focusTask && (
        <FocusModal
          task={focusTask}
          onClose={() => setFocusTask(null)}
          onToggleComplete={(id) => handleToggleTaskCompletion(id)}
          onOpenQuiz={(topic, title) => {
            setFocusTask(null);
            setQuizState({ topic, taskTitle: title });
          }}
        />
      )}

      {/* Quiz Modal View */}
      {quizState && (
        <QuizModal
          topic={quizState.topic}
          taskTitle={quizState.taskTitle}
          onClose={() => setQuizState(null)}
        />
      )}

      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetWorkspace}
      />

      {/* Editorial Footer */}
      <footer className="border-t border-[#16150F]/10 py-8 bg-[#F3EFE7] text-[#5E5A50] text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-editorial text-sm font-medium text-[#16150F]">LifeOS</span>
            <span aria-hidden="true">·</span>
            <span>Paper & Ink Edition</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Realistic scheduling engine</span>
            <span aria-hidden="true">·</span>
            <span>Zero mock data</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

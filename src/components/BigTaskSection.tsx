import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';
import { storage } from '../services/storage';
import { BigTaskBreakdownResponse, BigTaskStep } from '../types';

interface BigTaskSectionProps {
  onAddToPlan?: (step: BigTaskStep) => void;
}

export const BigTaskSection: React.FC<BigTaskSectionProps> = ({ onAddToPlan }) => {
  const [taskInput, setTaskInput] = useState('');
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<BigTaskBreakdownResponse | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const [savedBreakdowns, setSavedBreakdowns] = useState<BigTaskBreakdownResponse[]>(() => {
    return storage.loadBigTasks();
  });

  const handleBreakDown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.breakDownBigTask(taskInput.trim(), level);
      res.id = `big-task-${Date.now()}`;
      setBreakdown(res);
      setExpandedStep(1);
      storage.saveBigTask(res);
      setSavedBreakdowns(storage.loadBigTasks());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to break down this task.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = (promptText: string, stepNumber: number) => {
    navigator.clipboard.writeText(promptText);
    setCopiedStep(stepNumber);
    setTimeout(() => {
      setCopiedStep(null);
    }, 2000);
  };

  return (
    <section className="bg-[#0E0E0C] text-[#F3EFE7] py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
        {/* Editorial Headline */}
        <div className="space-y-3">
          <span className="text-xs font-mono-data uppercase tracking-wider text-[#FF6A45]">
            Deconstruct & Overcome Inertia
          </span>
          <h2 className="font-editorial text-3xl sm:text-5xl font-normal text-[#F3EFE7] leading-tight">
            Don’t know where to start?
          </h2>
          <p className="text-sm sm:text-base text-[#A9A599] max-w-2xl font-normal leading-relaxed">
            Name your daunting goal. We’ll break it into clear stages and give you a 10-minute first move you can do right now.
          </p>
        </div>

        {/* Input & Simple Text Controls */}
        <form onSubmit={handleBreakDown} className="space-y-6">
          <div>
            <label htmlFor="big-task-input" className="sr-only">
              Intimidating goal or project
            </label>
            <input
              id="big-task-input"
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="e.g. Build a full-stack college project, or learn React in 30 days"
              disabled={loading}
              className="w-full bg-[#1A1A17] text-[#F3EFE7] placeholder-[#A9A599]/60 px-4 py-3.5 border border-[#F3EFE7]/15 text-base sm:text-lg focus:outline-none focus:border-[#F3EFE7]"
            />
          </div>

          {/* Simple text controls for skill level (no pills) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
            <div className="flex items-center gap-6 text-xs text-[#A9A599]">
              <span className="font-medium text-[#F3EFE7]">Skill level:</span>
              {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={`transition-colors relative py-1 cursor-pointer focus:outline-none ${
                    level === lvl
                      ? 'text-[#F3EFE7] font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-[#FF6A45]'
                      : 'hover:text-[#F3EFE7]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !taskInput.trim()}
              className="px-6 py-2.5 text-xs font-medium bg-[#F3EFE7] text-[#16150F] hover:bg-[#FAF7F2] active:bg-[#EAE5DA] disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer rounded-xs"
            >
              {loading ? 'Deconstructing...' : 'Break it down'}
            </button>
          </div>

          {loading && (
            <div className="pt-4 text-center space-y-2">
              <div className="h-[2px] w-full bg-[#F3EFE7]/15 overflow-hidden relative">
                <div className="h-full bg-[#FF6A45] w-1/3 animate-[pulse_1.5s_ease-in-out_infinite]" />
              </div>
              <p className="text-xs text-[#A9A599] font-mono-data uppercase">
                Mapping prerequisites, deliverables, and first move...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-[#1A1A17] border-l-2 border-[#FF6A45] text-xs text-[#F3EFE7] space-y-1">
              <p className="font-medium">Could not break down this task right now.</p>
              <p className="text-[#A9A599]">{error}</p>
            </div>
          )}
        </form>

        {/* Breakdown Output */}
        {breakdown && (
          <div className="space-y-8 pt-8 border-t border-[#F3EFE7]/15">
            {/* Overview */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs font-mono-data text-[#A9A599]">
                <span>{breakdown.level}</span>
                <span aria-hidden="true">·</span>
                <span>{breakdown.steps.length} sequential milestones</span>
              </div>
              <h3 className="font-editorial text-2xl font-normal text-[#F3EFE7]">
                {breakdown.bigTask}
              </h3>
              <p className="text-xs text-[#A9A599] leading-relaxed max-w-2xl">
                {breakdown.overview}
              </p>
            </div>

            {/* Prominent First Move */}
            <div className="p-6 bg-[#1A1A17] border border-[#FF6A45]/30 space-y-2">
              <span className="text-[11px] font-mono-data uppercase tracking-wider text-[#FF6A45]">
                Your first move (10 minutes)
              </span>
              <p className="text-base text-[#F3EFE7] font-normal leading-relaxed">
                {breakdown.firstMove}
              </p>
            </div>

            {/* Numbered Steps */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono-data uppercase text-[#A9A599] tracking-wider pb-2 border-b border-[#F3EFE7]/10">
                Execution Sequence
              </h4>

              {breakdown.steps.map((step) => {
                const isExpanded = expandedStep === step.stepNumber;
                const isCopied = copiedStep === step.stepNumber;

                return (
                  <div
                    key={step.stepNumber}
                    className="border border-[#F3EFE7]/10 bg-[#1A1A17] transition-all"
                  >
                    {/* Collapsed Header */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedStep(isExpanded ? null : step.stepNumber)
                      }
                      className="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-[#252520] transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <span className="font-mono-data text-xs text-[#FF6A45] pt-0.5">
                          {String(step.stepNumber).padStart(2, '0')}
                        </span>
                        <div>
                          <h5 className="text-sm sm:text-base font-normal text-[#F3EFE7]">
                            {step.title}
                          </h5>
                          <div className="flex items-center gap-2 text-xs text-[#A9A599] mt-1 font-mono-data">
                            <span>{step.estimatedTime}</span>
                            <span aria-hidden="true">·</span>
                            <span>Deliverable: {step.deliverable}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-mono-data text-[#A9A599] shrink-0 pt-0.5">
                        {isExpanded ? '− Less' : '+ Guide'}
                      </span>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-[#F3EFE7]/10 space-y-4 text-xs">
                        <p className="text-[#A9A599] leading-relaxed">
                          {step.explanation}
                        </p>

                        {/* Step first move */}
                        <div className="p-3 bg-[#0E0E0C] border-l border-[#FF6A45] text-[#F3EFE7]">
                          <span className="text-[10px] font-mono-data uppercase text-[#FF6A45] block">
                            First move for this stage
                          </span>
                          <span className="mt-0.5 block">{step.firstMove}</span>
                        </div>

                        {/* Prerequisites */}
                        {step.prerequisites && step.prerequisites.length > 0 && (
                          <div>
                            <span className="font-mono-data text-[#A9A599] block mb-1">
                              Prerequisites:
                            </span>
                            <span className="text-[#F3EFE7]">
                              {step.prerequisites.join(' · ')}
                            </span>
                          </div>
                        )}

                        {/* Copy-ready prompt */}
                        {step.copyReadyPrompt && (
                          <div className="p-3 bg-[#0E0E0C] border border-[#F3EFE7]/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono-data uppercase text-[#A9A599]">
                                Copy-ready prompt for AI tool
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyPrompt(step.copyReadyPrompt, step.stepNumber)
                                }
                                className="text-xs text-[#F3EFE7] hover:text-[#FF6A45] transition-colors cursor-pointer"
                              >
                                {isCopied ? 'Copied' : 'Copy prompt'}
                              </button>
                            </div>
                            <pre className="text-[11px] font-mono-data text-[#A9A599] whitespace-pre-wrap leading-relaxed select-all">
                              {step.copyReadyPrompt}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Previously Saved Breakdowns */}
        {savedBreakdowns.length > 0 && !breakdown && (
          <div className="pt-8 border-t border-[#F3EFE7]/15 space-y-4">
            <h4 className="text-xs font-mono-data uppercase text-[#A9A599] tracking-wider">
              Past Breakdowns ({savedBreakdowns.length})
            </h4>
            <div className="space-y-2">
              {savedBreakdowns.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setBreakdown(item);
                    setTaskInput(item.bigTask);
                  }}
                  className="w-full text-left p-3 bg-[#1A1A17] hover:bg-[#252520] border border-[#F3EFE7]/10 transition-colors flex items-center justify-between text-xs"
                >
                  <span className="text-[#F3EFE7] font-medium">{item.bigTask}</span>
                  <span className="text-[#A9A599] font-mono-data">
                    {item.steps.length} steps · {item.level}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

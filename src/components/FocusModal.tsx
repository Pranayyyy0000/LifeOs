import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { FocusContentResponse, Task } from '../types';

interface FocusModalProps {
  task: Task | null;
  onClose: () => void;
  onToggleComplete: (taskId: string) => void;
  onOpenQuiz: (topic: string, taskTitle: string) => void;
}

export const FocusModal: React.FC<FocusModalProps> = ({
  task,
  onClose,
  onToggleComplete,
  onOpenQuiz,
}) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<FocusContentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) {
      setContent(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const fetchFocus = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.generateFocusContent(
          task.title,
          task.description || '',
          task.category
        );
        if (isMounted) setContent(res);
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to generate focus guidance.'
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFocus();

    return () => {
      isMounted = false;
    };
  }, [task]);

  if (!task) return null;

  const isCompleted = task.status === 'completed';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#16150F]/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-title"
    >
      <div className="bg-[#F3EFE7] max-w-2xl w-full p-6 sm:p-8 border border-[#16150F]/20 max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#16150F]/10">
          <div>
            <span className="text-xs font-mono-data uppercase tracking-wider text-[#D93A17]">
              Deep Work Focus
            </span>
            <h2 id="focus-title" className="font-editorial text-2xl sm:text-3xl font-normal text-[#16150F] mt-1">
              {task.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#5E5A50] mt-1 font-mono-data">
              <span>{task.estimatedHours}h estimated</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{task.importance} importance</span>
              {task.deadline && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Due {task.deadline}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[#5E5A50] hover:text-[#16150F] py-1 px-2 border border-[#16150F]/20 cursor-pointer"
            aria-label="Close focus view"
          >
            Esc
          </button>
        </div>

        {/* Task description */}
        {task.description && (
          <p className="text-sm text-[#5E5A50] leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Loading state */}
        {loading && (
          <div className="py-8 text-center space-y-2">
            <div className="h-[2px] w-full bg-[#16150F]/10 overflow-hidden relative">
              <div className="h-full bg-[#16150F] w-1/3 animate-[pulse_1.5s_ease-in-out_infinite]" />
            </div>
            <p className="text-xs text-[#5E5A50] font-mono-data uppercase">
              Generating focused execution guide...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-[#EAE5DA] border-l-2 border-[#D93A17] text-xs space-y-1">
            <p className="font-medium text-[#16150F]">Could not generate focus guide right now.</p>
            <p className="text-[#5E5A50]">{error}</p>
          </div>
        )}

        {/* Dynamic Focus Content */}
        {content && !loading && (
          <div className="space-y-6">
            {/* First move highlight */}
            <div className="p-4 bg-[#16150F] text-[#F3EFE7] space-y-1">
              <span className="text-[11px] font-mono-data uppercase text-[#FF6A45]">
                Your first move (First 2 minutes)
              </span>
              <p className="text-sm text-[#F3EFE7] font-normal">
                {content.firstMove}
              </p>
            </div>

            {/* Why it matters */}
            <div>
              <h3 className="text-xs font-mono-data uppercase text-[#5E5A50] tracking-wider mb-1">
                Why this matters
              </h3>
              <p className="text-sm text-[#16150F] leading-relaxed">
                {content.whyItMatters}
              </p>
            </div>

            {/* Concise Guide pointers */}
            {content.conciseGuide && content.conciseGuide.length > 0 && (
              <div>
                <h3 className="text-xs font-mono-data uppercase text-[#5E5A50] tracking-wider mb-2">
                  Execution Steps
                </h3>
                <ol className="space-y-2 text-xs text-[#16150F] list-decimal list-inside leading-relaxed">
                  {content.conciseGuide.map((step, idx) => (
                    <li key={idx} className="pl-1">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Traps to avoid */}
            {content.potentialPitfalls && content.potentialPitfalls.length > 0 && (
              <div>
                <h3 className="text-xs font-mono-data uppercase text-[#5E5A50] tracking-wider mb-2">
                  Pitfalls to avoid
                </h3>
                <ul className="space-y-1 text-xs text-[#5E5A50] list-disc list-inside leading-relaxed">
                  {content.potentialPitfalls.map((pitfall, idx) => (
                    <li key={idx}>{pitfall}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Self-check question */}
            {content.quickSelfCheckQuestion && (
              <div className="p-3 bg-[#EAE5DA] border-l-2 border-[#16150F]/20 text-xs">
                <span className="font-medium text-[#16150F]">Self-check: </span>
                <span className="text-[#5E5A50]">{content.quickSelfCheckQuestion}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-6 border-t border-[#16150F]/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button
            type="button"
            onClick={() => onOpenQuiz(task.title, task.title)}
            className="text-xs text-[#16150F] hover:underline underline-offset-2 transition-colors py-2"
          >
            Test knowledge with a quick quiz
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onToggleComplete(task.id);
                onClose();
              }}
              className={`px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
                isCompleted
                  ? 'bg-transparent border border-[#16150F] text-[#16150F] hover:bg-[#EAE5DA]'
                  : 'bg-[#16150F] text-[#F3EFE7] hover:bg-[#2A2821]'
              }`}
            >
              {isCompleted ? 'Mark as incomplete' : 'Complete task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

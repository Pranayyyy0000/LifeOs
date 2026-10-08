import React, { useState } from 'react';
import { storage } from '../services/storage';
import { AdaptationNotice, UserAction } from '../types';

interface AdaptationNoticeBannerProps {
  notice: AdaptationNotice;
  onDismiss: () => void;
  onTriggerDeepAdapt?: () => void;
  isDeepAdapting?: boolean;
}

export const AdaptationNoticeBanner: React.FC<AdaptationNoticeBannerProps> = ({
  notice,
  onDismiss,
  onTriggerDeepAdapt,
  isDeepAdapting = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [actions, setActions] = useState<UserAction[]>([]);

  const toggleDetails = () => {
    if (!showDetails) {
      setActions(storage.loadActions());
    }
    setShowDetails(!showDetails);
  };

  const formatActionType = (type: UserAction['type']) => {
    switch (type) {
      case 'task_completed':
        return 'Completed';
      case 'task_uncompleted':
        return 'Reopened';
      case 'task_missed':
        return 'Missed / Rescheduled';
      case 'task_duration_changed':
        return 'Duration adjusted';
      case 'task_importance_changed':
        return 'Priority changed';
      case 'task_deleted':
        return 'Removed';
      case 'task_added':
        return 'Added';
      default:
        return 'Modified';
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="mb-8 border border-[#16150F]/20 bg-[#EAE5DA] p-5 sm:p-6 transition-all animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D93A17]" />
            <span className="text-[11px] font-mono-data tracking-wider uppercase text-[#D93A17]">
              Schedule Adapted
            </span>
          </div>
          <h3 className="font-editorial text-2xl sm:text-3xl font-normal text-[#16150F]">
            {notice.headline}
          </h3>
          <p className="text-sm text-[#16150F] leading-relaxed font-normal pt-1">
            {notice.explanation}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={toggleDetails}
            className="px-3 py-1.5 text-xs text-[#16150F] hover:bg-[#F3EFE7] border border-[#16150F]/20 transition-colors cursor-pointer"
          >
            {showDetails ? 'Hide details' : 'What changed'}
          </button>
          {onTriggerDeepAdapt && (
            <button
              type="button"
              onClick={onTriggerDeepAdapt}
              disabled={isDeepAdapting}
              className="px-3 py-1.5 text-xs text-[#16150F] hover:bg-[#F3EFE7] border border-[#16150F]/20 disabled:opacity-50 transition-colors cursor-pointer"
              title="Run deeper AI recalculation using session history"
            >
              {isDeepAdapting ? 'Recalculating...' : 'Deep adapt with AI'}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs bg-[#16150F] text-[#F3EFE7] hover:bg-[#2A2821] transition-colors cursor-pointer"
            aria-label="Dismiss notice"
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Expandable transparent session journal */}
      {showDetails && (
        <div className="mt-5 pt-4 border-t border-[#16150F]/15 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-mono-data text-[#5E5A50] uppercase">
            <span>Actual actions recorded during this session</span>
            <span>Real time</span>
          </div>

          {actions.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {actions.map((act) => (
                <div
                  key={act.id}
                  className="py-1.5 px-2 bg-[#F3EFE7] text-xs flex items-center justify-between gap-3 border-l-2 border-[#16150F]"
                >
                  <div className="truncate">
                    <span className="font-mono-data text-[11px] text-[#5E5A50] uppercase mr-2">
                      [{formatActionType(act.type)}]
                    </span>
                    <span className="font-medium text-[#16150F]">{act.taskTitle}</span>
                    {act.details && (
                      <span className="text-[#5E5A50] ml-1.5">({act.details})</span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono-data text-[#5E5A50] shrink-0">
                    {formatTimestamp(act.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#5E5A50]">
              Schedule re-calculated based on current task duration and priority balance.
            </p>
          )}

          {notice.actionSummary && notice.actionSummary.length > 0 && (
            <div className="pt-2">
              <span className="text-[11px] font-mono-data uppercase text-[#5E5A50] block mb-1">
                Engine adjustments:
              </span>
              <ul className="text-xs text-[#16150F] space-y-1 list-disc list-inside">
                {notice.actionSummary.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

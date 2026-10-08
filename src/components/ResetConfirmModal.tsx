import React from 'react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#16150F]/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-title"
    >
      <div className="bg-[#F3EFE7] max-w-sm w-full p-6 border border-[#16150F]/20 space-y-4">
        <span className="text-xs font-mono-data uppercase tracking-wider text-[#D93A17]">
          Reset Workspace
        </span>
        <h3 id="reset-title" className="font-editorial text-2xl text-[#16150F]">
          Clear all stored data?
        </h3>
        <p className="text-xs text-[#5E5A50] leading-relaxed">
          This will permanently delete your current plan, saved tasks, breakdowns, and quiz diagnostic scores from this browser. This cannot be undone.
        </p>

        <div className="pt-2 flex items-center justify-end gap-3 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[#5E5A50] hover:text-[#16150F] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-[#D93A17] text-[#F3EFE7] hover:bg-[#b52f12] transition-colors cursor-pointer"
          >
            Delete all data
          </button>
        </div>
      </div>
    </div>
  );
};

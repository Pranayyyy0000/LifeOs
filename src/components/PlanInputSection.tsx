import React, { useState } from 'react';

interface PlanInputSectionProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  loadingStep: string;
  error: string | null;
  onClearError: () => void;
}

const EXAMPLES = [
  {
    label: 'Exam week',
    text: "I have an internship interview in 12 days. I know basic Java but I'm weak in SQL and DSA. I have college from 9 to 4 and can study for 2 hours every evening.",
  },
  {
    label: 'Everything due',
    text: "I have ₹8000 for this month. I need to pay ₹2500 rent, ₹1500 for a course, save ₹2000, and manage food and transport before the 28th.",
  },
  {
    label: 'Big project',
    text: "I need to build my first full-stack project in 10 days. I know HTML, CSS and JavaScript but haven't worked with backend development before. I have college from 9 to 4.",
  },
];

export const PlanInputSection: React.FC<PlanInputSectionProps> = ({
  input,
  setInput,
  onSubmit,
  isLoading,
  loadingStep,
  error,
  onClearError,
}) => {
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      setValidationMsg('Please write a sentence or two about what you need to get done.');
      return;
    }
    setValidationMsg(null);
    onSubmit();
  };

  const handleSelectExample = (text: string) => {
    setInput(text);
    setValidationMsg(null);
    onClearError();
  };

  return (
    <section className="py-8 md:py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        {/* Large Editorial Hero Headline */}
        <h1 className="font-editorial text-4xl sm:text-6xl md:text-7xl font-normal tracking-tight text-[#16150F] leading-[1.08] mb-4">
          Chaos in. Clarity out.
        </h1>
        <p className="text-base sm:text-lg text-[#5E5A50] max-w-xl mx-auto mb-8 font-normal leading-relaxed">
          Tell us everything you need to do. We’ll turn it into a plan you can actually follow.
        </p>

        {/* Main Input Form */}
        <form onSubmit={handleSubmit} className="text-left">
          <div className="relative bg-[#EAE5DA] border border-[#16150F]/15 rounded-sm p-4 md:p-6 transition-all focus-within:border-[#16150F] focus-within:bg-[#FAF7F2]">
            <label htmlFor="messy-input" className="sr-only">
              Everything on your mind. Be messy.
            </label>
            <textarea
              id="messy-input"
              rows={4}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (validationMsg) setValidationMsg(null);
              }}
              disabled={isLoading}
              placeholder="Everything on your mind. Be messy."
              className="w-full bg-transparent text-[#16150F] placeholder-[#5E5A50]/70 text-base md:text-lg leading-relaxed resize-none focus:outline-none"
            />

            {/* Bottom Form Actions */}
            <div className="mt-4 pt-4 border-t border-[#16150F]/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Examples bar */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E5A50]">
                <span className="font-medium text-[#16150F]">Try:</span>
                {EXAMPLES.map((ex, idx) => (
                  <React.Fragment key={ex.label}>
                    <button
                      type="button"
                      onClick={() => handleSelectExample(ex.text)}
                      className="hover:text-[#16150F] underline underline-offset-2 transition-colors cursor-pointer py-1"
                    >
                      {ex.label}
                    </button>
                    {idx < EXAMPLES.length - 1 && <span aria-hidden="true">·</span>}
                  </React.Fragment>
                ))}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="self-end sm:self-auto px-6 py-2.5 text-sm font-medium bg-[#16150F] text-[#F3EFE7] hover:bg-[#2A2821] active:bg-[#000000] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer rounded-xs focus:outline-none focus:ring-2 focus:ring-[#16150F] focus:ring-offset-2"
              >
                {isLoading ? 'Processing...' : 'Plan my day'}
              </button>
            </div>
          </div>

          {/* Validation Message */}
          {validationMsg && (
            <div className="mt-3 text-xs text-[#D93A17] font-medium" role="alert">
              {validationMsg}
            </div>
          )}

          {/* Loading Indicator with Step Messages */}
          {isLoading && (
            <div className="mt-6 space-y-2 text-center" aria-live="polite">
              {/* Thin progress line */}
              <div className="h-[2px] w-full bg-[#16150F]/10 overflow-hidden relative">
                <div className="h-full bg-[#16150F] w-1/3 animate-[pulse_1.5s_ease-in-out_infinite]" />
              </div>
              <p className="text-xs text-[#5E5A50] font-mono-data tracking-wide uppercase pt-1">
                {loadingStep || 'Reading what you wrote.'}
              </p>
            </div>
          )}

          {/* Calm Human Error Display */}
          {error && (
            <div
              className="mt-6 p-4 bg-[#EAE5DA] border-l-2 border-[#D93A17] text-left space-y-2"
              role="alert"
            >
              <p className="text-sm text-[#16150F] font-medium">
                LifeOS couldn’t create your plan right now.
              </p>
              <p className="text-xs text-[#5E5A50]">
                {error}
              </p>
              <div className="pt-2 flex items-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={onSubmit}
                  className="font-medium text-[#16150F] underline hover:text-[#D93A17] transition-colors"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={onClearError}
                  className="text-[#5E5A50] hover:text-[#16150F] transition-colors"
                >
                  Edit your input
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </section>
  );
};

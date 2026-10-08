import React from 'react';

export const ProductStorySection: React.FC = () => {
  return (
    <section className="py-20 md:py-28 border-t border-[#16150F]/10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="max-w-md mb-16 space-y-2">
          <span className="text-xs font-mono-data uppercase tracking-wider text-[#5E5A50]">
            System Architecture
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl font-normal text-[#16150F]">
            How it works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {/* Section 1 */}
          <div className="space-y-3 pt-4 border-t border-[#16150F]/20">
            <span className="font-mono-data text-xs text-[#5E5A50]">01</span>
            <h3 className="font-editorial text-2xl font-normal text-[#16150F]">
              It reads the mess.
            </h3>
            <p className="text-sm text-[#5E5A50] leading-relaxed">
              Write it like you’d say it. We pull out the tasks, deadlines, and limits.
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-3 pt-4 border-t border-[#16150F]/20">
            <span className="font-mono-data text-xs text-[#5E5A50]">02</span>
            <h3 className="font-editorial text-2xl font-normal text-[#16150F]">
              It does the math.
            </h3>
            <p className="text-sm text-[#5E5A50] leading-relaxed">
              Your plan is calculated, not guessed. Classes, practice, and sleep stay protected.
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-3 pt-4 border-t border-[#16150F]/20">
            <span className="font-mono-data text-xs text-[#5E5A50]">03</span>
            <h3 className="font-editorial text-2xl font-normal text-[#16150F]">
              It helps you start.
            </h3>
            <p className="text-sm text-[#5E5A50] leading-relaxed">
              Every task opens with an explanation, a quiz, or a first move.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

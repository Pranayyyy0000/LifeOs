import React, { useState } from 'react';

interface NavigationProps {
  activeTab: 'plan' | 'focus' | 'big-task';
  onSelectTab: (tab: 'plan' | 'focus' | 'big-task') => void;
  onOpenReset: () => void;
  hasActivePlan: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenReset,
  hasActivePlan,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (tab: 'plan' | 'focus' | 'big-task') => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F3EFE7]/90 backdrop-blur-sm border-b border-[#16150F]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Zone 1: Brand title wordmark */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleNavClick('plan')}
            className="text-lg font-serif font-semibold tracking-tight text-[#16150F] hover:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-[#16150F]"
          >
            LifeOS
          </button>
        </div>

        {/* Zone 2: Minimal text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm" aria-label="Main Navigation">
          <button
            type="button"
            onClick={() => handleNavClick('plan')}
            className={`transition-colors relative py-1 focus:outline-none ${
              activeTab === 'plan'
                ? 'text-[#16150F] font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-[#16150F]'
                : 'text-[#5E5A50] hover:text-[#16150F]'
            }`}
          >
            Plan
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('focus')}
            className={`transition-colors relative py-1 focus:outline-none ${
              activeTab === 'focus'
                ? 'text-[#16150F] font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-[#16150F]'
                : 'text-[#5E5A50] hover:text-[#16150F]'
            }`}
          >
            Focus
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('big-task')}
            className={`transition-colors relative py-1 focus:outline-none ${
              activeTab === 'big-task'
                ? 'text-[#16150F] font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-[#16150F]'
                : 'text-[#5E5A50] hover:text-[#16150F]'
            }`}
          >
            Big Task
          </button>
        </nav>

        {/* Zone 3: Primary action / Reset */}
        <div className="flex items-center gap-4">
          {hasActivePlan && (
            <button
              type="button"
              onClick={onOpenReset}
              className="text-xs text-[#5E5A50] hover:text-[#D93A17] transition-colors py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-[#D93A17]"
              title="Delete all stored user data"
            >
              Reset
            </button>
          )}

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#16150F] hover:text-[#5E5A50] focus:outline-none"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className="sr-only">Menu</span>
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className={`block h-[1.5px] w-full bg-[#16150F] transition-transform ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`block h-[1.5px] w-full bg-[#16150F] transition-opacity ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-[1.5px] w-full bg-[#16150F] transition-transform ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile navigation panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#16150F]/10 bg-[#F3EFE7] px-4 py-4 space-y-3">
          <button
            type="button"
            onClick={() => handleNavClick('plan')}
            className={`block w-full text-left py-2 text-sm ${
              activeTab === 'plan' ? 'font-medium text-[#16150F]' : 'text-[#5E5A50]'
            }`}
          >
            Plan
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('focus')}
            className={`block w-full text-left py-2 text-sm ${
              activeTab === 'focus' ? 'font-medium text-[#16150F]' : 'text-[#5E5A50]'
            }`}
          >
            Focus
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('big-task')}
            className={`block w-full text-left py-2 text-sm ${
              activeTab === 'big-task' ? 'font-medium text-[#16150F]' : 'text-[#5E5A50]'
            }`}
          >
            Big Task
          </button>
        </div>
      )}
    </header>
  );
};

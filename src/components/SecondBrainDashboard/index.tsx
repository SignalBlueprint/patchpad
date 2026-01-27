import { useEffect, useState, useCallback } from 'react';
import type { Note } from '../../types/note';
import type { Concept } from '../../services/brain';
import {
  getEditingStreak,
  getMostActiveNotes,
  getUnconnectedNotes,
  extractRecentConcepts,
  getFadingMemories,
  type FadingMemory,
} from '../../services/dashboardInsights';
import { GreetingSection } from './GreetingSection';
import { BrewingIdeasSection } from './BrewingIdeasSection';
import { FadingMemoriesSection } from './FadingMemoriesSection';

interface SecondBrainDashboardProps {
  notes: Note[];
  concepts?: Concept[]; // Optional for backward compatibility with App.tsx
  onNavigateToNote: (id: string) => void;
  onConnectNotes: (fromNoteId: string, toNoteTitle: string) => void;
  onClose: () => void;
}

const SHOW_ON_STARTUP_KEY = 'patchpad_show_dashboard';

export function SecondBrainDashboard({
  notes,
  onNavigateToNote,
  onConnectNotes,
  onClose,
}: SecondBrainDashboardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showOnStartup, setShowOnStartup] = useState(() => {
    return localStorage.getItem(SHOW_ON_STARTUP_KEY) === 'true';
  });

  // Calculate insights
  const [insights, setInsights] = useState<{
    editingStreak: number;
    mostActiveNotes: Note[];
    unconnectedNotes: Note[];
    fadingMemories: FadingMemory[];
  } | null>(null);

  useEffect(() => {
    // Calculate insights
    const editingStreak = getEditingStreak(notes);
    const mostActiveNotes = getMostActiveNotes(notes);
    const unconnectedNotes = getUnconnectedNotes(notes);
    const recentConcepts = extractRecentConcepts(notes);
    const fadingMemories = getFadingMemories(notes, recentConcepts);

    setInsights({
      editingStreak,
      mostActiveNotes,
      unconnectedNotes,
      fadingMemories,
    });

    // Trigger entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, [notes]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  const handleNavigate = useCallback(
    (id: string) => {
      handleClose();
      setTimeout(() => {
        onNavigateToNote(id);
      }, 100);
    },
    [handleClose, onNavigateToNote]
  );

  const handleShowOnStartupChange = (checked: boolean) => {
    setShowOnStartup(checked);
    if (checked) {
      localStorage.setItem(SHOW_ON_STARTUP_KEY, 'true');
    } else {
      localStorage.removeItem(SHOW_ON_STARTUP_KEY);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  if (!insights) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible && !isClosing ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden bg-white rounded-xl shadow-lg border border-neutral-200 transition-all duration-300 ${
          isVisible && !isClosing
            ? 'scale-100 translate-y-0'
            : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header accent */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-primary-600" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Content */}
        <div className="relative overflow-y-auto max-h-[90vh]">
          <div className="pt-10 px-6 pb-6">
            {/* Greeting Section */}
            <GreetingSection
              editingStreak={insights.editingStreak}
              mostActiveNotes={insights.mostActiveNotes}
              onNavigateToNote={handleNavigate}
            />

            {/* Main content grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Brewing Ideas */}
              <BrewingIdeasSection
                unconnectedNotes={insights.unconnectedNotes}
                allNotes={notes}
                onConnectNotes={onConnectNotes}
                onNavigateToNote={handleNavigate}
              />

              {/* Fading Memories */}
              <FadingMemoriesSection
                fadingMemories={insights.fadingMemories}
                onNavigateToNote={handleNavigate}
              />
            </div>

            {/* Footer */}
            <div className="mt-8 flex items-center justify-between">
              {/* Show on startup toggle */}
              <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnStartup}
                  onChange={(e) => handleShowOnStartupChange(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                Show on startup
              </label>

              {/* Start button */}
              <button
                onClick={handleClose}
                className="py-2.5 px-6 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Start Writing
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if dashboard should be shown on startup
 */
export function shouldShowDashboardOnStartup(): boolean {
  return localStorage.getItem(SHOW_ON_STARTUP_KEY) === 'true';
}

import { useEffect, useState } from 'react';
import type { LinkSuggestion } from '../hooks/useLinkSuggestions';

interface LinkSuggestionToastProps {
  suggestions: LinkSuggestion[];
  onAccept: (suggestion: LinkSuggestion) => void;
  onDismiss: (suggestion: LinkSuggestion) => void;
}

export function LinkSuggestionToast({
  suggestions,
  onAccept,
  onDismiss,
}: LinkSuggestionToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState<LinkSuggestion | null>(null);

  // Show the first suggestion
  useEffect(() => {
    if (suggestions.length > 0 && !currentSuggestion) {
      setCurrentSuggestion(suggestions[0]);
      setIsExiting(false);
    }
  }, [suggestions, currentSuggestion]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!currentSuggestion) return;

    const exitTimer = setTimeout(() => setIsExiting(true), 4700);
    const dismissTimer = setTimeout(() => {
      onDismiss(currentSuggestion);
      setCurrentSuggestion(null);
    }, 5000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [currentSuggestion, onDismiss]);

  // Update current suggestion when suggestions change
  useEffect(() => {
    if (currentSuggestion) {
      const stillExists = suggestions.some(
        s => s.term.toLowerCase() === currentSuggestion.term.toLowerCase()
      );
      if (!stillExists) {
        // Current suggestion was removed, show next one if available
        setCurrentSuggestion(suggestions.length > 0 ? suggestions[0] : null);
      }
    }
  }, [suggestions, currentSuggestion]);

  const handleAccept = () => {
    if (currentSuggestion) {
      setIsExiting(true);
      setTimeout(() => {
        onAccept(currentSuggestion);
        setCurrentSuggestion(null);
      }, 200);
    }
  };

  const handleDismiss = () => {
    if (currentSuggestion) {
      setIsExiting(true);
      setTimeout(() => {
        onDismiss(currentSuggestion);
        setCurrentSuggestion(null);
      }, 200);
    }
  };

  if (!currentSuggestion) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`
          flex items-center gap-3 p-4 rounded-xl
          bg-white/80 backdrop-blur-lg border border-neutral-200/50
          shadow-lg shadow-gray-200/50
          transition-all duration-300 ease-out
          max-w-sm
          ${isExiting
            ? 'opacity-0 translate-y-2 scale-95'
            : 'opacity-100 translate-y-0 scale-100'
          }
        `}
      >
        {/* Link icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-neutral-900">
            Link <span className="font-semibold text-primary-600">"{currentSuggestion.term}"</span> to existing note?
          </p>
          {suggestions.length > 1 && (
            <p className="text-xs text-neutral-500 mt-0.5">
              +{suggestions.length - 1} more suggestion{suggestions.length > 2 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAccept}
            className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm"
          >
            Link
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

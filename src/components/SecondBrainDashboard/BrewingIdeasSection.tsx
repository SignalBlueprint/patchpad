import { useState, useEffect } from 'react';
import type { Note } from '../../types/note';
import type { SuggestedLink } from '../../services/dashboardInsights';
import { suggestConnections } from '../../services/dashboardInsights';
import { runAgent } from '../../services/agentFramework';
import { initializeArchivistAgent } from '../../agents/archivist';

interface BrewingIdeasSectionProps {
  unconnectedNotes: Note[];
  allNotes: Note[];
  onConnectNotes: (fromNoteId: string, toNoteTitle: string) => void;
  onNavigateToNote: (id: string) => void;
}

export function BrewingIdeasSection({
  unconnectedNotes,
  allNotes,
  onConnectNotes,
  onNavigateToNote,
}: BrewingIdeasSectionProps) {
  const [suggestions, setSuggestions] = useState<SuggestedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [runningArchivist, setRunningArchivist] = useState(false);

  // Initialize archivist agent on mount
  useEffect(() => {
    initializeArchivistAgent();
  }, []);

  useEffect(() => {
    async function loadSuggestions() {
      setLoading(true);
      const allSuggestions: SuggestedLink[] = [];

      // Get suggestions for up to 5 unconnected notes
      for (const note of unconnectedNotes.slice(0, 5)) {
        try {
          const noteSuggestions = await suggestConnections(note, allNotes);
          allSuggestions.push(...noteSuggestions);
        } catch (error) {
          console.warn('Failed to get suggestions for note:', note.id);
        }
      }

      setSuggestions(allSuggestions.slice(0, 6));
      setLoading(false);
    }

    loadSuggestions();
  }, [unconnectedNotes, allNotes]);

  const handleRunArchivist = async () => {
    setRunningArchivist(true);
    try {
      // Run the archivist's suggestConnections capability
      const result = await runAgent('archivist', 'suggestConnections', { notes: allNotes });

      if (result && result.suggestions) {
        // Show a notification or update UI with agent suggestions count
        console.log(`Archivist found ${result.suggestions.length} connection suggestions`);
        alert(`Archivist found ${result.suggestions.length} new suggestions! Check the Agent Dashboard to review them.`);
      }
    } catch (error) {
      console.error('Failed to run archivist:', error);
      alert('Failed to run Archivist agent. Please try again.');
    } finally {
      setRunningArchivist(false);
    }
  };

  const handleConnect = (suggestion: SuggestedLink) => {
    onConnectNotes(suggestion.fromNote.id, suggestion.toNote.title);
    // Remove this suggestion from the list
    setDismissedIds((prev: Set<string>) => new Set([...prev, `${suggestion.fromNote.id}-${suggestion.toNote.id}`]));
  };

  const handleDismiss = (suggestion: SuggestedLink) => {
    setDismissedIds((prev: Set<string>) => new Set([...prev, `${suggestion.fromNote.id}-${suggestion.toNote.id}`]));
  };

  const visibleSuggestions = suggestions.filter(
    (s: SuggestedLink) => !dismissedIds.has(`${s.fromNote.id}-${s.toNote.id}`)
  );

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-white/50 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-purple-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          Brewing Ideas
        </h3>
        <div className="flex items-center justify-center py-8 text-gray-500">
          <svg
            className="w-6 h-6 animate-spin mr-2"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Finding connections...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-white/50 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-purple-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          Brewing Ideas
          {visibleSuggestions.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500">
              {visibleSuggestions.length} suggestion{visibleSuggestions.length !== 1 ? 's' : ''}
            </span>
          )}
        </h3>
        <button
          onClick={handleRunArchivist}
          disabled={runningArchivist}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
            runningArchivist
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-purple-500 text-white hover:bg-purple-600'
          }`}
          title="Run the Archivist agent to find more connections"
        >
          {runningArchivist ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Running...
            </>
          ) : (
            <>
              <span>📚</span>
              Run Archivist
            </>
          )}
        </button>
      </div>

      {visibleSuggestions.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            />
          </svg>
          <p className="text-sm">Your notes are well connected!</p>
          <p className="text-xs text-gray-400 mt-1">
            Keep adding wiki links to build your knowledge graph.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSuggestions.map((suggestion, index) => (
            <SuggestionCard
              key={`${suggestion.fromNote.id}-${suggestion.toNote.id}-${index}`}
              suggestion={suggestion}
              onConnect={() => handleConnect(suggestion)}
              onDismiss={() => handleDismiss(suggestion)}
              onNavigateToNote={onNavigateToNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: SuggestedLink;
  onConnect: () => void;
  onDismiss: () => void;
  onNavigateToNote: (id: string) => void;
}

function SuggestionCard({
  suggestion,
  onConnect,
  onDismiss,
  onNavigateToNote,
}: SuggestionCardProps) {
  const confidencePercent = Math.round(suggestion.confidence * 100);

  return (
    <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100/50">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* From note */}
          <button
            onClick={() => onNavigateToNote(suggestion.fromNote.id)}
            className="text-sm font-medium text-gray-800 hover:text-purple-600 transition-colors truncate block max-w-full text-left"
            title={suggestion.fromNote.title}
          >
            {suggestion.fromNote.title}
          </button>

          {/* Arrow and suggestion */}
          <div className="flex items-center gap-2 mt-1.5">
            <svg
              className="w-4 h-4 text-purple-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
            <button
              onClick={() => onNavigateToNote(suggestion.toNote.id)}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium truncate"
              title={suggestion.toNote.title}
            >
              [[{suggestion.toNote.title}]]
            </button>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {confidencePercent}% match
            </span>
          </div>

          {/* Reason */}
          {suggestion.reason && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {suggestion.reason}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          <button
            onClick={onConnect}
            className="p-1.5 rounded-md bg-purple-500 text-white hover:bg-purple-600 transition-colors"
            title="Add this link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-md bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors"
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

import { useState, useEffect, useMemo } from 'react';
import type { Note } from '../types/note';
import type { Concept } from '../services/brain';
import { findRelatedNotes, type RelatedNote } from '../services/ai';
import {
  getMostEditedNotes,
  getUnconnectedNotes,
  getFadingNotes,
  getEditingStreak,
  getTimeGreeting,
  getRecentlyUpdatedNotes,
  shouldShowDashboardOnStartup,
  setShowDashboardOnStartup,
  type FadingNote,
} from '../services/dashboardAnalytics';

interface SecondBrainDashboardProps {
  notes: Note[];
  concepts: Concept[];
  onNavigateToNote: (id: string) => void;
  onConnectNotes: (noteId: string, targetTitle: string) => void;
  onClose: () => void;
}

interface ConnectionSuggestion {
  note: Note;
  suggestions: RelatedNote[];
  loading: boolean;
}

export function SecondBrainDashboard({
  notes,
  concepts,
  onNavigateToNote,
  onConnectNotes,
  onClose,
}: SecondBrainDashboardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showOnStartup, setShowOnStartup] = useState(shouldShowDashboardOnStartup);
  const [connectionSuggestions, setConnectionSuggestions] = useState<Map<string, ConnectionSuggestion>>(new Map());

  // Compute dashboard data
  const greeting = useMemo(() => getTimeGreeting(), []);
  const mostEditedNotes = useMemo(() => getMostEditedNotes(notes, 7), [notes]);
  const editingStreak = useMemo(() => getEditingStreak(notes), [notes]);

  // Brewing Ideas: unconnected notes from last 14 days
  const brewingIdeas = useMemo(() => {
    const unconnected = getUnconnectedNotes(notes);
    const recent = getRecentlyUpdatedNotes(unconnected, 14);
    return recent.slice(0, 5);
  }, [notes]);

  // Fading Memories: old notes that mention recent concepts
  const fadingNotes = useMemo(() => getFadingNotes(notes, concepts), [notes, concepts]);

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  // Load connection suggestions for brewing ideas
  useEffect(() => {
    const loadSuggestions = async () => {
      for (const note of brewingIdeas) {
        if (connectionSuggestions.has(note.id)) continue;

        // Set loading state
        setConnectionSuggestions(prev => new Map(prev).set(note.id, {
          note,
          suggestions: [],
          loading: true,
        }));

        try {
          const otherNotes = notes.filter(n => n.id !== note.id);
          const suggestions = await findRelatedNotes(note, otherNotes);
          setConnectionSuggestions(prev => new Map(prev).set(note.id, {
            note,
            suggestions: suggestions.slice(0, 3),
            loading: false,
          }));
        } catch (error) {
          console.error('Failed to load suggestions for note:', note.id, error);
          setConnectionSuggestions(prev => new Map(prev).set(note.id, {
            note,
            suggestions: [],
            loading: false,
          }));
        }
      }
    };

    if (brewingIdeas.length > 0) {
      loadSuggestions();
    }
  }, [brewingIdeas, notes]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleToggleStartup = () => {
    const newValue = !showOnStartup;
    setShowOnStartup(newValue);
    setShowDashboardOnStartup(newValue);
  };

  const handleConnect = (noteId: string, targetTitle: string) => {
    onConnectNotes(noteId, targetTitle);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible && !isClosing ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-4xl mx-4 max-h-[90vh] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden transition-all duration-300 ${
          isVisible && !isClosing ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header gradient */}
        <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-90" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="relative overflow-y-auto max-h-[90vh]">
          {/* Greeting Section */}
          <div className="text-center pt-8 pb-6 px-6">
            <h2 className="text-2xl font-bold text-white mb-2">{greeting}!</h2>
            <p className="text-white/80 text-sm">Your personal knowledge overview</p>
          </div>

          {/* Stats Row */}
          <div className="px-6 pt-8">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                value={notes.length}
                label="Total Notes"
                color="indigo"
              />
              <StatCard
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                value={editingStreak}
                label={editingStreak === 1 ? 'Day Streak' : 'Days Streak'}
                color="purple"
              />
              <StatCard
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                }
                value={concepts.length}
                label="Concepts"
                color="pink"
              />
            </div>

            {/* Most Edited This Week */}
            {mostEditedNotes.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Active This Week
                </h3>
                <div className="flex flex-wrap gap-2">
                  {mostEditedNotes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => {
                        onNavigateToNote(note.id);
                        handleClose();
                      }}
                      className="px-3 py-1 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full transition-colors truncate max-w-[200px]"
                    >
                      {note.title || 'Untitled'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Three Column Layout */}
          <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Brewing Ideas - Left Column */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
              <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Brewing Ideas
                <span className="text-xs font-normal text-amber-600">
                  ({brewingIdeas.length} unlinked)
                </span>
              </h3>
              <p className="text-xs text-amber-600 mb-3">
                Recent notes without connections. Link them to build your knowledge web.
              </p>

              {brewingIdeas.length === 0 ? (
                <p className="text-sm text-amber-600/70 italic">
                  All your recent notes are connected!
                </p>
              ) : (
                <div className="space-y-3">
                  {brewingIdeas.slice(0, 3).map(note => {
                    const suggestionData = connectionSuggestions.get(note.id);
                    return (
                      <BrewingIdeaCard
                        key={note.id}
                        note={note}
                        suggestions={suggestionData?.suggestions || []}
                        loading={suggestionData?.loading || false}
                        notes={notes}
                        onNavigate={() => {
                          onNavigateToNote(note.id);
                          handleClose();
                        }}
                        onConnect={(targetTitle) => handleConnect(note.id, targetTitle)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fading Memories - Right Column */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Fading Memories
                <span className="text-xs font-normal text-blue-600">
                  ({fadingNotes.length} found)
                </span>
              </h3>
              <p className="text-xs text-blue-600 mb-3">
                Old notes that mention topics you've been thinking about recently.
              </p>

              {fadingNotes.length === 0 ? (
                <p className="text-sm text-blue-600/70 italic">
                  {concepts.length === 0
                    ? 'Build your knowledge graph to surface connections.'
                    : 'No fading memories to revisit right now.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {fadingNotes.slice(0, 3).map(fading => (
                    <FadingMemoryCard
                      key={fading.note.id}
                      fading={fading}
                      onNavigate={() => {
                        onNavigateToNote(fading.note.id);
                        handleClose();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnStartup}
                onChange={handleToggleStartup}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Show on startup
            </label>

            <button
              onClick={handleClose}
              className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg shadow-indigo-500/25"
            >
              Start Working
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: 'indigo' | 'purple' | 'pink';
}

function StatCard({ icon, value, label, color }: StatCardProps) {
  const colorClasses = {
    indigo: 'from-indigo-50 to-indigo-100 text-indigo-600 border-indigo-100',
    purple: 'from-purple-50 to-purple-100 text-purple-600 border-purple-100',
    pink: 'from-pink-50 to-pink-100 text-pink-600 border-pink-100',
  };

  return (
    <div
      className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} border text-center`}
    >
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}

// Brewing Idea Card Component
interface BrewingIdeaCardProps {
  note: Note;
  suggestions: RelatedNote[];
  loading: boolean;
  notes: Note[];
  onNavigate: () => void;
  onConnect: (targetTitle: string) => void;
}

function BrewingIdeaCard({ note, suggestions, loading, notes, onNavigate, onConnect }: BrewingIdeaCardProps) {
  const firstSuggestion = suggestions[0];
  const targetNote = firstSuggestion ? notes.find(n => n.id === firstSuggestion.noteId) : null;

  return (
    <div className="bg-white/60 rounded-lg p-3 border border-amber-100/50">
      <button
        onClick={onNavigate}
        className="text-left w-full"
      >
        <h4 className="font-medium text-gray-800 text-sm truncate hover:text-indigo-600 transition-colors">
          {note.title || 'Untitled'}
        </h4>
        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
          {note.content.slice(0, 80)}...
        </p>
      </button>

      {loading ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Finding connections...
        </div>
      ) : targetNote ? (
        <div className="mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConnect(targetNote.title);
            }}
            className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 bg-amber-100/50 hover:bg-amber-100 px-2 py-1 rounded transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Connect to "{targetNote.title}"
          </button>
          {firstSuggestion?.reason && (
            <p className="text-xs text-amber-600/70 mt-1 ml-5 italic">
              {firstSuggestion.reason}
            </p>
          )}
        </div>
      ) : suggestions.length === 0 && !loading ? (
        <p className="mt-2 text-xs text-amber-600/60 italic">
          No connection suggestions yet
        </p>
      ) : null}
    </div>
  );
}

// Fading Memory Card Component
interface FadingMemoryCardProps {
  fading: FadingNote;
  onNavigate: () => void;
}

function FadingMemoryCard({ fading, onNavigate }: FadingMemoryCardProps) {
  return (
    <div className="bg-white/60 rounded-lg p-3 border border-blue-100/50">
      <button
        onClick={onNavigate}
        className="text-left w-full"
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-gray-800 text-sm truncate hover:text-indigo-600 transition-colors flex-1">
            {fading.note.title || 'Untitled'}
          </h4>
          <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
            {fading.daysSinceUpdate}d ago
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
          {fading.note.content.slice(0, 80)}...
        </p>
      </button>

      {fading.relevantConcepts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {fading.relevantConcepts.slice(0, 3).map(concept => (
            <span
              key={concept}
              className="text-xs bg-blue-100/50 text-blue-700 px-2 py-0.5 rounded"
            >
              {concept}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onNavigate}
        className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Revisit
      </button>
    </div>
  );
}

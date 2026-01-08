import { useState, useEffect, useMemo } from 'react';
import type { Note } from '../../types/note';
import type { ThinkingSession } from '../../services/thinkingSession';
import {
  formatSessionDuration,
  formatSessionTimeRange,
  extractSessionTags,
  generateSessionSummary,
} from '../../services/thinkingSession';

interface TimelineClusterProps {
  session: ThinkingSession;
  notes: Note[];
  onSelectNote: (id: string) => void;
  onViewOnCanvas: (noteIds: string[]) => void;
}

export function TimelineCluster({
  session,
  notes,
  onSelectNote,
  onViewOnCanvas,
}: TimelineClusterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Get notes in this session
  const sessionNotes = useMemo(() => {
    return session.noteIds
      .map(id => notes.find(n => n.id === id))
      .filter((n): n is Note => n !== undefined);
  }, [session.noteIds, notes]);

  // Get common tags
  const tags = useMemo(() => {
    return extractSessionTags(session, notes);
  }, [session, notes]);

  // Load summary
  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      if (sessionNotes.length === 0) {
        setSummary('Empty session');
        return;
      }

      setIsLoadingSummary(true);
      try {
        const generatedSummary = await generateSessionSummary(session, notes);
        if (mounted) {
          setSummary(generatedSummary);
        }
      } catch (error) {
        if (mounted) {
          setSummary(`${sessionNotes.length} notes`);
        }
      } finally {
        if (mounted) {
          setIsLoadingSummary(false);
        }
      }
    }

    loadSummary();

    return () => {
      mounted = false;
    };
  }, [session, notes, sessionNotes.length]);

  const hasCanvasPositions = sessionNotes.some(n => n.canvasPosition);

  return (
    <div className="relative ml-6 pl-6 border-l-2 border-gray-200 hover:border-indigo-300 transition-colors">
      {/* Timeline connector dot */}
      <div className="absolute left-0 top-4 w-3 h-3 -translate-x-[7px] rounded-full bg-white border-2 border-indigo-400 shadow-sm" />

      {/* Cluster card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-50/50 transition-colors"
        >
          {/* Time info */}
          <div className="flex-shrink-0 text-right min-w-[80px]">
            <div className="text-sm font-medium text-gray-700">
              {formatSessionTimeRange(session)}
            </div>
            <div className="text-xs text-gray-400">
              {formatSessionDuration(session)}
            </div>
          </div>

          {/* Vertical divider */}
          <div className="flex-shrink-0 w-px h-10 bg-gray-200" />

          {/* Content */}
          <div className="flex-grow min-w-0">
            {/* Summary */}
            <div className="flex items-center gap-2">
              {isLoadingSummary ? (
                <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
              ) : (
                <p className="text-sm font-medium text-gray-800 truncate">
                  {summary}
                </p>
              )}
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-3 mt-1">
              {/* Note count */}
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {session.noteIds.length} {session.noteIds.length === 1 ? 'note' : 'notes'}
              </span>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex items-center gap-1">
                  {tags.slice(0, 2).map(tag => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                  {tags.length > 2 && (
                    <span className="text-xs text-gray-400">
                      +{tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Expand chevron */}
          <div className="flex-shrink-0">
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100">
            {/* Notes list */}
            <div className="mt-3 space-y-2">
              {sessionNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-indigo-50 transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 text-gray-400 group-hover:text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="min-w-0 flex-grow">
                      <h4 className="text-sm font-medium text-gray-700 group-hover:text-indigo-700 truncate">
                        {note.title || 'Untitled'}
                      </h4>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {note.content.slice(0, 60)}...
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2">
              {hasCanvasPositions && (
                <button
                  onClick={() => onViewOnCanvas(session.noteIds)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  View on Canvas
                </button>
              )}

              <span className="text-xs text-gray-400">
                Created {new Date(session.startTime).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

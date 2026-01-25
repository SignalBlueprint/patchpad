import { useState, useMemo, useRef } from 'react';
import type { Note } from '../../types/note';
import {
  clusterIntoSessions,
  groupSessionsByDate,
} from '../../services/thinkingSession';
import { TimelineCluster } from './TimelineCluster';
import { TimelineDateMarker } from './TimelineDateMarker';

interface TimelineViewProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
  onSelectCluster: (noteIds: string[]) => void;
}

export function TimelineView({
  notes,
  onSelectNote,
  onSelectCluster,
}: TimelineViewProps) {
  const [maxGapMinutes, setMaxGapMinutes] = useState(60);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cluster notes into sessions
  const sessions = useMemo(() => {
    return clusterIntoSessions(notes, maxGapMinutes);
  }, [notes, maxGapMinutes]);

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    return groupSessionsByDate(sessions);
  }, [sessions]);

  // Sort dates (most recent first)
  const sortedDates = useMemo(() => {
    return [...sessionsByDate.keys()].sort().reverse();
  }, [sessionsByDate]);

  // Stats
  const stats = useMemo(() => {
    const totalSessions = sessions.length;
    const totalNotes = notes.length;
    const avgNotesPerSession = totalSessions > 0 ? (totalNotes / totalSessions).toFixed(1) : '0';
    const longestSession = sessions.reduce((max, s) =>
      s.noteIds.length > max.noteIds.length ? s : max,
      sessions[0] || { noteIds: [] }
    );
    return { totalSessions, totalNotes, avgNotesPerSession, longestSession };
  }, [sessions, notes.length]);

  const handleViewOnCanvas = (noteIds: string[]) => {
    // Store highlight data for canvas
    localStorage.setItem('patchpad_timeline_highlight', JSON.stringify({
      noteIds,
      expiry: new Date(Date.now() + 5000).toISOString(), // 5 second highlight
    }));
    onSelectCluster(noteIds);
  };

  if (notes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-neutral-600 mb-2">No thinking sessions yet</h3>
          <p className="text-sm text-neutral-400 max-w-xs">
            Start creating notes and they'll appear here grouped by when you created them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-50">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Thinking Timeline</h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              Your notes grouped by thinking sessions
            </p>
          </div>

          {/* Settings button */}
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            title="Timeline settings"
          >
            <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Settings panel */}
        {isSettingsOpen && (
          <div className="mt-4 p-4 bg-neutral-50 rounded-lg border border-gray-100">
            <label className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">Session gap threshold</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="15"
                  max="180"
                  step="15"
                  value={maxGapMinutes}
                  onChange={(e) => setMaxGapMinutes(Number(e.target.value))}
                  className="w-32 accent-indigo-500"
                />
                <span className="text-sm font-medium text-neutral-700 w-16 text-right">
                  {maxGapMinutes} min
                </span>
              </div>
            </label>
            <p className="text-xs text-neutral-400 mt-2">
              Notes created within this time of each other are grouped into the same session.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-secondary-600">{stats.totalSessions}</div>
            <div className="text-xs text-indigo-500">Sessions</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-secondary-600">{stats.avgNotesPerSession}</div>
            <div className="text-xs text-purple-500">Avg notes/session</div>
          </div>
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-pink-600">
              {stats.longestSession?.noteIds.length || 0}
            </div>
            <div className="text-xs text-pink-500">Largest session</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div
        ref={containerRef}
        className="flex-grow overflow-y-auto px-6 py-4"
      >
        {sortedDates.map((dateStr, dateIndex) => {
          const dateSessions = sessionsByDate.get(dateStr) || [];

          return (
            <div key={dateStr} className="mb-6">
              {/* Date marker - sticky for each date */}
              <TimelineDateMarker
                dateStr={dateStr}
                isSticky={dateIndex === 0}
              />

              {/* Sessions for this date */}
              <div className="space-y-4 mt-2">
                {dateSessions.map(session => (
                  <TimelineCluster
                    key={session.id}
                    session={session}
                    notes={notes}
                    onSelectNote={onSelectNote}
                    onViewOnCanvas={handleViewOnCanvas}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}

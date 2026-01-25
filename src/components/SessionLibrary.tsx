/**
 * Session Library Component
 *
 * Browse, search, and manage recorded thinking sessions.
 */

import { useState, useEffect } from 'react';
import type { ThinkingSession } from '../types/session';
import {
  getAllSessions,
  deleteSession,
  exportSessionAsJSON,
  importSessionFromJSON,
} from '../services/sessionRecorder';
import { formatDuration } from '../services/sessionPlayback';

interface SessionLibraryProps {
  onSelectSession: (session: ThinkingSession) => void;
  onClose: () => void;
}

type SortField = 'date' | 'duration' | 'events';
type SortOrder = 'asc' | 'desc';

export function SessionLibrary({ onSelectSession, onClose }: SessionLibraryProps) {
  const [sessions, setSessions] = useState<ThinkingSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load sessions
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const allSessions = await getAllSessions();
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort sessions
  const filteredSessions = sessions
    .filter((s) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        s.title?.toLowerCase().includes(query) ||
        s.tags.some((t) => t.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison =
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
          break;
        case 'duration':
          comparison = a.durationMs - b.durationMs;
          break;
        case 'events':
          comparison = a.events.length - b.events.length;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    await deleteSession(id);
    setSessions(sessions.filter((s) => s.id !== id));
    setSelectedIds((ids) => {
      const newIds = new Set(ids);
      newIds.delete(id);
      return newIds;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(`Delete ${selectedIds.size} session(s)? This cannot be undone.`)
    )
      return;

    for (const id of selectedIds) {
      await deleteSession(id);
    }
    setSessions(sessions.filter((s) => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
  };

  const handleExport = async (session: ThinkingSession) => {
    const json = exportSessionAsJSON(session);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const session = importSessionFromJSON(text);
        if (session) {
          setSessions([session, ...sessions]);
        }
      } catch (error) {
        console.error('Failed to import session:', error);
        alert('Failed to import session. Invalid file format.');
      }
    };
    input.click();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((ids) => {
      const newIds = new Set(ids);
      if (newIds.has(id)) {
        newIds.delete(id);
      } else {
        newIds.add(id);
      }
      return newIds;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSessions.map((s) => s.id)));
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const d = new Date(date);
    const isToday = d.toDateString() === now.toDateString();
    const isYesterday =
      new Date(now.getTime() - 86400000).toDateString() === d.toDateString();

    if (isToday)
      return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (isYesterday)
      return `Yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const SortButton = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <button
      onClick={() => {
        if (sortField === field) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
          setSortField(field);
          setSortOrder('desc');
        }
      }}
      className={`px-2 py-1 text-xs rounded ${
        sortField === field
          ? 'bg-blue-100 text-blue-700'
          : 'text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {label}
      {sortField === field && (
        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Session Library
            </h2>
            <p className="text-sm text-neutral-500">
              {sessions.length} recorded session{sessions.length !== 1 && 's'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImport}
              className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Import
            </button>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100"
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
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-64 pl-9 pr-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Sort and bulk actions */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-xs text-neutral-500 mr-1">Sort:</span>
              <SortButton field="date" label="Date" />
              <SortButton field="duration" label="Duration" />
              <SortButton field="events" label="Events" />
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 text-sm text-error-600 hover:text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-1"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
              <svg
                className="w-12 h-12 mb-2 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm">
                {searchQuery ? 'No sessions match your search' : 'No recorded sessions yet'}
              </p>
              <p className="text-xs mt-1">
                Start recording from the canvas to capture your thinking
              </p>
            </div>
          ) : (
            <div className="p-4">
              {/* Select all header */}
              <div className="flex items-center gap-2 mb-3 px-2">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === filteredSessions.length &&
                    filteredSessions.length > 0
                  }
                  onChange={toggleSelectAll}
                  className="rounded border-neutral-300 text-primary-500 focus:ring-blue-200"
                />
                <span className="text-sm text-neutral-500">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : 'Select all'}
                </span>
              </div>

              {/* Session cards */}
              <div className="space-y-2">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      selectedIds.has(session.id)
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(session.id)}
                        onChange={() => toggleSelect(session.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 rounded border-neutral-300 text-primary-500 focus:ring-blue-200"
                      />

                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => onSelectSession(session)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-neutral-900">
                            {session.title || 'Untitled Session'}
                          </h3>
                          <span className="text-sm text-neutral-500">
                            {formatDate(session.startTime)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-neutral-600">
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {formatDuration(session.durationMs)}
                          </span>
                          <span>{session.events.length} events</span>
                          <span>{session.stats.notesCreated} notes created</span>
                        </div>

                        {session.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            {session.tags.slice(0, 5).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                            {session.tags.length > 5 && (
                              <span className="text-xs text-neutral-400">
                                +{session.tags.length - 5}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleExport(session)}
                          className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
                          title="Export"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(session.id)}
                          className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

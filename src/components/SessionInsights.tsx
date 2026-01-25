/**
 * Session Insights Component
 *
 * Displays analysis and insights from a thinking session.
 * Shows patterns, hotspots, activity heatmap, and AI-generated summary.
 */

import { useState, useEffect, useMemo } from 'react';
import type { ThinkingSession } from '../types/session';
import {
  analyzeSession,
  generateHeatmap,
  generateSessionSummary,
  generateSuggestions,
  type SessionInsight,
  type HeatmapCell,
} from '../services/sessionInsights';
import { downloadSessionAsHTML } from '../services/sessionExport';

interface SessionInsightsProps {
  session: ThinkingSession;
  onClose: () => void;
  onNavigateToNote?: (noteId: string) => void;
  onSeekToTime?: (timestamp: number) => void;
}

export function SessionInsights({
  session,
  onClose,
  onNavigateToNote,
  onSeekToTime,
}: SessionInsightsProps) {
  const [activeTab, setActiveTab] = useState<'insights' | 'heatmap' | 'summary'>('insights');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Analyze session
  const insights = useMemo(() => analyzeSession(session), [session]);
  const heatmap = useMemo(() => generateHeatmap(session), [session]);
  const suggestions = useMemo(() => generateSuggestions(session), [session]);

  // Load AI summary
  useEffect(() => {
    if (activeTab === 'summary' && !aiSummary && !loadingSummary) {
      setLoadingSummary(true);
      generateSessionSummary(session)
        .then(setAiSummary)
        .finally(() => setLoadingSummary(false));
    }
  }, [activeTab, session, aiSummary, loadingSummary]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const handleExportHTML = () => {
    downloadSessionAsHTML(session);
  };

  const getInsightBgColor = (type: SessionInsight['type']) => {
    switch (type) {
      case 'time-spent': return 'bg-blue-50 border-blue-200';
      case 'revisitation': return 'bg-purple-50 border-purple-200';
      case 'cluster': return 'bg-green-50 border-green-200';
      case 'breakthrough': return 'bg-yellow-50 border-yellow-200';
      case 'ai-usage': return 'bg-indigo-50 border-indigo-200';
      default: return 'bg-neutral-50 border-neutral-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Session Insights
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              {session.title} • {formatDuration(session.durationMs)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportHTML}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-neutral-100 text-neutral-700 rounded-lg hover:bg-gray-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2 border-b border-gray-100 flex gap-4">
          <button
            onClick={() => setActiveTab('insights')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'insights'
                ? 'border-indigo-500 text-secondary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Patterns & Insights
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'heatmap'
                ? 'border-indigo-500 text-secondary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Activity Heatmap
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-indigo-500 text-secondary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            AI Summary
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'insights' && (
            <div className="space-y-6">
              {/* Quick stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-neutral-50 rounded-lg">
                  <p className="text-2xl font-bold text-neutral-900">
                    {session.events.filter(e => e.type === 'note-create').length}
                  </p>
                  <p className="text-xs text-neutral-500">Notes Created</p>
                </div>
                <div className="text-center p-3 bg-neutral-50 rounded-lg">
                  <p className="text-2xl font-bold text-neutral-900">
                    {session.events.filter(e => e.type === 'note-edit').length}
                  </p>
                  <p className="text-xs text-neutral-500">Edits Made</p>
                </div>
                <div className="text-center p-3 bg-neutral-50 rounded-lg">
                  <p className="text-2xl font-bold text-neutral-900">
                    {session.events.filter(e => e.type === 'note-connect').length}
                  </p>
                  <p className="text-xs text-neutral-500">Connections</p>
                </div>
                <div className="text-center p-3 bg-neutral-50 rounded-lg">
                  <p className="text-2xl font-bold text-neutral-900">
                    {session.annotations.length}
                  </p>
                  <p className="text-xs text-neutral-500">Annotations</p>
                </div>
              </div>

              {/* Insights list */}
              {insights.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-neutral-700">Key Patterns</h3>
                  {insights.map((insight, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border ${getInsightBgColor(insight.type)} cursor-pointer hover:shadow-sm transition-shadow`}
                      onClick={() => {
                        if (insight.timestamp && onSeekToTime) {
                          onSeekToTime(insight.timestamp);
                        } else if (insight.noteIds?.length && onNavigateToNote) {
                          onNavigateToNote(insight.noteIds[0]);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{insight.icon}</span>
                        <div className="flex-1">
                          <h4 className="font-medium text-neutral-900">{insight.title}</h4>
                          <p className="text-sm text-neutral-600 mt-0.5">{insight.description}</p>
                          {insight.timestamp && (
                            <p className="text-xs text-neutral-400 mt-1">
                              At {formatTime(insight.timestamp)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-400">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-sm">No significant patterns detected</p>
                  <p className="text-xs mt-1">Try recording longer sessions for more insights</p>
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h3 className="text-sm font-medium text-indigo-900 flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Suggestions for Next Steps
                  </h3>
                  <ul className="space-y-1">
                    {suggestions.map((suggestion, i) => (
                      <li key={i} className="text-sm text-indigo-800 flex items-start gap-2">
                        <span className="text-indigo-400">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'heatmap' && (
            <div>
              <p className="text-sm text-neutral-600 mb-4">
                Activity density across the canvas during this session
              </p>

              {/* Heatmap visualization */}
              <div className="relative w-full aspect-video bg-neutral-100 rounded-lg overflow-hidden">
                {heatmap.length > 0 ? (
                  <svg className="w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
                    {/* Background grid */}
                    <defs>
                      <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Heatmap cells */}
                    {heatmap.map((cell, i) => {
                      // Normalize positions to fit in viewBox
                      const xs = heatmap.map(c => c.x);
                      const ys = heatmap.map(c => c.y);
                      const minX = Math.min(...xs);
                      const maxX = Math.max(...xs);
                      const minY = Math.min(...ys);
                      const maxY = Math.max(...ys);
                      const rangeX = maxX - minX || 1;
                      const rangeY = maxY - minY || 1;

                      const x = ((cell.x - minX) / rangeX) * 800 + 100;
                      const y = ((cell.y - minY) / rangeY) * 400 + 100;

                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r={20 + cell.intensity * 30}
                          fill={`rgba(99, 102, 241, ${0.2 + cell.intensity * 0.6})`}
                          stroke="none"
                        />
                      );
                    })}
                  </svg>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <p className="text-sm">Not enough position data</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-neutral-500">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-indigo-200" />
                  <span>Low activity</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-indigo-400" />
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-secondary-600" />
                  <span>High activity</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* AI Summary */}
              <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                <h3 className="text-sm font-medium text-indigo-900 flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  What were you thinking about?
                </h3>

                {loadingSummary ? (
                  <div className="flex items-center gap-2 text-sm text-secondary-600">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing your thinking session...
                  </div>
                ) : (
                  <p className="text-sm text-indigo-800 leading-relaxed">{aiSummary}</p>
                )}
              </div>

              {/* Session timeline */}
              <div>
                <h3 className="text-sm font-medium text-neutral-700 mb-3">Session Timeline</h3>
                <div className="space-y-2">
                  {getSessionPhases(session).map((phase, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-indigo-400" />
                        {i < getSessionPhases(session).length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-xs text-neutral-400">{formatTime(phase.startTime)}</p>
                        <p className="text-sm text-neutral-700">{phase.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Annotations as thoughts */}
              {session.annotations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-3">Your Thoughts During Session</h3>
                  <div className="space-y-2">
                    {session.annotations.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 cursor-pointer hover:bg-yellow-100"
                        onClick={() => onSeekToTime?.(ann.timestamp)}
                      >
                        <p className="text-xs text-yellow-600 mb-1">{formatTime(ann.timestamp)}</p>
                        <p className="text-sm text-yellow-800">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Extract phases from session events
 */
function getSessionPhases(session: ThinkingSession): Array<{ startTime: number; description: string }> {
  const phases: Array<{ startTime: number; description: string }> = [];
  const events = session.events;

  if (events.length === 0) return phases;

  phases.push({ startTime: 0, description: 'Session started' });

  // Group events into phases by type changes or time gaps
  let lastType = events[0].type;
  let lastTime = 0;
  let count = 0;

  for (const event of events) {
    const gap = event.timestamp - lastTime;

    if (gap > 120000 && count > 0) { // 2+ minute gap
      phases.push({
        startTime: lastTime,
        description: `${count} ${lastType.replace('-', ' ')} action${count > 1 ? 's' : ''}`,
      });
      phases.push({
        startTime: event.timestamp,
        description: 'Resumed after pause',
      });
      count = 0;
    }

    if (event.type !== lastType && count > 3) {
      phases.push({
        startTime: lastTime,
        description: `${count} ${lastType.replace('-', ' ')} action${count > 1 ? 's' : ''}`,
      });
      count = 0;
    }

    lastType = event.type;
    lastTime = event.timestamp;
    count++;
  }

  // Final phase
  if (count > 0) {
    phases.push({
      startTime: lastTime,
      description: `${count} ${lastType.replace('-', ' ')} action${count > 1 ? 's' : ''}`,
    });
  }

  phases.push({ startTime: session.durationMs, description: 'Session ended' });

  return phases.slice(0, 8); // Limit to 8 phases
}

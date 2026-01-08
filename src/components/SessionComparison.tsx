/**
 * Session Comparison Component
 *
 * Compare two thinking sessions to see how thinking evolved.
 */

import { useState, useEffect, useMemo } from 'react';
import type { ThinkingSession } from '../types/session';
import { getAllSessions } from '../services/sessionRecorder';
import {
  compareSessions,
  generateLearningInsights,
  findRelatedSessions,
  type SessionComparison as SessionComparisonType,
  type LearningInsights,
} from '../services/sessionComparison';
import { formatDuration } from '../services/sessionPlayback';

interface SessionComparisonProps {
  initialSession?: ThinkingSession;
  onClose: () => void;
}

export function SessionComparison({ initialSession, onClose }: SessionComparisonProps) {
  const [sessions, setSessions] = useState<ThinkingSession[]>([]);
  const [session1, setSession1] = useState<ThinkingSession | null>(initialSession || null);
  const [session2, setSession2] = useState<ThinkingSession | null>(null);
  const [comparison, setComparison] = useState<SessionComparisonType | null>(null);
  const [insights, setInsights] = useState<LearningInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'topics' | 'insights'>('overview');

  // Load sessions
  useEffect(() => {
    const allSessions = getAllSessions();
    setSessions(allSessions);

    // If initial session, suggest related sessions
    if (initialSession && allSessions.length > 1) {
      const related = findRelatedSessions(initialSession, allSessions);
      if (related.length > 0) {
        setSession2(related[0]);
      }
    }
  }, [initialSession]);

  // Generate comparison when both sessions are selected
  useEffect(() => {
    if (session1 && session2) {
      setIsLoading(true);
      const comp = compareSessions(session1, session2);
      setComparison(comp);

      // Generate insights asynchronously
      generateLearningInsights(comp).then((ins) => {
        setInsights(ins);
        setIsLoading(false);
      });
    } else {
      setComparison(null);
      setInsights(null);
    }
  }, [session1, session2]);

  // Filter out selected sessions from dropdowns
  const availableForSession1 = sessions.filter((s) => s.id !== session2?.id);
  const availableForSession2 = sessions.filter((s) => s.id !== session1?.id);

  // Related sessions suggestions
  const relatedSessions = useMemo(() => {
    if (!session1) return [];
    return findRelatedSessions(session1, sessions);
  }, [session1, sessions]);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const getAssessmentBadge = (assessment: LearningInsights['assessment']) => {
    const badges = {
      'significant-progress': { color: 'bg-green-100 text-green-800', label: 'Significant Progress' },
      'iterative-refinement': { color: 'bg-blue-100 text-blue-800', label: 'Iterative Refinement' },
      'exploratory': { color: 'bg-purple-100 text-purple-800', label: 'Exploratory' },
      'revisiting': { color: 'bg-amber-100 text-amber-800', label: 'Revisiting' },
    };
    return badges[assessment];
  };

  const getChangeIndicator = (change: number) => {
    if (change > 0) {
      return <span className="text-green-600">+{change}%</span>;
    } else if (change < 0) {
      return <span className="text-red-600">{change}%</span>;
    }
    return <span className="text-gray-400">0%</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-[1000px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-500 to-indigo-500">
          <div>
            <h2 className="text-xl font-semibold text-white">Compare Sessions</h2>
            <p className="text-sm text-white/80 mt-0.5">
              See how your thinking evolved between sessions
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Session Selection */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="grid grid-cols-2 gap-6">
            {/* Session 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Earlier Session
              </label>
              <select
                value={session1?.id || ''}
                onChange={(e) => setSession1(sessions.find((s) => s.id === e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select a session...</option>
                {availableForSession1.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || 'Untitled'} - {formatDate(s.startedAt)} ({formatDuration(s.durationMs)})
                  </option>
                ))}
              </select>
            </div>

            {/* Session 2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Later Session
                {relatedSessions.length > 0 && (
                  <span className="ml-2 text-xs text-blue-600">
                    {relatedSessions.length} related sessions available
                  </span>
                )}
              </label>
              <select
                value={session2?.id || ''}
                onChange={(e) => setSession2(sessions.find((s) => s.id === e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select a session...</option>
                {relatedSessions.length > 0 && (
                  <optgroup label="Related Sessions">
                    {relatedSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title || 'Untitled'} - {formatDate(s.startedAt)} ({formatDuration(s.durationMs)})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="All Sessions">
                  {availableForSession2.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || 'Untitled'} - {formatDate(s.startedAt)} ({formatDuration(s.durationMs)})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!comparison ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-lg font-medium">Select two sessions to compare</p>
                <p className="text-sm mt-1">Choose sessions that explore related topics</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="px-6 pt-4 border-b border-gray-100">
                <div className="flex gap-4">
                  {(['overview', 'timeline', 'topics', 'insights'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Assessment Badge */}
                    {insights && (
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getAssessmentBadge(insights.assessment).color}`}>
                          {getAssessmentBadge(insights.assessment).label}
                        </span>
                        <span className="text-sm text-gray-500">
                          {insights.summary}
                        </span>
                      </div>
                    )}

                    {/* Stats Comparison Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Notes Created</h4>
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="text-2xl font-bold text-gray-900">
                              {comparison.statsComparison.session1Stats.notesCreated}
                            </span>
                            <span className="text-gray-400 mx-2">→</span>
                            <span className="text-2xl font-bold text-gray-900">
                              {comparison.statsComparison.session2Stats.notesCreated}
                            </span>
                          </div>
                          <div className="text-sm font-medium">
                            {getChangeIndicator(comparison.statsComparison.changes.notesCreated)}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Connections Made</h4>
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="text-2xl font-bold text-gray-900">
                              {comparison.statsComparison.session1Stats.connectionsCreated}
                            </span>
                            <span className="text-gray-400 mx-2">→</span>
                            <span className="text-2xl font-bold text-gray-900">
                              {comparison.statsComparison.session2Stats.connectionsCreated}
                            </span>
                          </div>
                          <div className="text-sm font-medium">
                            {getChangeIndicator(comparison.statsComparison.changes.connectionsCreated)}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Duration</h4>
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="text-2xl font-bold text-gray-900">
                              {formatDuration(comparison.statsComparison.session1Stats.durationMs)}
                            </span>
                            <span className="text-gray-400 mx-2">→</span>
                            <span className="text-2xl font-bold text-gray-900">
                              {formatDuration(comparison.statsComparison.session2Stats.durationMs)}
                            </span>
                          </div>
                          <div className="text-sm font-medium">
                            {getChangeIndicator(comparison.statsComparison.changes.duration)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Note Overview */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="border border-gray-200 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-400" />
                          Common Notes
                        </h4>
                        <p className="text-3xl font-bold text-gray-900">{comparison.commonNotes.length}</p>
                        <p className="text-xs text-gray-500 mt-1">Worked on in both sessions</p>
                      </div>

                      <div className="border border-gray-200 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                          Set Aside
                        </h4>
                        <p className="text-3xl font-bold text-gray-900">{comparison.uniqueToSession1.length}</p>
                        <p className="text-xs text-gray-500 mt-1">Only in earlier session</p>
                      </div>

                      <div className="border border-gray-200 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          New Explorations
                        </h4>
                        <p className="text-3xl font-bold text-gray-900">{comparison.uniqueToSession2.length}</p>
                        <p className="text-xs text-gray-500 mt-1">Only in later session</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'timeline' && (
                  <div className="space-y-6">
                    <p className="text-sm text-gray-500">
                      Activity patterns across time segments (5-minute intervals)
                    </p>

                    {/* Timeline Visualization */}
                    <div className="space-y-4">
                      {/* Session 1 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          {session1?.title || 'Session 1'}
                        </h4>
                        <div className="flex gap-1">
                          {comparison.timelineComparison.session1Segments.map((segment, i) => (
                            <div
                              key={i}
                              className="flex-1 h-12 rounded flex items-center justify-center text-xs font-medium"
                              style={{
                                backgroundColor: getActivityColor(segment.dominantActivity, segment.eventCount),
                              }}
                              title={`${segment.dominantActivity} (${segment.eventCount} events)`}
                            >
                              {segment.eventCount > 0 && segment.eventCount}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Session 2 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          {session2?.title || 'Session 2'}
                        </h4>
                        <div className="flex gap-1">
                          {comparison.timelineComparison.session2Segments.map((segment, i) => (
                            <div
                              key={i}
                              className="flex-1 h-12 rounded flex items-center justify-center text-xs font-medium"
                              style={{
                                backgroundColor: getActivityColor(segment.dominantActivity, segment.eventCount),
                              }}
                              title={`${segment.dominantActivity} (${segment.eventCount} events)`}
                            >
                              {segment.eventCount > 0 && segment.eventCount}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10B981' }} />
                        <span>Creating</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3B82F6' }} />
                        <span>Editing</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }} />
                        <span>Organizing</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#8B5CF6' }} />
                        <span>Connecting</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-gray-200" />
                        <span>Idle</span>
                      </div>
                    </div>

                    {/* Patterns & Differences */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Common Patterns</h4>
                        <ul className="space-y-1 text-sm text-gray-600">
                          {comparison.timelineComparison.commonPatterns.length > 0 ? (
                            comparison.timelineComparison.commonPatterns.map((p, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                {formatPattern(p)}
                              </li>
                            ))
                          ) : (
                            <li className="text-gray-400">No common patterns detected</li>
                          )}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Key Differences</h4>
                        <ul className="space-y-1 text-sm text-gray-600">
                          {comparison.timelineComparison.differences.length > 0 ? (
                            comparison.timelineComparison.differences.map((d, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                {d}
                              </li>
                            ))
                          ) : (
                            <li className="text-gray-400">Sessions had similar patterns</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'topics' && (
                  <div className="space-y-6">
                    {/* Topic Evolution */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          New Topics in Session 2
                        </h4>
                        {comparison.topicEvolution.newTopics.length > 0 ? (
                          <ul className="space-y-1">
                            {comparison.topicEvolution.newTopics.map((t, i) => (
                              <li key={i} className="text-sm text-gray-600 bg-green-50 px-3 py-1.5 rounded">
                                {t}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-400">No new topics</p>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                          Topics Set Aside
                        </h4>
                        {comparison.topicEvolution.abandonedTopics.length > 0 ? (
                          <ul className="space-y-1">
                            {comparison.topicEvolution.abandonedTopics.map((t, i) => (
                              <li key={i} className="text-sm text-gray-600 bg-red-50 px-3 py-1.5 rounded">
                                {t}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-400">No topics set aside</p>
                        )}
                      </div>
                    </div>

                    {/* Depth Changes */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Topic Depth Changes</h4>
                      <div className="space-y-2">
                        {comparison.topicEvolution.expandedTopics
                          .filter((t) => t.change !== 'stable')
                          .slice(0, 10)
                          .map((topic, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg"
                            >
                              <div className="flex-1 text-sm text-gray-700 truncate">
                                {topic.topic}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400">{topic.session1Depth} interactions</span>
                                <span className={topic.change === 'expanded' ? 'text-green-600' : 'text-red-600'}>
                                  →
                                </span>
                                <span className="text-gray-400">{topic.session2Depth} interactions</span>
                                <span
                                  className={`px-2 py-0.5 rounded ${
                                    topic.change === 'expanded'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {topic.change}
                                </span>
                              </div>
                            </div>
                          ))}
                        {comparison.topicEvolution.expandedTopics.filter((t) => t.change !== 'stable').length === 0 && (
                          <p className="text-sm text-gray-400">Topic depth remained stable</p>
                        )}
                      </div>
                    </div>

                    {/* New Connections */}
                    {comparison.topicEvolution.newConnections.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          New Connections
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {comparison.topicEvolution.newConnections.map((conn, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-full text-sm">
                              <span className="text-purple-700">{conn.from}</span>
                              <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                              </svg>
                              <span className="text-purple-700">{conn.to}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'insights' && insights && (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
                      <p className="text-gray-800">{insights.summary}</p>
                    </div>

                    {/* Key Learnings */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        What You Learned
                      </h4>
                      <ul className="space-y-2">
                        {insights.keyLearnings.map((learning, i) => (
                          <li key={i} className="flex items-start gap-3 text-gray-700">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                            {learning}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Emergent Questions */}
                    {insights.emergentQuestions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Questions to Explore
                        </h4>
                        <ul className="space-y-2">
                          {insights.emergentQuestions.map((question, i) => (
                            <li key={i} className="flex items-start gap-3 text-gray-700 bg-amber-50 px-4 py-2 rounded-lg">
                              <span className="text-amber-500">?</span>
                              {question}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {insights.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Recommended Next Steps
                        </h4>
                        <ul className="space-y-2">
                          {insights.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-3 text-gray-700 bg-blue-50 px-4 py-2 rounded-lg">
                              <span className="mt-1 text-blue-500">→</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getActivityColor(activity: string, eventCount: number): string {
  const intensity = Math.min(eventCount / 20, 1);
  const colors: Record<string, string> = {
    creating: `rgba(16, 185, 129, ${0.2 + intensity * 0.6})`,
    editing: `rgba(59, 130, 246, ${0.2 + intensity * 0.6})`,
    organizing: `rgba(245, 158, 11, ${0.2 + intensity * 0.6})`,
    connecting: `rgba(139, 92, 246, ${0.2 + intensity * 0.6})`,
    idle: 'rgba(229, 231, 235, 0.5)',
  };
  return colors[activity] || colors.idle;
}

function formatPattern(pattern: string): string {
  const formats: Record<string, string> = {
    'starts-with-creation': 'Both sessions started with creating notes',
    'ends-with-organization': 'Both sessions ended with organizing',
    'editing-heavy': 'Both sessions focused on editing',
    'connection-building': 'Both sessions built note connections',
    'burst-activity': 'Both sessions had bursts of high activity',
  };
  return formats[pattern] || pattern;
}

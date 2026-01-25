/**
 * Graph Analytics Dashboard
 *
 * Shows analytics for a published knowledge graph including:
 * - View count over time chart
 * - Most-clicked nodes list
 * - Referrer breakdown
 */

import { useState, useEffect, useMemo } from 'react';
import {
  type GraphAnalytics as GraphAnalyticsType,
  type PublishedGraph,
  getGraphAnalytics,
} from '../services/graphPublishing';

interface GraphAnalyticsProps {
  graph: PublishedGraph;
  isOpen: boolean;
  onClose: () => void;
}

export function GraphAnalytics({ graph, isOpen, onClose }: GraphAnalyticsProps) {
  const [analytics, setAnalytics] = useState<GraphAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadAnalytics();
    }
  }, [isOpen, graph.id]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const data = await getGraphAnalytics(graph.id);
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
    setLoading(false);
  }

  // Calculate chart data from viewsByDay
  const chartData = useMemo(() => {
    if (!analytics?.viewsByDay || analytics.viewsByDay.length === 0) {
      return { labels: [], values: [], maxValue: 0 };
    }

    // Fill in missing days with zero views
    const sortedDays = [...analytics.viewsByDay].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Get last 14 days
    const today = new Date();
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);

    const filledData: { date: string; views: number }[] = [];
    const viewsMap = new Map(sortedDays.map((d) => [d.date, d.views]));

    for (let d = new Date(twoWeeksAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      filledData.push({
        date: dateStr,
        views: viewsMap.get(dateStr) || 0,
      });
    }

    const values = filledData.map((d) => d.views);
    const labels = filledData.map((d) =>
      new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    const maxValue = Math.max(...values, 1);

    return { labels, values, maxValue };
  }, [analytics]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Graph Analytics</h2>
              <p className="text-sm text-neutral-500 truncate max-w-md">{graph.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-secondary-600">{analytics.totalViews}</div>
                  <div className="text-sm text-secondary-600/70">Total Views</div>
                </div>
                <div className="bg-violet-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-violet-600">{analytics.uniqueVisitors}</div>
                  <div className="text-sm text-violet-600/70">Unique Visitors</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-secondary-600">
                    {analytics.mostClickedNodes.length}
                  </div>
                  <div className="text-sm text-secondary-600/70">Nodes Clicked</div>
                </div>
              </div>

              {/* Views Over Time Chart */}
              <div className="bg-neutral-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-neutral-700 mb-4">Views Over Time (Last 14 Days)</h3>
                <div className="h-40 flex items-end gap-1">
                  {chartData.values.length > 0 ? (
                    chartData.values.map((value, i) => (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center gap-1"
                        title={`${chartData.labels[i]}: ${value} views`}
                      >
                        <div
                          className="w-full bg-indigo-500 rounded-t transition-all hover:bg-secondary-600"
                          style={{
                            height: `${Math.max((value / chartData.maxValue) * 100, 2)}%`,
                            minHeight: value > 0 ? '4px' : '2px',
                          }}
                        />
                        <span className="text-[10px] text-neutral-400 -rotate-45 origin-left whitespace-nowrap">
                          {chartData.labels[i]}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Most Clicked Nodes */}
                <div className="bg-neutral-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-neutral-700 mb-3">Most Clicked Nodes</h3>
                  {analytics.mostClickedNodes.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.mostClickedNodes.slice(0, 5).map((node, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 bg-indigo-100 text-secondary-600 rounded text-xs flex items-center justify-center font-medium">
                              {i + 1}
                            </span>
                            <span className="text-neutral-700 truncate">{node.nodeTitle || 'Untitled'}</span>
                          </div>
                          <span className="text-neutral-400 ml-2">{node.clicks}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400 text-center py-4">No node clicks recorded</p>
                  )}
                </div>

                {/* Top Referrers */}
                <div className="bg-neutral-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-neutral-700 mb-3">Top Referrers</h3>
                  {analytics.topReferrers.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.topReferrers.slice(0, 5).map((ref, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 bg-violet-100 text-violet-600 rounded text-xs flex items-center justify-center font-medium">
                              {i + 1}
                            </span>
                            <span className="text-neutral-700 truncate">
                              {ref.referrer.replace(/^https?:\/\//, '')}
                            </span>
                          </div>
                          <span className="text-neutral-400 ml-2">{ref.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400 text-center py-4">No referrer data available</p>
                  )}
                </div>
              </div>

              {/* Graph Info */}
              <div className="bg-neutral-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-neutral-700 mb-3">Graph Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Published</span>
                    <span className="text-neutral-700">
                      {graph.publishedAt.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Last Updated</span>
                    <span className="text-neutral-700">
                      {graph.updatedAt.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Nodes</span>
                    <span className="text-neutral-700">{graph.nodeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Connections</span>
                    <span className="text-neutral-700">{graph.edgeCount}</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-neutral-500">Visibility</span>
                    <span className={graph.isPublic ? 'text-success-600' : 'text-neutral-700'}>
                      {graph.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-400">
              <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-sm">No analytics data available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

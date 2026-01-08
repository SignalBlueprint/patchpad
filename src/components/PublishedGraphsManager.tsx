/**
 * Published Graphs Manager
 *
 * UI component for viewing and managing published knowledge graphs.
 * Shows list of published graphs with analytics, edit, and unpublish options.
 */

import { useState, useEffect } from 'react';
import {
  type PublishedGraph,
  type GraphAnalytics,
  getUserGraphs,
  unpublishGraph,
  getGraphAnalytics,
  getGraphUrl,
} from '../services/graphPublishing';

interface PublishedGraphsManagerProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PublishedGraphsManager({ userId, isOpen, onClose }: PublishedGraphsManagerProps) {
  const [graphs, setGraphs] = useState<PublishedGraph[]>([]);
  const [selectedGraph, setSelectedGraph] = useState<PublishedGraph | null>(null);
  const [analytics, setAnalytics] = useState<GraphAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load published graphs
  useEffect(() => {
    if (isOpen && userId) {
      loadGraphs();
    }
  }, [isOpen, userId]);

  async function loadGraphs() {
    setLoading(true);
    try {
      const userGraphs = await getUserGraphs(userId);
      setGraphs(userGraphs);
    } catch (error) {
      console.error('Failed to load graphs:', error);
    }
    setLoading(false);
  }

  // Load analytics when graph is selected
  useEffect(() => {
    if (selectedGraph) {
      loadAnalytics(selectedGraph.id);
    } else {
      setAnalytics(null);
    }
  }, [selectedGraph]);

  async function loadAnalytics(graphId: string) {
    try {
      const graphAnalytics = await getGraphAnalytics(graphId);
      setAnalytics(graphAnalytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }

  async function handleUnpublish(graphId: string) {
    setDeleting(graphId);
    try {
      const result = await unpublishGraph(graphId, userId);
      if (result.success) {
        setGraphs(graphs.filter(g => g.id !== graphId));
        if (selectedGraph?.id === graphId) {
          setSelectedGraph(null);
        }
      }
    } catch (error) {
      console.error('Failed to unpublish graph:', error);
    }
    setDeleting(null);
  }

  function handleCopyUrl(graph: PublishedGraph) {
    const url = getGraphUrl(graph);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(graph.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Published Graphs</h2>
              <p className="text-sm text-gray-500">
                {graphs.length} graph{graphs.length !== 1 ? 's' : ''} published
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Graph List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
              </div>
            ) : graphs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm font-medium">No published graphs yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Use "Publish Graph" in the Knowledge Brain to publish
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {graphs.map(graph => (
                  <button
                    key={graph.id}
                    onClick={() => setSelectedGraph(graph)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedGraph?.id === graph.id ? 'bg-violet-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{graph.title}</h3>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {graph.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            {graph.nodeCount} nodes
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {graph.viewCount} views
                          </span>
                          <span>{formatDate(graph.publishedAt)}</span>
                        </div>
                      </div>
                      {!graph.isPublic && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          Private
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Panel */}
          <div className="w-1/2 overflow-y-auto bg-gray-50 p-6">
            {selectedGraph ? (
              <div className="space-y-6">
                {/* Graph Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedGraph.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedGraph.description || 'No description provided'}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyUrl(selectedGraph)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    {copiedId === selectedGraph.id ? 'Copied!' : 'Copy URL'}
                  </button>
                  <a
                    href={getGraphUrl(selectedGraph)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 rounded-lg text-sm text-white hover:bg-violet-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open Graph
                  </a>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-violet-600">{selectedGraph.nodeCount}</div>
                    <div className="text-xs text-gray-500">Nodes</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">{selectedGraph.edgeCount}</div>
                    <div className="text-xs text-gray-500">Edges</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-indigo-600">{selectedGraph.viewCount}</div>
                    <div className="text-xs text-gray-500">Views</div>
                  </div>
                </div>

                {/* Analytics */}
                {analytics && (
                  <div className="bg-white rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Analytics</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Unique Visitors</span>
                        <span className="font-medium text-gray-900">{analytics.uniqueVisitors}</span>
                      </div>
                      {analytics.topReferrers.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-2">Top Referrers</div>
                          {analytics.topReferrers.slice(0, 3).map((ref, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-gray-600 truncate flex-1 mr-2">{ref.referrer}</span>
                              <span className="text-gray-400">{ref.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {analytics.mostClickedNodes.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-2">Most Clicked Nodes</div>
                          {analytics.mostClickedNodes.slice(0, 3).map((node, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-gray-600 truncate flex-1 mr-2">{node.nodeTitle}</span>
                              <span className="text-gray-400">{node.clicks}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {selectedGraph.tags.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedGraph.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs bg-violet-100 text-violet-700 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-xs text-gray-400 space-y-1">
                  <div>Published: {formatDate(selectedGraph.publishedAt)}</div>
                  <div>Last updated: {formatDate(selectedGraph.updatedAt)}</div>
                  <div>Slug: /{selectedGraph.slug}</div>
                </div>

                {/* Danger Zone */}
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleUnpublish(selectedGraph.id)}
                    disabled={deleting === selectedGraph.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {deleting === selectedGraph.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                        Unpublishing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Unpublish Graph
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p className="text-sm">Select a graph to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

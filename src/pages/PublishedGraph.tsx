/**
 * Published Graph Page
 *
 * Displays a published knowledge graph.
 * Accessed via /graphs/:userIdPrefix/:slug URL.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getGraphBySlug, type PublishedGraph as PublishedGraphType } from '../services/graphPublishing';
import { getSupabase } from '../config/supabase';

/**
 * Track analytics event for a published graph
 */
async function trackAnalyticsEvent(
  graphId: string,
  eventType: 'view' | 'node-click',
  nodeId?: string,
  nodeTitle?: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return; // Skip if Supabase not configured

  try {
    // Generate a simple visitor ID from localStorage
    let visitorId = localStorage.getItem('patchpad_visitor_id');
    if (!visitorId) {
      visitorId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('patchpad_visitor_id', visitorId);
    }

    await supabase.from('graph_analytics').insert({
      graph_id: graphId,
      visitor_id: visitorId,
      referrer: document.referrer || 'direct',
      clicked_node_id: eventType === 'node-click' ? nodeId : null,
      clicked_node_title: eventType === 'node-click' ? nodeTitle : null,
      viewed_at: new Date().toISOString(),
    });
  } catch (error) {
    // Silently fail - analytics shouldn't break the page
    console.debug('Analytics tracking failed:', error);
  }
}

interface PublishedGraphProps {
  userIdPrefix: string;
  slug: string;
}

export function PublishedGraph({ userIdPrefix, slug }: PublishedGraphProps) {
  const [graph, setGraph] = useState<PublishedGraphType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsTracked, setAnalyticsTracked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    loadGraph();
  }, [userIdPrefix, slug]);

  async function loadGraph() {
    setLoading(true);
    setError(null);
    setAnalyticsTracked(false);
    try {
      const publishedGraph = await getGraphBySlug(userIdPrefix, slug);
      if (publishedGraph) {
        setGraph(publishedGraph);
      } else {
        setError('Graph not found or no longer public');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }

  // Track page view analytics once when graph loads
  useEffect(() => {
    if (graph && !analyticsTracked) {
      trackAnalyticsEvent(graph.id, 'view');
      setAnalyticsTracked(true);
    }
  }, [graph, analyticsTracked]);

  // Handle node click messages from iframe
  const handleNodeClick = useCallback(
    (nodeId: string, nodeTitle: string) => {
      if (graph) {
        trackAnalyticsEvent(graph.id, 'node-click', nodeId, nodeTitle);
      }
    },
    [graph]
  );

  // Listen for messages from iframe (for node click tracking)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'patchpad-node-click') {
        handleNodeClick(event.data.nodeId, event.data.nodeTitle);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleNodeClick]);

  // Inject HTML content into iframe with analytics tracking code
  useEffect(() => {
    if (graph && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        // Inject analytics tracking into the graph HTML
        const analyticsScript = `
          <script>
            // Override showPanel to track node clicks
            const _originalShowPanel = typeof showPanel === 'function' ? showPanel : null;
            if (_originalShowPanel) {
              window.showPanel = function(node) {
                _originalShowPanel(node);
                // Send message to parent for analytics
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({
                    type: 'patchpad-node-click',
                    nodeId: node.id,
                    nodeTitle: node.title
                  }, '*');
                }
              };
            }
          </script>
        `;

        // Insert analytics script before closing body tag
        let htmlContent = graph.htmlContent;
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', analyticsScript + '</body>');
        } else {
          htmlContent += analyticsScript;
        }

        doc.open();
        doc.write(htmlContent);
        doc.close();
      }
    }
  }, [graph]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-12 h-12 animate-spin text-violet-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-400">Loading knowledge graph...</p>
        </div>
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-900/50 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Graph Not Found</h1>
          <p className="text-gray-400 mb-6">
            {error || 'This graph may have been unpublished or the link is incorrect.'}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to PatchPad
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-semibold text-white">{graph.title}</h1>
                {graph.description && (
                  <p className="text-xs text-gray-400 truncate max-w-md">{graph.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {graph.nodeCount} nodes
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {graph.edgeCount} edges
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {graph.viewCount} views
                </span>
              </div>
              <a
                href="/"
                className="px-4 py-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 border border-violet-500/50 rounded-lg hover:bg-violet-500/10 transition-colors"
              >
                Open in PatchPad
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Graph View */}
      <main className="flex-1 relative">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          title={graph.title}
          sandbox="allow-scripts allow-same-origin"
        />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800/50 border-t border-gray-700/50 py-3">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Published {graph.publishedAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <div className="flex items-center gap-2">
              {graph.tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-gray-700/50 text-gray-400 rounded-full"
                >
                  {tag}
                </span>
              ))}
              <span className="text-gray-600">|</span>
              <span>Created with PatchPad</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

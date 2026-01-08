/**
 * Publish Graph Dialog
 *
 * Allows users to export their knowledge graph as a self-contained HTML file.
 * Provides options for theme, content level, and tag filtering.
 */

import { useState, useMemo } from 'react';
import type { Note } from '../types/note';
import {
  type GraphExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  generateGraphData,
  downloadGraphHTML,
  generateEmbedCode,
  generateGraphHTML,
} from '../services/graphExport';
import { publishGraph, getGraphUrl } from '../services/graphPublishing';
import type { PublishedGraph } from '../services/graphPublishing';

interface PublishGraphDialogProps {
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

type PublishMode = 'download' | 'publish';

export function PublishGraphDialog({ notes, isOpen, onClose, userId }: PublishGraphDialogProps) {
  const [mode, setMode] = useState<PublishMode>('download');
  const [options, setOptions] = useState<GraphExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [copied, setCopied] = useState(false);

  // Publish state
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishSlug, setPublishSlug] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedGraph, setPublishedGraph] = useState<PublishedGraph | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Get all unique tags from notes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(note => note.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [notes]);

  // Preview graph data
  const previewData = useMemo(() => {
    return generateGraphData(notes, options);
  }, [notes, options]);

  // Handle tag selection
  function toggleTag(tag: string) {
    setOptions(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter(t => t !== tag)
        : [...prev.selectedTags, tag],
    }));
  }

  // Handle download
  function handleDownload() {
    downloadGraphHTML(notes, options);
  }

  // Handle copy embed code
  function handleCopyEmbed() {
    const embedCode = generateEmbedCode();
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Handle publish to web
  async function handlePublish() {
    if (!userId) {
      setPublishError('Please sign in to publish graphs');
      return;
    }

    if (!publishTitle.trim()) {
      setPublishError('Please enter a title');
      return;
    }

    setIsPublishing(true);
    setPublishError(null);

    try {
      const htmlContent = generateGraphHTML(notes, options);
      const result = await publishGraph(userId, {
        title: publishTitle.trim(),
        description: publishDescription.trim(),
        htmlContent,
        slug: publishSlug.trim() || undefined,
        tags: options.selectedTags,
        nodeCount: previewData.nodes.length,
        edgeCount: previewData.edges.length,
      });

      if (result.success && result.graph) {
        setPublishedGraph(result.graph);
      } else {
        setPublishError(result.error || 'Failed to publish graph');
      }
    } catch (error) {
      setPublishError('An unexpected error occurred');
      console.error('Publish error:', error);
    }

    setIsPublishing(false);
  }

  // Copy published URL
  function handleCopyPublishedUrl() {
    if (publishedGraph) {
      const url = getGraphUrl(publishedGraph);
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  // Reset publish state when closing
  function handleClose() {
    setPublishedGraph(null);
    setPublishError(null);
    setPublishTitle('');
    setPublishDescription('');
    setPublishSlug('');
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Publish Knowledge Graph</h2>
                <p className="text-sm text-gray-500">Share your knowledge visualization</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('download')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === 'download'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download HTML
              </div>
            </button>
            <button
              onClick={() => setMode('publish')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === 'publish'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Publish to Web
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Published Success State */}
          {publishedGraph ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Graph Published!</h3>
              <p className="text-sm text-gray-600 mb-4">Your knowledge graph is now live at:</p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <code className="text-sm text-emerald-600 break-all">{getGraphUrl(publishedGraph)}</code>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleCopyPublishedUrl}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  {copied ? 'Copied!' : 'Copy URL'}
                </button>
                <a
                  href={getGraphUrl(publishedGraph)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 rounded-lg text-sm text-white hover:bg-emerald-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Graph
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Preview Stats */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">{previewData.nodes.length}</div>
                      <div className="text-xs text-gray-500">Notes</div>
                    </div>
                    <div className="w-px h-10 bg-gray-200" />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-teal-600">{previewData.edges.length}</div>
                      <div className="text-xs text-gray-500">Connections</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Estimated file size: ~{Math.round(20 + previewData.nodes.length * 0.5)}KB
                  </div>
                </div>
              </div>

              {/* Publish Form (only in publish mode) */}
              {mode === 'publish' && (
                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                    <input
                      type="text"
                      value={publishTitle}
                      onChange={(e) => setPublishTitle(e.target.value)}
                      placeholder="My Knowledge Graph"
                      className="w-full py-2 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={publishDescription}
                      onChange={(e) => setPublishDescription(e.target.value)}
                      placeholder="A brief description of your knowledge graph..."
                      rows={2}
                      className="w-full py-2 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custom Slug (optional)</label>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-400 mr-1">/graphs/.../</span>
                      <input
                        type="text"
                        value={publishSlug}
                        onChange={(e) => setPublishSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        placeholder="my-graph"
                        className="flex-1 py-2 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Leave empty to auto-generate from title</p>
                  </div>
                  {publishError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                      {publishError}
                    </div>
                  )}
                </div>
              )}

              {/* Options Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Theme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setOptions(prev => ({ ...prev, theme: 'light' }))}
                  className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    options.theme === 'light'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setOptions(prev => ({ ...prev, theme: 'dark' }))}
                  className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    options.theme === 'dark'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            {/* Content Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content Level</label>
              <select
                value={options.includeContent}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  includeContent: e.target.value as 'full' | 'excerpts' | 'titles-only'
                }))}
                className="w-full py-2 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="titles-only">Titles only</option>
                <option value="excerpts">Excerpts (200 chars)</option>
                <option value="full">Full content (500 chars)</option>
              </select>
            </div>

            {/* Node Limit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Node Limit: {options.nodeLimit}
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={options.nodeLimit}
                onChange={(e) => setOptions(prev => ({ ...prev, nodeLimit: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>10</span>
                <span>200</span>
              </div>
            </div>

            {/* Tag Filter Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tag Filter ({options.selectedTags.length > 0 ? options.selectedTags.length : 'All'})
              </label>
              <p className="text-xs text-gray-500">
                {options.selectedTags.length > 0
                  ? 'Only notes with selected tags will be included'
                  : 'All notes included (no filter)'}
              </p>
            </div>
          </div>

          {/* Tag Selection */}
          {allTags.length > 0 && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Tags</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      options.selectedTags.includes(tag)
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {options.selectedTags.length > 0 && (
                <button
                  onClick={() => setOptions(prev => ({ ...prev, selectedTags: [] }))}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer - hidden when graph is published */}
        {!publishedGraph && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            {mode === 'download' ? (
              <button
                onClick={handleCopyEmbed}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? 'Copied!' : 'Copy embed code'}
              </button>
            ) : (
              <div className="text-xs text-gray-500">
                {!userId && 'Sign in to publish graphs to the web'}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {mode === 'download' ? (
                <button
                  onClick={handleDownload}
                  disabled={previewData.nodes.length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download HTML
                </button>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={isPublishing || previewData.nodes.length === 0 || !publishTitle.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isPublishing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Publish to Web
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

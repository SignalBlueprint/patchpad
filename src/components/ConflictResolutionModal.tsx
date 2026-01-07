/**
 * Conflict Resolution Modal
 *
 * Displays when the same note has been modified on multiple devices
 * and allows the user to choose which version to keep.
 */

import { useState, useCallback } from 'react';
import type { SyncConflict, ConflictResolution } from '../services/sync';

interface ConflictResolutionModalProps {
  conflict: SyncConflict;
  onResolve: (resolution: ConflictResolution) => void;
  onClose: () => void;
}

export function ConflictResolutionModal({ conflict, onResolve, onClose }: ConflictResolutionModalProps) {
  const [showDiff, setShowDiff] = useState(true);

  const handleResolve = useCallback((resolution: ConflictResolution) => {
    onResolve(resolution);
    onClose();
  }, [onResolve, onClose]);

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Simple word-based diff highlighting
  const getHighlightedContent = (localContent: string, remoteContent: string) => {
    const localWords = localContent.split(/(\s+)/);
    const remoteWords = remoteContent.split(/(\s+)/);

    const localSet = new Set(localWords);
    const remoteSet = new Set(remoteWords);

    const highlightLocal = localWords.map((word, i) => {
      const isWhitespace = /^\s+$/.test(word);
      const inRemote = remoteSet.has(word);
      return (
        <span
          key={i}
          className={!isWhitespace && !inRemote ? 'bg-green-200' : ''}
        >
          {word}
        </span>
      );
    });

    const highlightRemote = remoteWords.map((word, i) => {
      const isWhitespace = /^\s+$/.test(word);
      const inLocal = localSet.has(word);
      return (
        <span
          key={i}
          className={!isWhitespace && !inLocal ? 'bg-blue-200' : ''}
        >
          {word}
        </span>
      );
    });

    return { highlightLocal, highlightRemote };
  };

  const { highlightLocal, highlightRemote } = showDiff
    ? getHighlightedContent(conflict.localNote.content, conflict.remoteNote.content)
    : { highlightLocal: conflict.localNote.content, highlightRemote: conflict.remoteNote.content };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-full">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Sync Conflict Detected</h2>
              <p className="text-sm text-gray-600">
                "{conflict.localNote.title}" was modified on multiple devices
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Toggle diff highlighting */}
          <div className="mb-4 flex items-center justify-end">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showDiff}
                onChange={(e) => setShowDiff(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Highlight differences
            </label>
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Local version */}
            <div className="border border-green-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-green-50 border-b border-green-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-green-800">This Device</h3>
                  <span className="text-xs text-green-600">
                    {formatDate(conflict.localUpdatedAt)}
                  </span>
                </div>
              </div>
              <div className="p-4 max-h-60 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                  {showDiff ? highlightLocal : conflict.localNote.content}
                </pre>
              </div>
              {conflict.localNote.tags.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                  <div className="flex flex-wrap gap-1">
                    {conflict.localNote.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Remote version */}
            <div className="border border-blue-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-blue-800">Cloud Version</h3>
                  <span className="text-xs text-blue-600">
                    {formatDate(conflict.remoteUpdatedAt)}
                  </span>
                </div>
              </div>
              <div className="p-4 max-h-60 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                  {showDiff ? highlightRemote : conflict.remoteNote.content}
                </pre>
              </div>
              {conflict.remoteNote.tags.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                  <div className="flex flex-wrap gap-1">
                    {conflict.remoteNote.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Choose which version to keep, or keep both as separate notes
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleResolve('keep_both')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Keep Both
              </button>
              <button
                onClick={() => handleResolve('keep_remote')}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Keep Cloud
              </button>
              <button
                onClick={() => handleResolve('keep_local')}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                Keep Local
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Collaborative Annotations Component
 *
 * UI for viewing and creating annotations on sessions.
 * Shows annotations color-coded by contributor with reply threads.
 */

import { useState, useEffect, useRef } from 'react';
import {
  type CollaborativeAnnotation,
  type AnnotationAuthor,
  type AnnotationFilter,
  getAnnotations,
  addAnnotation,
  addReply,
  toggleResolved,
  deleteAnnotation,
  registerAuthor,
  getAnnotationStats,
} from '../services/collaborativeAnnotations';

interface CollaborativeAnnotationsProps {
  sessionId: string;
  currentTimestamp: number;
  currentAuthor: AnnotationAuthor;
  onSeekToTimestamp?: (timestamp: number) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function CollaborativeAnnotations({
  sessionId,
  currentTimestamp,
  currentAuthor,
  onSeekToTimestamp,
  isExpanded = true,
  onToggleExpand,
}: CollaborativeAnnotationsProps) {
  const [annotations, setAnnotations] = useState<CollaborativeAnnotation[]>([]);
  const [filter, setFilter] = useState<AnnotationFilter>({});
  const [newAnnotation, setNewAnnotation] = useState('');
  const [annotationType, setAnnotationType] = useState<'note' | 'highlight'>('note');
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);

  // Load annotations
  useEffect(() => {
    loadAnnotations();
  }, [sessionId, filter]);

  // Register current author
  useEffect(() => {
    registerAuthor(currentAuthor.id, currentAuthor.name);
  }, [currentAuthor]);

  async function loadAnnotations() {
    setLoading(true);
    const data = await getAnnotations(sessionId, filter);
    setAnnotations(data);
    setLoading(false);
  }

  // Handle add annotation
  async function handleAddAnnotation() {
    if (!newAnnotation.trim()) return;

    await addAnnotation(
      sessionId,
      {
        timestamp: currentTimestamp,
        type: annotationType,
        content: newAnnotation.trim(),
      },
      currentAuthor
    );

    setNewAnnotation('');
    loadAnnotations();
  }

  // Handle add reply
  async function handleAddReply(annotationId: string) {
    if (!replyText.trim()) return;

    await addReply(sessionId, annotationId, replyText.trim(), currentAuthor);
    setReplyText('');
    setSelectedAnnotation(null);
    loadAnnotations();
  }

  // Handle toggle resolved
  async function handleToggleResolved(annotationId: string) {
    await toggleResolved(sessionId, annotationId);
    loadAnnotations();
  }

  // Handle delete
  async function handleDelete(annotationId: string) {
    if (confirm('Delete this annotation?')) {
      await deleteAnnotation(sessionId, annotationId);
      loadAnnotations();
    }
  }

  // Format timestamp
  function formatTimestamp(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  // Get stats
  const stats = getAnnotationStats(sessionId);

  if (!isExpanded) {
    return (
      <button
        onClick={onToggleExpand}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <span className="text-sm">{stats.total} Annotations</span>
        {stats.unresolved > 0 && (
          <span className="px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
            {stats.unresolved}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Annotations</h3>
          <span className="text-xs text-neutral-400">({stats.total})</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter buttons */}
          <button
            onClick={() => setFilter(f => ({ ...f, resolved: f.resolved === false ? undefined : false }))}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filter.resolved === false
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-neutral-400 hover:text-white'
            }`}
          >
            Unresolved ({stats.unresolved})
          </button>
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1 text-neutral-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Annotation list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
          </div>
        ) : annotations.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-sm">
            No annotations yet. Add one below!
          </div>
        ) : (
          annotations.map((annotation) => (
            <div
              key={annotation.id}
              className={`p-3 rounded-lg border transition-colors ${
                annotation.isResolved
                  ? 'bg-gray-800/50 border-gray-700/50 opacity-60'
                  : 'bg-gray-700/50 border-gray-600'
              }`}
            >
              {/* Annotation header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: annotation.authorColor }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: annotation.authorColor }}
                  >
                    {annotation.authorName}
                  </span>
                  <button
                    onClick={() => onSeekToTimestamp?.(annotation.timestamp)}
                    className="text-xs text-neutral-500 hover:text-indigo-400 transition-colors"
                  >
                    @{formatTimestamp(annotation.timestamp)}
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {annotation.type === 'highlight' && (
                    <span className="px-1.5 py-0.5 bg-accent-500/20 text-yellow-400 text-xs rounded">
                      highlight
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleResolved(annotation.id)}
                    className={`p-1 rounded transition-colors ${
                      annotation.isResolved
                        ? 'text-green-400 hover:text-green-300'
                        : 'text-neutral-500 hover:text-green-400'
                    }`}
                    title={annotation.isResolved ? 'Mark unresolved' : 'Mark resolved'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  {annotation.authorId === currentAuthor.id && (
                    <button
                      onClick={() => handleDelete(annotation.id)}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Annotation content */}
              <p className="text-sm text-gray-300 mt-2">{annotation.content}</p>

              {/* Replies */}
              {annotation.replies.length > 0 && (
                <div className="mt-3 pl-4 border-l-2 border-gray-600 space-y-2">
                  {annotation.replies.map((reply) => (
                    <div key={reply.id} className="text-xs">
                      <span
                        className="font-medium"
                        style={{ color: reply.authorColor }}
                      >
                        {reply.authorName}
                      </span>
                      <span className="text-neutral-400 ml-2">{reply.content}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply input */}
              {selectedAnnotation === annotation.id ? (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-xs text-white placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddReply(annotation.id)}
                    autoFocus
                  />
                  <button
                    onClick={() => handleAddReply(annotation.id)}
                    disabled={!replyText.trim()}
                    className="px-2 py-1 bg-secondary-600 text-white text-xs rounded hover:bg-secondary-700 transition-colors disabled:opacity-50"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => setSelectedAnnotation(null)}
                    className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded hover:bg-neutral-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedAnnotation(annotation.id)}
                  className="mt-2 text-xs text-neutral-500 hover:text-indigo-400 transition-colors"
                >
                  Reply
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add annotation form */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setAnnotationType('note')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              annotationType === 'note'
                ? 'bg-secondary-600 text-white'
                : 'bg-gray-700 text-neutral-400 hover:text-white'
            }`}
          >
            Note
          </button>
          <button
            onClick={() => setAnnotationType('highlight')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              annotationType === 'highlight'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-neutral-400 hover:text-white'
            }`}
          >
            Highlight
          </button>
          <span className="text-xs text-neutral-500 ml-auto">
            @{formatTimestamp(currentTimestamp)}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newAnnotation}
            onChange={(e) => setNewAnnotation(e.target.value)}
            placeholder="Add an annotation..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleAddAnnotation()}
          />
          <button
            onClick={handleAddAnnotation}
            disabled={!newAnnotation.trim()}
            className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: currentAuthor.color }}
          />
          <span className="text-xs text-neutral-400">
            Annotating as <span style={{ color: currentAuthor.color }}>{currentAuthor.name}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

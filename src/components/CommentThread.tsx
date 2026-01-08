/**
 * Comment Thread Component
 *
 * Displays a comment thread with the original selected text, comments, and reply input.
 */

import { useState } from 'react';
import type { CommentThread as CommentThreadType, Comment } from '../types/comment';

interface CommentThreadProps {
  thread: CommentThreadType;
  currentUserId?: string;
  onReply: (parentId: string, content: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onResolve: (commentId: string, resolved: boolean) => void;
  onClickSelectedText?: () => void;
}

export function CommentThread({
  thread,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onClickSelectedText,
}: CommentThreadProps) {
  const [isExpanded, setIsExpanded] = useState(!thread.isCollapsed);
  const [replyContent, setReplyContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const { comment, replies } = thread;
  const totalReplies = replies.length;

  const handleReply = () => {
    if (!replyContent.trim()) return;
    onReply(comment.id, replyContent.trim());
    setReplyContent('');
  };

  const handleEdit = (commentId: string) => {
    if (!editContent.trim()) return;
    onEdit(commentId, editContent.trim());
    setEditingId(null);
    setEditContent('');
  };

  const startEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditContent(c.content);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        comment.resolved
          ? 'border-gray-200 bg-gray-50 opacity-75'
          : 'border-amber-200 bg-white shadow-sm'
      }`}
    >
      {/* Header with selected text */}
      <div
        className="px-3 py-2 bg-amber-50 border-b border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
        onClick={onClickSelectedText}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-amber-600 font-medium">Selected text</span>
          <div className="flex items-center gap-2">
            {comment.resolved && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Resolved
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-700 italic line-clamp-2 mt-1">
          "{comment.selectedText}"
        </p>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-3">
          {/* Root comment */}
          <CommentItem
            comment={comment}
            isOwner={comment.userId === currentUserId}
            isEditing={editingId === comment.id}
            editContent={editContent}
            onEditContentChange={setEditContent}
            onStartEdit={() => startEdit(comment)}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={() => handleEdit(comment.id)}
            onDelete={() => onDelete(comment.id)}
            formatDate={formatDate}
          />

          {/* Resolve button */}
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => onResolve(comment.id, !comment.resolved)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                comment.resolved
                  ? 'text-amber-600 hover:bg-amber-50'
                  : 'text-green-600 hover:bg-green-50'
              }`}
            >
              {comment.resolved ? 'Reopen' : 'Resolve'}
            </button>
          </div>

          {/* Replies */}
          {totalReplies > 0 && (
            <div className="mt-3 pl-4 border-l-2 border-gray-100 space-y-3">
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  isOwner={reply.userId === currentUserId}
                  isEditing={editingId === reply.id}
                  editContent={editContent}
                  onEditContentChange={setEditContent}
                  onStartEdit={() => startEdit(reply)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={() => handleEdit(reply.id)}
                  onDelete={() => onDelete(reply.id)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}

          {/* Reply input */}
          {!comment.resolved && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              <button
                onClick={handleReply}
                disabled={!replyContent.trim()}
                className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Reply
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collapsed summary */}
      {!isExpanded && totalReplies > 0 && (
        <div className="px-3 py-2 text-xs text-gray-500">
          {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
        </div>
      )}
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  isOwner: boolean;
  isEditing: boolean;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  formatDate: (date: Date) => string;
}

function CommentItem({
  comment,
  isOwner,
  isEditing,
  editContent,
  onEditContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  formatDate,
}: CommentItemProps) {
  return (
    <div className="group">
      {/* Author and time */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
          style={{ backgroundColor: comment.userColor }}
        >
          {comment.userName.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-700">{comment.userName}</span>
        <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
        {comment.updatedAt.getTime() !== comment.createdAt.getTime() && (
          <span className="text-xs text-gray-400">(edited)</span>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="ml-8 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none"
            rows={2}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={onSaveEdit}
              className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="ml-8 flex items-start justify-between">
          <p className="text-sm text-gray-600">{comment.content}</p>
          {isOwner && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={onStartEdit}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Edit"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={onDelete}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CommentsSidebarProps {
  threads: CommentThreadType[];
  currentUserId?: string;
  onReply: (parentId: string, content: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onResolve: (commentId: string, resolved: boolean) => void;
  onScrollToComment?: (fromPos: number, toPos: number) => void;
  showResolved?: boolean;
  onToggleShowResolved?: () => void;
}

/**
 * Sidebar component that displays all comment threads for a note
 */
export function CommentsSidebar({
  threads,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onScrollToComment,
  showResolved = true,
  onToggleShowResolved,
}: CommentsSidebarProps) {
  const filteredThreads = showResolved
    ? threads
    : threads.filter((t) => !t.comment.resolved);

  const resolvedCount = threads.filter((t) => t.comment.resolved).length;
  const activeCount = threads.length - resolvedCount;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Comments</h3>
          <span className="text-xs text-gray-500">
            {activeCount} active{resolvedCount > 0 && `, ${resolvedCount} resolved`}
          </span>
        </div>
        {resolvedCount > 0 && onToggleShowResolved && (
          <button
            onClick={onToggleShowResolved}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700"
          >
            {showResolved ? 'Hide resolved' : 'Show resolved'}
          </button>
        )}
      </div>

      {/* Threads list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredThreads.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-sm">No comments yet</p>
            <p className="text-xs mt-1">Select text to add a comment</p>
          </div>
        ) : (
          filteredThreads.map((thread) => (
            <CommentThread
              key={thread.comment.id}
              thread={thread}
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onResolve={onResolve}
              onClickSelectedText={() =>
                onScrollToComment?.(thread.comment.fromPos, thread.comment.toPos)
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

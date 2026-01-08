/**
 * Comments Service
 *
 * Manages inline comments anchored to text positions in notes.
 * Comments are stored locally in localStorage and optionally synced to Supabase.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Comment, CommentThread, CommentDraft } from '../types/comment';
import { getSupabase } from '../config/supabase';

const COMMENTS_STORAGE_KEY = 'patchpad_comments';

// In-memory cache
let commentsCache: Comment[] | null = null;

/**
 * Get all comments from storage
 */
export function getAllComments(): Comment[] {
  if (commentsCache) {
    return commentsCache;
  }

  try {
    const stored = localStorage.getItem(COMMENTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      commentsCache = parsed.map((c: Record<string, unknown>) => ({
        ...c,
        createdAt: new Date(c.createdAt as string),
        updatedAt: new Date(c.updatedAt as string),
      }));
      return commentsCache!;
    }
  } catch (error) {
    console.error('Failed to load comments:', error);
  }

  commentsCache = [];
  return commentsCache;
}

/**
 * Save comments to storage
 */
function saveComments(comments: Comment[]): void {
  commentsCache = comments;
  try {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments));
  } catch (error) {
    console.error('Failed to save comments:', error);
  }
}

/**
 * Get comments for a specific note
 */
export function getCommentsForNote(noteId: string): Comment[] {
  return getAllComments().filter((c) => c.noteId === noteId);
}

/**
 * Get comment threads for a note (groups comments with their replies)
 */
export function getCommentThreadsForNote(noteId: string): CommentThread[] {
  const noteComments = getCommentsForNote(noteId);

  // Separate root comments and replies
  const rootComments = noteComments.filter((c) => !c.parentId);
  const replyMap = new Map<string, Comment[]>();

  noteComments
    .filter((c) => c.parentId)
    .forEach((reply) => {
      const existing = replyMap.get(reply.parentId!) || [];
      existing.push(reply);
      replyMap.set(reply.parentId!, existing);
    });

  // Build threads
  const threads: CommentThread[] = rootComments.map((comment) => ({
    comment,
    replies: (replyMap.get(comment.id) || []).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    ),
  }));

  // Sort threads by position in document
  return threads.sort((a, b) => a.comment.fromPos - b.comment.fromPos);
}

/**
 * Create a new comment
 */
export function createComment(
  draft: CommentDraft,
  userId: string,
  userName: string,
  userColor: string
): Comment {
  const now = new Date();
  const comment: Comment = {
    id: uuidv4(),
    noteId: draft.noteId,
    userId,
    userName,
    userColor,
    fromPos: draft.fromPos,
    toPos: draft.toPos,
    selectedText: draft.selectedText,
    content: draft.content,
    parentId: draft.parentId,
    resolved: false,
    createdAt: now,
    updatedAt: now,
  };

  const comments = getAllComments();
  comments.push(comment);
  saveComments(comments);

  // Sync to Supabase if available
  syncCommentToCloud(comment, 'create');

  return comment;
}

/**
 * Update a comment's content
 */
export function updateComment(commentId: string, content: string): Comment | null {
  const comments = getAllComments();
  const index = comments.findIndex((c) => c.id === commentId);

  if (index === -1) {
    return null;
  }

  comments[index] = {
    ...comments[index],
    content,
    updatedAt: new Date(),
  };

  saveComments(comments);
  syncCommentToCloud(comments[index], 'update');

  return comments[index];
}

/**
 * Resolve or unresolve a comment thread
 */
export function resolveComment(commentId: string, resolved: boolean): Comment | null {
  const comments = getAllComments();
  const index = comments.findIndex((c) => c.id === commentId);

  if (index === -1) {
    return null;
  }

  comments[index] = {
    ...comments[index],
    resolved,
    updatedAt: new Date(),
  };

  saveComments(comments);
  syncCommentToCloud(comments[index], 'update');

  return comments[index];
}

/**
 * Delete a comment (and its replies if it's a root comment)
 */
export function deleteComment(commentId: string): boolean {
  const comments = getAllComments();
  const comment = comments.find((c) => c.id === commentId);

  if (!comment) {
    return false;
  }

  // If root comment, also delete replies
  const idsToDelete = new Set([commentId]);
  if (!comment.parentId) {
    comments
      .filter((c) => c.parentId === commentId)
      .forEach((c) => idsToDelete.add(c.id));
  }

  const filtered = comments.filter((c) => !idsToDelete.has(c.id));
  saveComments(filtered);

  // Sync deletion to cloud
  idsToDelete.forEach((id) => {
    syncCommentToCloud({ id } as Comment, 'delete');
  });

  return true;
}

/**
 * Delete all comments for a note
 */
export function deleteCommentsForNote(noteId: string): void {
  const comments = getAllComments();
  const toDelete = comments.filter((c) => c.noteId === noteId);
  const remaining = comments.filter((c) => c.noteId !== noteId);

  saveComments(remaining);

  // Sync deletions to cloud
  toDelete.forEach((c) => {
    syncCommentToCloud(c, 'delete');
  });
}

/**
 * Adjust comment positions after text edit
 * Call this when text is inserted or deleted before comment positions
 */
export function adjustCommentPositions(
  noteId: string,
  changeStart: number,
  changeLength: number
): void {
  const comments = getAllComments();
  let hasChanges = false;

  comments.forEach((comment) => {
    if (comment.noteId !== noteId) return;

    // If change is before comment, adjust positions
    if (changeStart <= comment.fromPos) {
      comment.fromPos += changeLength;
      comment.toPos += changeLength;
      hasChanges = true;
    }
    // If change is inside comment range, expand/shrink end
    else if (changeStart < comment.toPos) {
      comment.toPos += changeLength;
      hasChanges = true;
    }

    // Ensure positions don't go negative
    comment.fromPos = Math.max(0, comment.fromPos);
    comment.toPos = Math.max(comment.fromPos, comment.toPos);
  });

  if (hasChanges) {
    saveComments(comments);
  }
}

/**
 * Get comments that overlap with a text range
 */
export function getCommentsInRange(
  noteId: string,
  from: number,
  to: number
): Comment[] {
  return getCommentsForNote(noteId).filter(
    (c) =>
      !c.parentId && // Only root comments have positions
      ((c.fromPos >= from && c.fromPos <= to) ||
        (c.toPos >= from && c.toPos <= to) ||
        (c.fromPos <= from && c.toPos >= to))
  );
}

/**
 * Sync comment to Supabase (if configured)
 */
async function syncCommentToCloud(
  comment: Comment,
  operation: 'create' | 'update' | 'delete'
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) return;

    if (operation === 'delete') {
      await supabase.from('comments').delete().eq('id', comment.id);
    } else if (operation === 'create') {
      await supabase.from('comments').insert({
        id: comment.id,
        note_id: comment.noteId,
        user_id: comment.userId,
        user_name: comment.userName,
        user_color: comment.userColor,
        from_pos: comment.fromPos,
        to_pos: comment.toPos,
        selected_text: comment.selectedText,
        content: comment.content,
        parent_id: comment.parentId || null,
        resolved: comment.resolved,
        created_at: comment.createdAt.toISOString(),
        updated_at: comment.updatedAt.toISOString(),
      });
    } else {
      await supabase
        .from('comments')
        .update({
          content: comment.content,
          resolved: comment.resolved,
          updated_at: comment.updatedAt.toISOString(),
        })
        .eq('id', comment.id);
    }
  } catch (error) {
    console.error('Failed to sync comment to cloud:', error);
  }
}

/**
 * Pull comments from cloud for a note
 */
export async function pullCommentsFromCloud(noteId: string): Promise<Comment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('note_id', noteId);

    if (error) throw error;
    if (!data) return [];

    const cloudComments: Comment[] = data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      noteId: row.note_id as string,
      userId: row.user_id as string,
      userName: row.user_name as string,
      userColor: row.user_color as string,
      fromPos: row.from_pos as number,
      toPos: row.to_pos as number,
      selectedText: row.selected_text as string,
      content: row.content as string,
      parentId: row.parent_id as string | undefined,
      resolved: row.resolved as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }));

    // Merge with local comments
    const localComments = getAllComments();
    const localNoteComments = localComments.filter((c) => c.noteId !== noteId);
    const merged = [...localNoteComments, ...cloudComments];
    saveComments(merged);

    return cloudComments;
  } catch (error) {
    console.error('Failed to pull comments from cloud:', error);
    return [];
  }
}

/**
 * SQL to create the comments table in Supabase
 */
export const COMMENTS_SETUP_SQL = `
-- Comments table for inline comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  user_color TEXT NOT NULL,
  from_pos INTEGER NOT NULL,
  to_pos INTEGER NOT NULL,
  selected_text TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS comments_note_id_idx ON comments(note_id);
CREATE INDEX IF NOT EXISTS comments_user_id_idx ON comments(user_id);
CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON comments(parent_id);

-- RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on notes they can access
CREATE POLICY "Users can view comments on accessible notes" ON comments
  FOR SELECT USING (
    note_id IN (
      SELECT id FROM notes WHERE user_id = auth.uid() OR (shared = true AND share_token IS NOT NULL)
    )
  );

-- Users can insert comments on notes they can access
CREATE POLICY "Users can insert comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
`;

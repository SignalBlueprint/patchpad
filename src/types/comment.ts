/**
 * Comment Types
 *
 * Types for inline comments anchored to text positions in notes.
 */

export interface Comment {
  id: string;
  noteId: string;
  userId: string;
  userName: string;
  userColor: string;
  /** Start position in document */
  fromPos: number;
  /** End position in document */
  toPos: number;
  /** The text that was selected when comment was created */
  selectedText: string;
  /** Comment content */
  content: string;
  /** Parent comment ID for replies */
  parentId?: string;
  /** Whether this comment is resolved */
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentThread {
  /** Root comment */
  comment: Comment;
  /** Replies to the root comment */
  replies: Comment[];
  /** Whether thread is collapsed in UI */
  isCollapsed?: boolean;
}

export interface CommentDraft {
  noteId: string;
  fromPos: number;
  toPos: number;
  selectedText: string;
  content: string;
  parentId?: string;
}

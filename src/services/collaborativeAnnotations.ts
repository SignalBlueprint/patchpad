/**
 * Collaborative Annotation Service
 *
 * Enables multiple users to annotate the same session.
 * Annotations are color-coded by contributor with conversation threads.
 */

import { v4 as uuidv4 } from 'uuid';
import type { SessionAnnotation } from '../types/session';
import { getSupabase } from '../config/supabase';

// Types
export interface CollaborativeAnnotation extends SessionAnnotation {
  authorId: string;
  authorName: string;
  authorColor: string;
  replies: AnnotationReply[];
  isResolved: boolean;
}

export interface AnnotationReply {
  id: string;
  annotationId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  createdAt: Date;
}

export interface AnnotationAuthor {
  id: string;
  name: string;
  color: string;
}

export interface AnnotationFilter {
  authorId?: string;
  type?: 'note' | 'highlight' | 'voice';
  resolved?: boolean;
  timeRange?: { start: number; end: number };
}

// Storage keys
const ANNOTATIONS_STORAGE_KEY = 'patchpad_collab_annotations';
const AUTHORS_STORAGE_KEY = 'patchpad_annotation_authors';

// Author color palette
const AUTHOR_COLORS = [
  '#FF6B6B', // Coral Red
  '#4ECDC4', // Teal
  '#45B7D1', // Sky Blue
  '#96CEB4', // Sage Green
  '#FFEAA7', // Soft Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Light Purple
  '#85C1E9', // Light Blue
];

// In-memory cache
let annotationsCache: Map<string, CollaborativeAnnotation[]> = new Map();
let authorsCache: AnnotationAuthor[] | null = null;

/**
 * Get a deterministic color for an author based on their ID
 */
export function getAuthorColor(authorId: string): string {
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = ((hash << 5) - hash) + authorId.charCodeAt(i);
    hash |= 0;
  }
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

/**
 * Get all authors who have annotated sessions
 */
export function getAuthors(): AnnotationAuthor[] {
  if (authorsCache) return authorsCache;

  try {
    const stored = localStorage.getItem(AUTHORS_STORAGE_KEY);
    if (stored) {
      authorsCache = JSON.parse(stored);
      return authorsCache!;
    }
  } catch (error) {
    console.error('Failed to load authors:', error);
  }

  authorsCache = [];
  return authorsCache;
}

/**
 * Save authors to storage
 */
function saveAuthors(authors: AnnotationAuthor[]): void {
  authorsCache = authors;
  try {
    localStorage.setItem(AUTHORS_STORAGE_KEY, JSON.stringify(authors));
  } catch (error) {
    console.error('Failed to save authors:', error);
  }
}

/**
 * Register or update an author
 */
export function registerAuthor(id: string, name: string): AnnotationAuthor {
  const authors = getAuthors();
  const existingIndex = authors.findIndex(a => a.id === id);

  const author: AnnotationAuthor = {
    id,
    name,
    color: getAuthorColor(id),
  };

  if (existingIndex >= 0) {
    authors[existingIndex] = author;
  } else {
    authors.push(author);
  }

  saveAuthors(authors);
  return author;
}

/**
 * Get annotations for a session
 */
export async function getAnnotations(
  sessionId: string,
  filter?: AnnotationFilter
): Promise<CollaborativeAnnotation[]> {
  // Check cache first
  if (annotationsCache.has(sessionId)) {
    let annotations = annotationsCache.get(sessionId)!;
    return applyFilter(annotations, filter);
  }

  // Try Supabase
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('session_annotations')
      .select('*, replies:annotation_replies(*)')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (!error && data) {
      const annotations: CollaborativeAnnotation[] = data.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        type: row.type,
        content: row.content,
        canvasPosition: row.canvas_position,
        createdAt: new Date(row.created_at),
        authorId: row.author_id,
        authorName: row.author_name,
        authorColor: row.author_color,
        isResolved: row.is_resolved,
        replies: (row.replies || []).map((r: Record<string, unknown>) => ({
          id: r.id,
          annotationId: r.annotation_id,
          authorId: r.author_id,
          authorName: r.author_name,
          authorColor: r.author_color,
          content: r.content,
          createdAt: new Date(r.created_at as string),
        })),
      }));

      annotationsCache.set(sessionId, annotations);
      return applyFilter(annotations, filter);
    }
  }

  // Local fallback
  const annotations = getLocalAnnotations(sessionId);
  annotationsCache.set(sessionId, annotations);
  return applyFilter(annotations, filter);
}

/**
 * Apply filter to annotations
 */
function applyFilter(
  annotations: CollaborativeAnnotation[],
  filter?: AnnotationFilter
): CollaborativeAnnotation[] {
  if (!filter) return annotations;

  return annotations.filter(a => {
    if (filter.authorId && a.authorId !== filter.authorId) return false;
    if (filter.type && a.type !== filter.type) return false;
    if (filter.resolved !== undefined && a.isResolved !== filter.resolved) return false;
    if (filter.timeRange) {
      if (a.timestamp < filter.timeRange.start || a.timestamp > filter.timeRange.end) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Get annotations from localStorage
 */
function getLocalAnnotations(sessionId: string): CollaborativeAnnotation[] {
  try {
    const stored = localStorage.getItem(`${ANNOTATIONS_STORAGE_KEY}_${sessionId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((a: Record<string, unknown>) => ({
        ...a,
        createdAt: new Date(a.createdAt as string),
        replies: (a.replies as AnnotationReply[])?.map(r => ({
          ...r,
          createdAt: new Date(r.createdAt),
        })) || [],
      }));
    }
  } catch (error) {
    console.error('Failed to load annotations:', error);
  }
  return [];
}

/**
 * Save annotations to localStorage
 */
function saveLocalAnnotations(sessionId: string, annotations: CollaborativeAnnotation[]): void {
  try {
    localStorage.setItem(
      `${ANNOTATIONS_STORAGE_KEY}_${sessionId}`,
      JSON.stringify(annotations)
    );
  } catch (error) {
    console.error('Failed to save annotations:', error);
  }
}

/**
 * Add an annotation to a session
 */
export async function addAnnotation(
  sessionId: string,
  annotation: {
    timestamp: number;
    type: 'note' | 'highlight' | 'voice';
    content: string;
    canvasPosition?: { x: number; y: number };
  },
  author: AnnotationAuthor
): Promise<CollaborativeAnnotation> {
  const newAnnotation: CollaborativeAnnotation = {
    id: uuidv4(),
    timestamp: annotation.timestamp,
    type: annotation.type,
    content: annotation.content,
    canvasPosition: annotation.canvasPosition,
    createdAt: new Date(),
    authorId: author.id,
    authorName: author.name,
    authorColor: author.color,
    replies: [],
    isResolved: false,
  };

  // Try Supabase
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from('session_annotations').insert({
      id: newAnnotation.id,
      session_id: sessionId,
      timestamp: annotation.timestamp,
      type: annotation.type,
      content: annotation.content,
      canvas_position: annotation.canvasPosition,
      author_id: author.id,
      author_name: author.name,
      author_color: author.color,
      is_resolved: false,
      created_at: newAnnotation.createdAt.toISOString(),
    });

    if (error) {
      console.error('Failed to save annotation to Supabase:', error);
    }
  }

  // Update cache
  const annotations = annotationsCache.get(sessionId) || [];
  annotations.push(newAnnotation);
  annotationsCache.set(sessionId, annotations);

  // Save locally
  saveLocalAnnotations(sessionId, annotations);

  return newAnnotation;
}

/**
 * Add a reply to an annotation
 */
export async function addReply(
  sessionId: string,
  annotationId: string,
  content: string,
  author: AnnotationAuthor
): Promise<AnnotationReply> {
  const reply: AnnotationReply = {
    id: uuidv4(),
    annotationId,
    authorId: author.id,
    authorName: author.name,
    authorColor: author.color,
    content,
    createdAt: new Date(),
  };

  // Try Supabase
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from('annotation_replies').insert({
      id: reply.id,
      annotation_id: annotationId,
      author_id: author.id,
      author_name: author.name,
      author_color: author.color,
      content,
      created_at: reply.createdAt.toISOString(),
    });

    if (error) {
      console.error('Failed to save reply to Supabase:', error);
    }
  }

  // Update cache
  const annotations = annotationsCache.get(sessionId) || [];
  const annotation = annotations.find(a => a.id === annotationId);
  if (annotation) {
    annotation.replies.push(reply);
    saveLocalAnnotations(sessionId, annotations);
  }

  return reply;
}

/**
 * Resolve or unresolve an annotation
 */
export async function toggleResolved(
  sessionId: string,
  annotationId: string
): Promise<boolean> {
  const annotations = annotationsCache.get(sessionId) || [];
  const annotation = annotations.find(a => a.id === annotationId);

  if (!annotation) return false;

  annotation.isResolved = !annotation.isResolved;

  // Try Supabase
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from('session_annotations')
      .update({ is_resolved: annotation.isResolved })
      .eq('id', annotationId);

    if (error) {
      console.error('Failed to update annotation in Supabase:', error);
    }
  }

  saveLocalAnnotations(sessionId, annotations);
  return annotation.isResolved;
}

/**
 * Delete an annotation
 */
export async function deleteAnnotation(
  sessionId: string,
  annotationId: string
): Promise<boolean> {
  // Try Supabase
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from('session_annotations')
      .delete()
      .eq('id', annotationId);

    if (error) {
      console.error('Failed to delete annotation from Supabase:', error);
    }
  }

  // Update cache
  const annotations = annotationsCache.get(sessionId) || [];
  const index = annotations.findIndex(a => a.id === annotationId);
  if (index >= 0) {
    annotations.splice(index, 1);
    annotationsCache.set(sessionId, annotations);
    saveLocalAnnotations(sessionId, annotations);
    return true;
  }

  return false;
}

/**
 * Get annotation statistics for a session
 */
export function getAnnotationStats(sessionId: string): {
  total: number;
  byAuthor: Record<string, number>;
  byType: Record<string, number>;
  resolved: number;
  unresolved: number;
} {
  const annotations = annotationsCache.get(sessionId) || [];

  const byAuthor: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let resolved = 0;
  let unresolved = 0;

  annotations.forEach(a => {
    byAuthor[a.authorName] = (byAuthor[a.authorName] || 0) + 1;
    byType[a.type] = (byType[a.type] || 0) + 1;
    if (a.isResolved) {
      resolved++;
    } else {
      unresolved++;
    }
  });

  return {
    total: annotations.length,
    byAuthor,
    byType,
    resolved,
    unresolved,
  };
}

/**
 * Export annotations as JSON
 */
export function exportAnnotations(sessionId: string): string {
  const annotations = annotationsCache.get(sessionId) || [];
  return JSON.stringify(annotations, null, 2);
}

/**
 * Import annotations from JSON
 */
export async function importAnnotations(
  sessionId: string,
  json: string
): Promise<number> {
  try {
    const parsed = JSON.parse(json);
    const annotations: CollaborativeAnnotation[] = parsed.map((a: Record<string, unknown>) => ({
      ...a,
      id: uuidv4(), // Generate new IDs to avoid conflicts
      createdAt: new Date(a.createdAt as string),
      replies: (a.replies as AnnotationReply[])?.map(r => ({
        ...r,
        id: uuidv4(),
        createdAt: new Date(r.createdAt),
      })) || [],
    }));

    // Merge with existing
    const existing = annotationsCache.get(sessionId) || [];
    const merged = [...existing, ...annotations];
    annotationsCache.set(sessionId, merged);
    saveLocalAnnotations(sessionId, merged);

    return annotations.length;
  } catch (error) {
    console.error('Failed to import annotations:', error);
    return 0;
  }
}

/**
 * SQL for creating annotation tables in Supabase
 */
export const ANNOTATIONS_SQL = `
-- Session annotations table
CREATE TABLE IF NOT EXISTS session_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('note', 'highlight', 'voice')),
  content TEXT NOT NULL,
  canvas_position JSONB,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_color TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Annotation replies table
CREATE TABLE IF NOT EXISTS annotation_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annotation_id UUID REFERENCES session_annotations(id) ON DELETE CASCADE NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_color TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS session_annotations_session_id_idx ON session_annotations(session_id);
CREATE INDEX IF NOT EXISTS session_annotations_timestamp_idx ON session_annotations(timestamp);
CREATE INDEX IF NOT EXISTS session_annotations_author_id_idx ON session_annotations(author_id);
CREATE INDEX IF NOT EXISTS annotation_replies_annotation_id_idx ON annotation_replies(annotation_id);

-- Row Level Security
ALTER TABLE session_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_replies ENABLE ROW LEVEL SECURITY;

-- Anyone can view annotations
CREATE POLICY "Anyone can view annotations" ON session_annotations
  FOR SELECT USING (true);

-- Authenticated users can create annotations
CREATE POLICY "Authenticated users can create annotations" ON session_annotations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authors can update their own annotations
CREATE POLICY "Authors can update own annotations" ON session_annotations
  FOR UPDATE USING (auth.uid()::text = author_id);

-- Authors can delete their own annotations
CREATE POLICY "Authors can delete own annotations" ON session_annotations
  FOR DELETE USING (auth.uid()::text = author_id);

-- Anyone can view replies
CREATE POLICY "Anyone can view replies" ON annotation_replies
  FOR SELECT USING (true);

-- Authenticated users can create replies
CREATE POLICY "Authenticated users can create replies" ON annotation_replies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authors can delete their own replies
CREATE POLICY "Authors can delete own replies" ON annotation_replies
  FOR DELETE USING (auth.uid()::text = author_id);
`;

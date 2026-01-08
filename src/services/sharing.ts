/**
 * Note Sharing Service
 *
 * Manages shareable links for notes. Allows users to generate public URLs
 * that anyone can use to view a read-only version of their notes.
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabase, isSupabaseConfigured, supabaseToNote } from '../config/supabase';
import type { Note } from '../types/note';

// Local analytics storage key
const SHARE_ANALYTICS_KEY = 'patchpad_share_analytics';

export interface ShareAnalytics {
  noteId: string;
  shareToken: string;
  createdAt: string;
  viewCount: number;
}

/**
 * Check if sharing is available (requires Supabase sync)
 */
export function isSharingAvailable(): boolean {
  return isSupabaseConfigured();
}

/**
 * Generate a shareable link for a note
 * Creates a unique token and stores it in Supabase
 */
export async function generateShareLink(noteId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase not configured. Enable sync to share notes.');
  }

  const shareToken = uuidv4();

  // Update note in Supabase with sharing enabled
  const { error } = await supabase
    .from('notes')
    .update({
      shared: true,
      share_token: shareToken,
    })
    .eq('id', noteId);

  if (error) {
    throw new Error(`Failed to enable sharing: ${error.message}`);
  }

  // Log analytics locally
  logShareCreation(noteId, shareToken);

  // Generate URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/shared/${shareToken}`;
}

/**
 * Get a shared note by its share token
 * Returns null if not found or not shared
 */
export async function getSharedNote(token: string): Promise<Note | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('share_token', token)
    .eq('shared', true)
    .single();

  if (error || !data) {
    return null;
  }

  // Increment view count
  await supabase
    .from('notes')
    .update({ share_view_count: (data.share_view_count || 0) + 1 })
    .eq('id', data.id);

  return supabaseToNote(data);
}

/**
 * Revoke a share link for a note
 * Disables sharing and clears the token
 */
export async function revokeShareLink(noteId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('notes')
    .update({
      shared: false,
      share_token: null,
    })
    .eq('id', noteId);

  if (error) {
    throw new Error(`Failed to revoke sharing: ${error.message}`);
  }

  // Remove from local analytics
  removeShareAnalytics(noteId);
}

/**
 * Check if a note is currently shared
 */
export async function isNoteShared(noteId: string): Promise<{ shared: boolean; shareToken: string | null; viewCount: number }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { shared: false, shareToken: null, viewCount: 0 };
  }

  const { data, error } = await supabase
    .from('notes')
    .select('shared, share_token, share_view_count')
    .eq('id', noteId)
    .single();

  if (error || !data) {
    return { shared: false, shareToken: null, viewCount: 0 };
  }

  return {
    shared: data.shared,
    shareToken: data.share_token,
    viewCount: data.share_view_count || 0,
  };
}

/**
 * Get the share URL for a note (if already shared)
 */
export function getShareUrl(shareToken: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/shared/${shareToken}`;
}

// --- Local Analytics ---

function logShareCreation(noteId: string, shareToken: string): void {
  const analytics = getLocalShareAnalytics();
  analytics.push({
    noteId,
    shareToken,
    createdAt: new Date().toISOString(),
    viewCount: 0,
  });
  localStorage.setItem(SHARE_ANALYTICS_KEY, JSON.stringify(analytics));
}

function removeShareAnalytics(noteId: string): void {
  const analytics = getLocalShareAnalytics().filter(a => a.noteId !== noteId);
  localStorage.setItem(SHARE_ANALYTICS_KEY, JSON.stringify(analytics));
}

export function getLocalShareAnalytics(): ShareAnalytics[] {
  try {
    const stored = localStorage.getItem(SHARE_ANALYTICS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get all shared notes for the current user
 */
export async function getSharedNotes(): Promise<{ noteId: string; title: string; shareToken: string; viewCount: number }[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('notes')
    .select('id, title, share_token, share_view_count')
    .eq('user_id', user.id)
    .eq('shared', true);

  if (error || !data) {
    return [];
  }

  return data.map(note => ({
    noteId: note.id,
    title: note.title,
    shareToken: note.share_token!,
    viewCount: note.share_view_count || 0,
  }));
}

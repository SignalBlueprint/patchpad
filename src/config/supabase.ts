/**
 * Supabase Configuration
 *
 * This module initializes the Supabase client for authentication and data sync.
 *
 * To use sync features:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Add your credentials to environment variables or localStorage:
 *    - VITE_SUPABASE_URL or localStorage 'patchpad_supabase_url'
 *    - VITE_SUPABASE_ANON_KEY or localStorage 'patchpad_supabase_anon_key'
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Note } from '../types/note';

// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          tags: string[];
          folder_id: string | null;
          parent_id: string | null;
          favorite: boolean;
          collapsed: boolean;
          canvas_position: {
            x: number;
            y: number;
            width: number;
            height: number;
          } | null;
          audio_id: string | null;
          created_at: string;
          updated_at: string;
          version: number;
          deleted_at: string | null;
          // Sharing fields
          shared: boolean;
          share_token: string | null;
          share_view_count: number;
        };
        Insert: Omit<Database['public']['Tables']['notes']['Row'], 'version'> & { version?: number };
        Update: Partial<Database['public']['Tables']['notes']['Insert']>;
      };
      sync_queue: {
        Row: {
          id: string;
          user_id: string;
          note_id: string;
          operation: 'create' | 'update' | 'delete';
          payload: Record<string, unknown>;
          created_at: string;
          synced_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['sync_queue']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['sync_queue']['Insert']>;
      };
    };
  };
}

// Storage keys
const SUPABASE_URL_KEY = 'patchpad_supabase_url';
const SUPABASE_ANON_KEY_KEY = 'patchpad_supabase_anon_key';

// Get credentials from environment or localStorage
function getSupabaseCredentials(): { url: string; anonKey: string } | null {
  // First try environment variables (for production builds)
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey };
  }

  // Fall back to localStorage (for user-configured setup)
  const localUrl = localStorage.getItem(SUPABASE_URL_KEY);
  const localKey = localStorage.getItem(SUPABASE_ANON_KEY_KEY);

  if (localUrl && localKey) {
    return { url: localUrl, anonKey: localKey };
  }

  return null;
}

// Singleton client instance
let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Get or create the Supabase client
 * Returns null if credentials are not configured
 */
export function getSupabase(): SupabaseClient<Database> | null {
  if (supabaseClient) {
    return supabaseClient;
  }

  const credentials = getSupabaseCredentials();
  if (!credentials) {
    return null;
  }

  supabaseClient = createClient<Database>(credentials.url, credentials.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseCredentials() !== null;
}

/**
 * Configure Supabase credentials (stores in localStorage)
 */
export function configureSupabase(url: string, anonKey: string): void {
  localStorage.setItem(SUPABASE_URL_KEY, url);
  localStorage.setItem(SUPABASE_ANON_KEY_KEY, anonKey);
  // Reset client so it gets recreated with new credentials
  supabaseClient = null;
}

/**
 * Clear Supabase configuration
 */
export function clearSupabaseConfig(): void {
  localStorage.removeItem(SUPABASE_URL_KEY);
  localStorage.removeItem(SUPABASE_ANON_KEY_KEY);
  supabaseClient = null;
}

/**
 * Convert local Note to Supabase format
 */
export function noteToSupabase(note: Note, userId: string): Database['public']['Tables']['notes']['Insert'] {
  return {
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    tags: note.tags,
    folder_id: note.folderId ?? null,
    parent_id: note.parentId ?? null,
    favorite: note.favorite,
    collapsed: note.collapsed ?? false,
    canvas_position: note.canvasPosition ?? null,
    audio_id: note.audioId ?? null,
    created_at: note.createdAt.toISOString(),
    updated_at: note.updatedAt.toISOString(),
    deleted_at: null,
    // Sharing defaults - only updated through sharing service
    shared: false,
    share_token: null,
    share_view_count: 0,
  };
}

/**
 * Convert Supabase note to local Note format
 */
export function supabaseToNote(row: Database['public']['Tables']['notes']['Row']): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags,
    folderId: row.folder_id ?? undefined,
    parentId: row.parent_id ?? undefined,
    favorite: row.favorite,
    collapsed: row.collapsed,
    canvasPosition: row.canvas_position ?? undefined,
    audioId: row.audio_id ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    highlights: [], // Highlights are stored locally for now
  };
}

/**
 * SQL to create the notes table in Supabase
 * Run this in the Supabase SQL editor to set up your database
 */
export const SETUP_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  folder_id UUID,
  parent_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  favorite BOOLEAN NOT NULL DEFAULT false,
  collapsed BOOLEAN NOT NULL DEFAULT false,
  canvas_position JSONB,
  audio_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  -- Sharing fields
  shared BOOLEAN NOT NULL DEFAULT false,
  share_token UUID,
  share_view_count INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT notes_folder_fk FOREIGN KEY (folder_id) REFERENCES notes(id) ON DELETE SET NULL
);

-- Sync queue for offline operations
CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  note_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes(updated_at);
CREATE INDEX IF NOT EXISTS notes_parent_id_idx ON notes(parent_id);
CREATE INDEX IF NOT EXISTS notes_folder_id_idx ON notes(folder_id);
CREATE INDEX IF NOT EXISTS notes_share_token_idx ON notes(share_token);
CREATE INDEX IF NOT EXISTS sync_queue_user_id_idx ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS sync_queue_synced_at_idx ON sync_queue(synced_at);

-- Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own data
CREATE POLICY "Users can view own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);

-- Allow anyone to view shared notes (read-only)
CREATE POLICY "Anyone can view shared notes" ON notes
  FOR SELECT USING (shared = true AND share_token IS NOT NULL);

CREATE POLICY "Users can view own sync_queue" ON sync_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync_queue" ON sync_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync_queue" ON sync_queue
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync_queue" ON sync_queue
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp and version
DROP TRIGGER IF EXISTS notes_updated_at ON notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable realtime for notes table
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
`;

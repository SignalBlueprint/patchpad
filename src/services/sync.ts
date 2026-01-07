/**
 * Sync Service
 *
 * Handles synchronization of notes between local IndexedDB and Supabase cloud.
 * Supports offline-first with conflict resolution.
 */

import { getSupabase, noteToSupabase, supabaseToNote, type Database } from '../config/supabase';
import type { Note } from '../types/note';

export interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: SyncConflict[];
  errors: string[];
}

export interface SyncConflict {
  noteId: string;
  localNote: Note;
  remoteNote: Note;
  localUpdatedAt: Date;
  remoteUpdatedAt: Date;
}

export type ConflictResolution = 'keep_local' | 'keep_remote' | 'keep_both';

/**
 * Fetch all notes from Supabase for the current user
 */
export async function pullFromCloud(): Promise<{ notes: Note[]; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { notes: [], error: 'Supabase not configured' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { notes: [], error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    return { notes: [], error: error.message };
  }

  const notes = (data || []).map(supabaseToNote);
  return { notes, error: null };
}

/**
 * Push a single note to Supabase
 */
export async function pushNoteToCloud(note: Note): Promise<{ success: boolean; error: string | null; version?: number }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const supabaseNote = noteToSupabase(note, user.id);

  // Use upsert to handle both create and update
  const { data, error } = await supabase
    .from('notes')
    .upsert(supabaseNote, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })
    .select('version')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null, version: data?.version };
}

/**
 * Push multiple notes to Supabase
 */
export async function pushNotesToCloud(notes: Note[]): Promise<{ success: boolean; errors: string[] }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, errors: ['Supabase not configured'] };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, errors: ['Not authenticated'] };
  }

  const supabaseNotes = notes.map(note => noteToSupabase(note, user.id));

  const { error } = await supabase
    .from('notes')
    .upsert(supabaseNotes, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });

  if (error) {
    return { success: false, errors: [error.message] };
  }

  return { success: true, errors: [] };
}

/**
 * Delete a note from Supabase (soft delete)
 */
export async function deleteNoteFromCloud(noteId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Soft delete by setting deleted_at
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Get a single note from Supabase
 */
export async function getNoteFromCloud(noteId: string): Promise<{ note: Note | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { note: null, error: 'Supabase not configured' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { note: null, error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', noteId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Note not found
      return { note: null, error: null };
    }
    return { note: null, error: error.message };
  }

  return { note: supabaseToNote(data), error: null };
}

/**
 * Detect conflicts between local and remote notes
 */
export function detectConflicts(
  localNotes: Note[],
  remoteNotes: Note[]
): SyncConflict[] {
  const conflicts: SyncConflict[] = [];
  const remoteById = new Map(remoteNotes.map(n => [n.id, n]));

  for (const local of localNotes) {
    const remote = remoteById.get(local.id);
    if (!remote) continue;

    // If both have been updated since last sync, we have a conflict
    // For now, we compare timestamps - if they differ significantly, it's a conflict
    const localTime = local.updatedAt.getTime();
    const remoteTime = remote.updatedAt.getTime();
    const timeDiff = Math.abs(localTime - remoteTime);

    // If times differ by more than 1 second and content differs, it's a conflict
    if (timeDiff > 1000 && local.content !== remote.content) {
      conflicts.push({
        noteId: local.id,
        localNote: local,
        remoteNote: remote,
        localUpdatedAt: local.updatedAt,
        remoteUpdatedAt: remote.updatedAt,
      });
    }
  }

  return conflicts;
}

/**
 * Resolve a conflict based on user choice
 */
export function resolveConflict(
  conflict: SyncConflict,
  resolution: ConflictResolution
): { notesToKeep: Note[]; notesToDelete: string[] } {
  switch (resolution) {
    case 'keep_local':
      return {
        notesToKeep: [conflict.localNote],
        notesToDelete: [],
      };

    case 'keep_remote':
      return {
        notesToKeep: [conflict.remoteNote],
        notesToDelete: [],
      };

    case 'keep_both':
      // Create a copy of the remote note with a new ID
      const remoteCopy: Note = {
        ...conflict.remoteNote,
        id: `${conflict.remoteNote.id}-conflict-${Date.now()}`,
        title: `${conflict.remoteNote.title} (conflict copy)`,
      };
      return {
        notesToKeep: [conflict.localNote, remoteCopy],
        notesToDelete: [],
      };

    default:
      return {
        notesToKeep: [conflict.localNote],
        notesToDelete: [],
      };
  }
}

/**
 * Perform a full sync between local and remote
 */
export async function syncNotes(
  localNotes: Note[],
  onConflict?: (conflict: SyncConflict) => Promise<ConflictResolution>
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    uploaded: 0,
    downloaded: 0,
    conflicts: [],
    errors: [],
  };

  // Pull remote notes
  const { notes: remoteNotes, error: pullError } = await pullFromCloud();
  if (pullError) {
    result.success = false;
    result.errors.push(`Pull failed: ${pullError}`);
    return result;
  }

  // Detect conflicts
  const conflicts = detectConflicts(localNotes, remoteNotes);
  result.conflicts = conflicts;

  // Resolve conflicts if handler provided
  if (conflicts.length > 0 && onConflict) {
    for (const conflict of conflicts) {
      const resolution = await onConflict(conflict);
      resolveConflict(conflict, resolution);
    }
  }

  // Push local notes that are newer than remote or don't exist remotely
  const remoteById = new Map(remoteNotes.map(n => [n.id, n]));
  const notesToPush: Note[] = [];

  for (const local of localNotes) {
    const remote = remoteById.get(local.id);
    if (!remote || local.updatedAt > remote.updatedAt) {
      // Check if this note is in a conflict - if so, skip (will be handled separately)
      if (!conflicts.some(c => c.noteId === local.id)) {
        notesToPush.push(local);
      }
    }
  }

  if (notesToPush.length > 0) {
    const { success, errors } = await pushNotesToCloud(notesToPush);
    if (success) {
      result.uploaded = notesToPush.length;
    } else {
      result.errors.push(...errors);
    }
  }

  // Find notes that exist remotely but not locally (new from other devices)
  const localById = new Map(localNotes.map(n => [n.id, n]));
  const newFromRemote = remoteNotes.filter(r => !localById.has(r.id));
  result.downloaded = newFromRemote.length;

  return result;
}

/**
 * Subscribe to real-time changes from Supabase
 */
export function subscribeToChanges(
  onInsert: (note: Note) => void,
  onUpdate: (note: Note) => void,
  onDelete: (noteId: string) => void
): (() => void) | null {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const channel = supabase
    .channel('notes-changes')
    .on<Database['public']['Tables']['notes']['Row']>(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notes',
      },
      (payload) => {
        if (payload.new && !payload.new.deleted_at) {
          onInsert(supabaseToNote(payload.new));
        }
      }
    )
    .on<Database['public']['Tables']['notes']['Row']>(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notes',
      },
      (payload) => {
        if (payload.new) {
          if (payload.new.deleted_at) {
            onDelete(payload.new.id);
          } else {
            onUpdate(supabaseToNote(payload.new));
          }
        }
      }
    )
    .on<Database['public']['Tables']['notes']['Row']>(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'notes',
      },
      (payload) => {
        if (payload.old) {
          onDelete(payload.old.id);
        }
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * useSync Hook
 *
 * Provides sync status and operations to React components.
 */

import { useState, useEffect, useCallback } from 'react';
import { getSyncEngine, type SyncStatus, type SyncEvent } from '../services/syncEngine';
import { isSupabaseConfigured } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import type { Note } from '../types/note';

interface UseSyncResult {
  isEnabled: boolean;
  isOnline: boolean;
  status: SyncStatus;
  pendingCount: number;
  lastSyncTime: Date | null;
  syncNote: (note: Note) => void;
  deleteNote: (noteId: string) => void;
  forcSync: () => Promise<void>;
}

export function useSync(): UseSyncResult {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const isEnabled = isSupabaseConfigured() && user !== null;

  useEffect(() => {
    if (!isEnabled) return;

    const engine = getSyncEngine();

    // Get initial state
    setStatus(engine.getStatus());
    setIsOnline(engine.getIsOnline());
    setPendingCount(engine.getPendingCount());
    setLastSyncTime(engine.getLastSyncTime());

    // Listen for changes
    const unsubscribe = engine.addEventListener((event: SyncEvent) => {
      switch (event.type) {
        case 'status_change':
          const data = event.data as { status?: SyncStatus; online?: boolean };
          if (data.status !== undefined) {
            setStatus(data.status);
          }
          if (data.online !== undefined) {
            setIsOnline(data.online);
          }
          break;

        case 'sync_complete':
          setLastSyncTime(new Date());
          setPendingCount(engine.getPendingCount());
          break;

        case 'note_synced':
          setPendingCount(engine.getPendingCount());
          break;
      }
    });

    return unsubscribe;
  }, [isEnabled]);

  const syncNote = useCallback((note: Note) => {
    if (!isEnabled) return;

    const engine = getSyncEngine();
    // Determine if this is a new note or update
    // For simplicity, we'll use 'update' for all - upsert handles both
    engine.queueOperation('update', note.id, note);
  }, [isEnabled]);

  const deleteNote = useCallback((noteId: string) => {
    if (!isEnabled) return;

    const engine = getSyncEngine();
    engine.queueOperation('delete', noteId);
  }, [isEnabled]);

  const forceSync = useCallback(async () => {
    if (!isEnabled) return;

    const engine = getSyncEngine();
    await engine.performSync();
  }, [isEnabled]);

  return {
    isEnabled,
    isOnline,
    status,
    pendingCount,
    lastSyncTime,
    syncNote,
    deleteNote,
    forcSync: forceSync,
  };
}

/**
 * Hook to receive new notes from other devices
 */
export function useSyncReceiver(
  onNoteReceived: (note: Note, operation: 'insert' | 'update') => void,
  onNoteDeleted: (noteId: string) => void
): void {
  const { user } = useAuth();
  const isEnabled = isSupabaseConfigured() && user !== null;

  useEffect(() => {
    if (!isEnabled) return;

    const engine = getSyncEngine();

    const unsubscribe = engine.addEventListener((event: SyncEvent) => {
      if (event.type === 'note_received') {
        const data = event.data as { note?: Note; noteId?: string; operation?: string };

        if (data.operation === 'delete' && data.noteId) {
          onNoteDeleted(data.noteId);
        } else if (data.note && (data.operation === 'insert' || data.operation === 'update')) {
          onNoteReceived(data.note, data.operation as 'insert' | 'update');
        }
      }
    });

    return unsubscribe;
  }, [isEnabled, onNoteReceived, onNoteDeleted]);
}

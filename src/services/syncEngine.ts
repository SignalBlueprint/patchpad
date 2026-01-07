/**
 * Sync Engine
 *
 * Manages background sync loop, offline queue, and connection state.
 */

import { getSupabase, isSupabaseConfigured } from '../config/supabase';
import {
  pushNoteToCloud,
  deleteNoteFromCloud,
  pullFromCloud,
  subscribeToChanges,
  type SyncConflict,
} from './sync';
import type { Note } from '../types/note';

// Storage keys
const SYNC_QUEUE_KEY = 'patchpad_sync_queue';
const LAST_SYNC_KEY = 'patchpad_last_sync';

// Sync operation types
export type SyncOperation = {
  id: string;
  type: 'create' | 'update' | 'delete';
  noteId: string;
  note?: Note;
  timestamp: number;
  retries: number;
};

// Sync status
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

// Event types
export type SyncEventType =
  | 'status_change'
  | 'note_synced'
  | 'note_received'
  | 'conflict_detected'
  | 'sync_complete'
  | 'error';

export type SyncEvent = {
  type: SyncEventType;
  data?: unknown;
};

type SyncEventListener = (event: SyncEvent) => void;

/**
 * Sync Engine Class
 *
 * Manages the entire sync lifecycle including:
 * - Background sync loop
 * - Offline queue management
 * - Real-time subscriptions
 * - Conflict detection
 */
export class SyncEngine {
  private status: SyncStatus = 'idle';
  private isOnline = navigator.onLine;
  private syncInterval: number | null = null;
  private unsubscribeRealtime: (() => void) | null = null;
  private listeners: Set<SyncEventListener> = new Set();
  private syncInProgress = false;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  /**
   * Start the sync engine
   */
  start(intervalMs = 30000): void {
    if (!isSupabaseConfigured()) {
      console.log('SyncEngine: Supabase not configured, sync disabled');
      return;
    }

    // Initial sync
    this.performSync();

    // Set up periodic sync
    this.syncInterval = window.setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.performSync();
      }
    }, intervalMs);

    // Subscribe to real-time changes
    this.setupRealtimeSubscription();
  }

  /**
   * Stop the sync engine
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.unsubscribeRealtime) {
      this.unsubscribeRealtime();
      this.unsubscribeRealtime = null;
    }

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Check if online
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Add a listener for sync events
   */
  addEventListener(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: SyncEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  /**
   * Handle coming back online
   */
  private handleOnline = (): void => {
    this.isOnline = true;
    this.setStatus('idle');
    this.emit({ type: 'status_change', data: { online: true } });

    // Process offline queue
    this.processQueue();
  };

  /**
   * Handle going offline
   */
  private handleOffline = (): void => {
    this.isOnline = false;
    this.setStatus('offline');
    this.emit({ type: 'status_change', data: { online: false } });
  };

  /**
   * Set and emit status changes
   */
  private setStatus(status: SyncStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit({ type: 'status_change', data: { status } });
    }
  }

  /**
   * Queue an operation for sync
   */
  queueOperation(type: 'create' | 'update' | 'delete', noteId: string, note?: Note): void {
    const queue = this.getQueue();

    // Remove any existing operations for this note (debounce)
    const filtered = queue.filter((op) => op.noteId !== noteId);

    // Add new operation
    filtered.push({
      id: `${noteId}-${Date.now()}`,
      type,
      noteId,
      note,
      timestamp: Date.now(),
      retries: 0,
    });

    this.saveQueue(filtered);

    // If online, process immediately
    if (this.isOnline) {
      this.processQueue();
    }
  }

  /**
   * Get the offline queue
   */
  private getQueue(): SyncOperation[] {
    try {
      const stored = localStorage.getItem(SYNC_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save the offline queue
   */
  private saveQueue(queue: SyncOperation[]): void {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  }

  /**
   * Process the offline queue
   */
  private async processQueue(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return;

    const queue = this.getQueue();
    if (queue.length === 0) return;

    this.syncInProgress = true;
    this.setStatus('syncing');

    const remaining: SyncOperation[] = [];

    for (const op of queue) {
      try {
        let success = false;

        switch (op.type) {
          case 'create':
          case 'update':
            if (op.note) {
              const result = await pushNoteToCloud(op.note);
              success = result.success;
              if (success) {
                this.emit({ type: 'note_synced', data: { noteId: op.noteId, operation: op.type } });
              }
            }
            break;

          case 'delete':
            const deleteResult = await deleteNoteFromCloud(op.noteId);
            success = deleteResult.success;
            if (success) {
              this.emit({ type: 'note_synced', data: { noteId: op.noteId, operation: 'delete' } });
            }
            break;
        }

        if (!success) {
          // Retry up to 3 times
          if (op.retries < 3) {
            remaining.push({ ...op, retries: op.retries + 1 });
          } else {
            this.emit({ type: 'error', data: { message: `Failed to sync note ${op.noteId} after 3 retries` } });
          }
        }
      } catch (err) {
        console.error('Sync operation failed:', err);
        if (op.retries < 3) {
          remaining.push({ ...op, retries: op.retries + 1 });
        }
      }
    }

    this.saveQueue(remaining);
    this.syncInProgress = false;
    this.setStatus(this.isOnline ? 'idle' : 'offline');
  }

  /**
   * Perform a full sync
   */
  async performSync(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    this.syncInProgress = true;
    this.setStatus('syncing');

    try {
      // First, process any queued operations
      await this.processQueue();

      // Then pull any new changes
      const { notes, error } = await pullFromCloud();
      if (error) {
        this.emit({ type: 'error', data: { message: error } });
      } else if (notes.length > 0) {
        // Emit for each new note (the app should handle merging)
        for (const note of notes) {
          this.emit({ type: 'note_received', data: { note } });
        }
      }

      // Update last sync time
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

      this.emit({ type: 'sync_complete', data: { notesReceived: notes.length } });
    } catch (err) {
      console.error('Sync failed:', err);
      this.setStatus('error');
      this.emit({ type: 'error', data: { message: err instanceof Error ? err.message : 'Sync failed' } });
    } finally {
      this.syncInProgress = false;
      this.setStatus(this.isOnline ? 'idle' : 'offline');
    }
  }

  /**
   * Set up real-time subscription for changes from other devices
   */
  private setupRealtimeSubscription(): void {
    this.unsubscribeRealtime = subscribeToChanges(
      // On insert from another device
      (note) => {
        this.emit({ type: 'note_received', data: { note, operation: 'insert' } });
      },
      // On update from another device
      (note) => {
        this.emit({ type: 'note_received', data: { note, operation: 'update' } });
      },
      // On delete from another device
      (noteId) => {
        this.emit({ type: 'note_received', data: { noteId, operation: 'delete' } });
      }
    );
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): Date | null {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    return stored ? new Date(stored) : null;
  }

  /**
   * Get pending operation count
   */
  getPendingCount(): number {
    return this.getQueue().length;
  }

  /**
   * Handle conflict - returns a promise that the UI should resolve
   */
  handleConflict(conflict: SyncConflict): Promise<'keep_local' | 'keep_remote' | 'keep_both'> {
    return new Promise((resolve) => {
      this.emit({
        type: 'conflict_detected',
        data: {
          conflict,
          resolve,
        },
      });
    });
  }
}

// Singleton instance
let syncEngineInstance: SyncEngine | null = null;

/**
 * Get or create the sync engine instance
 */
export function getSyncEngine(): SyncEngine {
  if (!syncEngineInstance) {
    syncEngineInstance = new SyncEngine();
  }
  return syncEngineInstance;
}

/**
 * Initialize and start the sync engine
 */
export function initializeSyncEngine(): SyncEngine {
  const engine = getSyncEngine();
  engine.start();
  return engine;
}

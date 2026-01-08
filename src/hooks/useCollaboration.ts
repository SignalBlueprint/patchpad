/**
 * useCollaboration Hook
 *
 * React hook for managing real-time collaboration on a note.
 * Handles Y.Doc lifecycle, WebSocket connection, and peer awareness.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';
import type { Note } from '../types/note';
import {
  createYDoc,
  connectToRoom,
  disconnectFromRoom,
  destroyCollaboration,
  initDocFromNote,
  syncDocToNote,
  getYText,
  getPeers,
  updateCursor,
  updateSelection,
  onAwarenessChange,
  onConnectionChange,
  onSyncChange,
  type Peer,
} from '../services/collaboration';

export interface UseCollaborationOptions {
  /** The note to collaborate on */
  note: Note | null;
  /** Whether collaboration is enabled for this note */
  enabled: boolean;
  /** Current user's display name */
  userName?: string;
  /** Callback when content changes from remote peers */
  onRemoteChange?: (content: string) => void;
  /** Debounce time for syncing to database (ms) */
  syncDebounceMs?: number;
}

export interface UseCollaborationResult {
  /** The Yjs document */
  doc: Y.Doc | null;
  /** The Y.Text for the note content */
  yText: Y.Text | null;
  /** The WebSocket provider */
  provider: WebsocketProvider | null;
  /** List of peers currently editing */
  peers: Peer[];
  /** Whether connected to the WebSocket server */
  isConnected: boolean;
  /** Whether local changes are synced with server */
  isSynced: boolean;
  /** Whether collaboration is active */
  isCollaborating: boolean;
  /** Start collaboration session */
  startCollaboration: () => void;
  /** Stop collaboration session */
  stopCollaboration: () => void;
  /** Update local cursor position */
  setCursor: (cursor: { line: number; ch: number } | null) => void;
  /** Update local selection range */
  setSelection: (selection: { from: number; to: number } | null) => void;
}

/**
 * Hook for managing real-time collaboration on a note
 */
export function useCollaboration({
  note,
  enabled,
  userName,
  onRemoteChange,
  syncDebounceMs = 1000,
}: UseCollaborationOptions): UseCollaborationResult {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [yText, setYText] = useState<Y.Text | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [isCollaborating, setIsCollaborating] = useState(false);

  const noteIdRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start collaboration for the current note
  const startCollaboration = useCallback(() => {
    if (!note || !enabled) return;

    // Create Y.Doc
    const yjsDoc = createYDoc(note.id);
    const text = getYText(yjsDoc);

    // Initialize from note content if empty
    initDocFromNote(yjsDoc, note);

    // Connect to WebSocket room
    const wsProvider = connectToRoom(yjsDoc, note.id, userName);

    // Update state
    setDoc(yjsDoc);
    setYText(text);
    setProvider(wsProvider);
    setIsCollaborating(true);
    noteIdRef.current = note.id;

    // Initial peer list
    setPeers(getPeers(note.id));
  }, [note, enabled, userName]);

  // Stop collaboration for the current note
  const stopCollaboration = useCallback(() => {
    if (!noteIdRef.current) return;

    // Clear sync timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    // Disconnect from room (but keep doc for offline editing)
    disconnectFromRoom(noteIdRef.current);

    // Update state
    setProvider(null);
    setPeers([]);
    setIsConnected(false);
    setIsSynced(false);
    setIsCollaborating(false);
  }, []);

  // Subscribe to awareness changes
  useEffect(() => {
    if (!noteIdRef.current || !isCollaborating) return;

    const noteId = noteIdRef.current;

    const unsubAwareness = onAwarenessChange(noteId, (newPeers) => {
      setPeers(newPeers);
    });

    const unsubConnection = onConnectionChange(noteId, (connected) => {
      setIsConnected(connected);
    });

    const unsubSync = onSyncChange(noteId, (synced) => {
      setIsSynced(synced);
    });

    return () => {
      unsubAwareness();
      unsubConnection();
      unsubSync();
    };
  }, [isCollaborating]);

  // Subscribe to Y.Text changes
  useEffect(() => {
    if (!doc || !yText || !noteIdRef.current) return;

    const noteId = noteIdRef.current;

    const observer = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      // Ignore local changes
      if (transaction.local) return;

      // Notify about remote changes
      const content = yText.toString();
      onRemoteChange?.(content);

      // Debounced sync to database
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        syncDocToNote(doc, noteId);
      }, syncDebounceMs);
    };

    yText.observe(observer);

    return () => {
      yText.unobserve(observer);
    };
  }, [doc, yText, onRemoteChange, syncDebounceMs]);

  // Clean up on unmount or note change
  useEffect(() => {
    return () => {
      if (noteIdRef.current) {
        stopCollaboration();
      }
    };
  }, [stopCollaboration]);

  // Handle note change
  useEffect(() => {
    if (note?.id !== noteIdRef.current) {
      // Stop collaboration on previous note
      if (noteIdRef.current) {
        stopCollaboration();
      }

      // Reset state
      setDoc(null);
      setYText(null);
      setProvider(null);
      setPeers([]);
      setIsConnected(false);
      setIsSynced(false);
      setIsCollaborating(false);
      noteIdRef.current = null;
    }
  }, [note?.id, stopCollaboration]);

  // Update cursor position
  const setCursor = useCallback((cursor: { line: number; ch: number } | null) => {
    if (noteIdRef.current) {
      updateCursor(noteIdRef.current, cursor);
    }
  }, []);

  // Update selection range
  const setSelection = useCallback((selection: { from: number; to: number } | null) => {
    if (noteIdRef.current) {
      updateSelection(noteIdRef.current, selection);
    }
  }, []);

  return {
    doc,
    yText,
    provider,
    peers,
    isConnected,
    isSynced,
    isCollaborating,
    startCollaboration,
    stopCollaboration,
    setCursor,
    setSelection,
  };
}

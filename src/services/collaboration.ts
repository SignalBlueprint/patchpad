/**
 * Collaboration Service
 *
 * Provides real-time collaboration using Yjs CRDTs with
 * IndexedDB persistence and WebSocket synchronization.
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import type { Note } from '../types/note';
import { db } from '../db';

// Configuration
const WEBSOCKET_URL = import.meta.env.VITE_YJS_WEBSOCKET_URL || 'wss://demos.yjs.dev';
const INDEXEDDB_PREFIX = 'patchpad-collab-';

/**
 * Map of active Y.Doc instances by note ID
 */
const activeDocuments = new Map<string, Y.Doc>();

/**
 * Map of active WebSocket providers by note ID
 */
const activeProviders = new Map<string, WebsocketProvider>();

/**
 * Map of active IndexedDB persistence instances by note ID
 */
const activePersistence = new Map<string, IndexeddbPersistence>();

/**
 * Peer information for presence awareness
 */
export interface Peer {
  id: string;
  name: string;
  color: string;
  cursor?: { line: number; ch: number };
  selection?: { from: number; to: number };
}

/**
 * Collaboration state for a note
 */
export interface CollaborationState {
  doc: Y.Doc;
  provider: WebsocketProvider | null;
  persistence: IndexeddbPersistence;
  isConnected: boolean;
  isSynced: boolean;
  peers: Peer[];
}

/**
 * Color palette for peer avatars
 */
const PEER_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
];

/**
 * Get a deterministic color for a peer based on their ID
 */
export function getPeerColor(peerId: string): string {
  let hash = 0;
  for (let i = 0; i < peerId.length; i++) {
    hash = ((hash << 5) - hash) + peerId.charCodeAt(i);
    hash |= 0;
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length];
}

/**
 * Create or get a Y.Doc for a note
 * Initializes with IndexedDB persistence for offline support
 */
export function createYDoc(noteId: string): Y.Doc {
  // Return existing doc if already created
  if (activeDocuments.has(noteId)) {
    return activeDocuments.get(noteId)!;
  }

  // Create new Y.Doc
  const doc = new Y.Doc();

  // Set up IndexedDB persistence
  const persistence = new IndexeddbPersistence(`${INDEXEDDB_PREFIX}${noteId}`, doc);

  // Store references
  activeDocuments.set(noteId, doc);
  activePersistence.set(noteId, persistence);

  return doc;
}

/**
 * Get the Y.Text instance for a note's content
 */
export function getYText(doc: Y.Doc): Y.Text {
  return doc.getText('content');
}

/**
 * Connect a Y.Doc to the WebSocket server for real-time sync
 */
export function connectToRoom(
  doc: Y.Doc,
  noteId: string,
  userName?: string
): WebsocketProvider {
  // Return existing provider if already connected
  if (activeProviders.has(noteId)) {
    return activeProviders.get(noteId)!;
  }

  // Create WebSocket provider
  const provider = new WebsocketProvider(
    WEBSOCKET_URL,
    `patchpad-note-${noteId}`,
    doc,
    { connect: true }
  );

  // Set up awareness (presence)
  const awareness = provider.awareness;
  const clientId = awareness.clientID.toString();

  // Set local user state
  awareness.setLocalState({
    user: {
      id: clientId,
      name: userName || `User ${clientId.slice(-4)}`,
      color: getPeerColor(clientId),
    },
    cursor: null,
    selection: null,
  });

  // Store reference
  activeProviders.set(noteId, provider);

  return provider;
}

/**
 * Disconnect from a collaboration room
 */
export function disconnectFromRoom(noteId: string): void {
  const provider = activeProviders.get(noteId);
  if (provider) {
    provider.disconnect();
    provider.destroy();
    activeProviders.delete(noteId);
  }
}

/**
 * Clean up all resources for a note's collaboration session
 */
export function destroyCollaboration(noteId: string): void {
  // Disconnect WebSocket
  disconnectFromRoom(noteId);

  // Destroy persistence
  const persistence = activePersistence.get(noteId);
  if (persistence) {
    persistence.destroy();
    activePersistence.delete(noteId);
  }

  // Destroy doc
  const doc = activeDocuments.get(noteId);
  if (doc) {
    doc.destroy();
    activeDocuments.delete(noteId);
  }
}

/**
 * Sync Y.Doc content to the local database
 * Called on document updates to persist changes
 */
export async function syncDocToNote(doc: Y.Doc, noteId: string): Promise<void> {
  const yText = getYText(doc);
  const content = yText.toString();

  // Update note in database
  const note = await db.notes.get(noteId);
  if (note) {
    await db.notes.update(noteId, {
      content,
      updatedAt: new Date(),
    });
  }
}

/**
 * Initialize Y.Doc content from an existing note
 */
export function initDocFromNote(doc: Y.Doc, note: Note): void {
  const yText = getYText(doc);

  // Only set initial content if doc is empty
  if (yText.length === 0 && note.content) {
    doc.transact(() => {
      yText.insert(0, note.content);
    });
  }
}

/**
 * Get all peers currently in a collaboration room
 */
export function getPeers(noteId: string): Peer[] {
  const provider = activeProviders.get(noteId);
  if (!provider) return [];

  const awareness = provider.awareness;
  const peers: Peer[] = [];

  awareness.getStates().forEach((state, clientId) => {
    if (clientId !== awareness.clientID && state.user) {
      peers.push({
        id: clientId.toString(),
        name: state.user.name || `User ${clientId}`,
        color: state.user.color || getPeerColor(clientId.toString()),
        cursor: state.cursor,
        selection: state.selection,
      });
    }
  });

  return peers;
}

/**
 * Update local cursor position for awareness
 */
export function updateCursor(
  noteId: string,
  cursor: { line: number; ch: number } | null
): void {
  const provider = activeProviders.get(noteId);
  if (!provider) return;

  const awareness = provider.awareness;
  const currentState = awareness.getLocalState() || {};

  awareness.setLocalState({
    ...currentState,
    cursor,
  });
}

/**
 * Update local selection for awareness
 */
export function updateSelection(
  noteId: string,
  selection: { from: number; to: number } | null
): void {
  const provider = activeProviders.get(noteId);
  if (!provider) return;

  const awareness = provider.awareness;
  const currentState = awareness.getLocalState() || {};

  awareness.setLocalState({
    ...currentState,
    selection,
  });
}

/**
 * Check if a note has active collaboration
 */
export function isCollaborating(noteId: string): boolean {
  return activeProviders.has(noteId);
}

/**
 * Check if connected to the WebSocket server
 */
export function isConnected(noteId: string): boolean {
  const provider = activeProviders.get(noteId);
  return provider?.wsconnected ?? false;
}

/**
 * Check if local document is synced with server
 */
export function isSynced(noteId: string): boolean {
  const provider = activeProviders.get(noteId);
  return provider?.synced ?? false;
}

/**
 * Get collaboration state for a note
 */
export function getCollaborationState(noteId: string): CollaborationState | null {
  const doc = activeDocuments.get(noteId);
  const persistence = activePersistence.get(noteId);

  if (!doc || !persistence) return null;

  const provider = activeProviders.get(noteId) || null;

  return {
    doc,
    provider,
    persistence,
    isConnected: provider?.wsconnected ?? false,
    isSynced: provider?.synced ?? false,
    peers: getPeers(noteId),
  };
}

/**
 * Subscribe to awareness changes (peer presence)
 */
export function onAwarenessChange(
  noteId: string,
  callback: (peers: Peer[]) => void
): () => void {
  const provider = activeProviders.get(noteId);
  if (!provider) return () => {};

  const handler = () => {
    callback(getPeers(noteId));
  };

  provider.awareness.on('change', handler);

  return () => {
    provider.awareness.off('change', handler);
  };
}

/**
 * Subscribe to connection status changes
 */
export function onConnectionChange(
  noteId: string,
  callback: (connected: boolean) => void
): () => void {
  const provider = activeProviders.get(noteId);
  if (!provider) return () => {};

  const handler = ({ status }: { status: string }) => {
    callback(status === 'connected');
  };

  provider.on('status', handler);

  return () => {
    provider.off('status', handler);
  };
}

/**
 * Subscribe to sync status changes
 */
export function onSyncChange(
  noteId: string,
  callback: (synced: boolean) => void
): () => void {
  const provider = activeProviders.get(noteId);
  if (!provider) return () => {};

  const handler = (synced: boolean) => {
    callback(synced);
  };

  provider.on('synced', handler);

  return () => {
    provider.off('synced', handler);
  };
}

/**
 * Live Session Broadcasting Service
 *
 * Enables real-time broadcasting of thinking sessions to viewers.
 * Uses WebSocket for live communication and Supabase Realtime for persistence.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ThinkingSession, ThinkingEvent, CanvasSnapshot } from '../types/session';
import { getSupabase } from '../config/supabase';

// Types
export interface BroadcastViewer {
  id: string;
  name: string;
  color: string;
  joinedAt: Date;
}

export interface BroadcastMessage {
  id: string;
  viewerId: string;
  viewerName: string;
  content: string;
  timestamp: Date;
}

export interface BroadcastState {
  sessionId: string;
  hostId: string;
  hostName: string;
  title: string;
  isLive: boolean;
  startedAt: Date;
  viewers: BroadcastViewer[];
  messages: BroadcastMessage[];
  currentSnapshot: CanvasSnapshot;
  eventCount: number;
}

export interface BroadcastOptions {
  sessionTitle: string;
  hostName: string;
  isPublic?: boolean;
}

// Configuration
const WEBSOCKET_URL = import.meta.env.VITE_YJS_WEBSOCKET_URL || 'wss://demos.yjs.dev';
const STORAGE_KEY = 'patchpad_broadcasts';
const MAX_CHAT_MESSAGES = 100;

// Viewer color palette
const VIEWER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9',
];

// Active broadcasts (in-memory)
let activeBroadcast: BroadcastState | null = null;
let websocket: WebSocket | null = null;
let eventListeners = new Map<string, Set<(data: unknown) => void>>();

/**
 * Get a color for a viewer based on their ID
 */
function getViewerColor(viewerId: string): string {
  let hash = 0;
  for (let i = 0; i < viewerId.length; i++) {
    hash = ((hash << 5) - hash) + viewerId.charCodeAt(i);
    hash |= 0;
  }
  return VIEWER_COLORS[Math.abs(hash) % VIEWER_COLORS.length];
}

/**
 * Generate a broadcast URL
 */
export function getBroadcastUrl(sessionId: string): string {
  return `${window.location.origin}/live/${sessionId}`;
}

/**
 * Start broadcasting a session
 */
export function startBroadcast(
  sessionId: string,
  snapshot: CanvasSnapshot,
  options: BroadcastOptions
): BroadcastState {
  if (activeBroadcast) {
    throw new Error('A broadcast is already active');
  }

  const hostId = uuidv4();

  activeBroadcast = {
    sessionId,
    hostId,
    hostName: options.hostName,
    title: options.sessionTitle,
    isLive: true,
    startedAt: new Date(),
    viewers: [],
    messages: [],
    currentSnapshot: snapshot,
    eventCount: 0,
  };

  // Connect to WebSocket for real-time communication
  connectWebSocket(sessionId, hostId, options.hostName, true);

  // Store broadcast info
  saveBroadcast(activeBroadcast);

  // Emit start event
  emit('broadcast-start', activeBroadcast);

  return activeBroadcast;
}

/**
 * Stop the current broadcast
 */
export function stopBroadcast(): BroadcastState | null {
  if (!activeBroadcast) return null;

  activeBroadcast.isLive = false;

  // Notify viewers
  sendWebSocketMessage({
    type: 'broadcast-end',
    sessionId: activeBroadcast.sessionId,
  });

  // Disconnect WebSocket
  disconnectWebSocket();

  // Update stored broadcast
  saveBroadcast(activeBroadcast);

  const broadcast = activeBroadcast;
  activeBroadcast = null;

  emit('broadcast-end', broadcast);

  return broadcast;
}

/**
 * Broadcast a session event to all viewers
 */
export function broadcastEvent(event: ThinkingEvent): void {
  if (!activeBroadcast) return;

  activeBroadcast.eventCount++;

  sendWebSocketMessage({
    type: 'session-event',
    sessionId: activeBroadcast.sessionId,
    event,
  });

  emit('event-broadcast', event);
}

/**
 * Update the canvas snapshot for viewers
 */
export function broadcastSnapshot(snapshot: CanvasSnapshot): void {
  if (!activeBroadcast) return;

  activeBroadcast.currentSnapshot = snapshot;

  sendWebSocketMessage({
    type: 'snapshot-update',
    sessionId: activeBroadcast.sessionId,
    snapshot,
  });
}

/**
 * Send a chat message (host or viewer)
 */
export function sendChatMessage(content: string, viewerId?: string, viewerName?: string): void {
  if (!activeBroadcast) return;

  const message: BroadcastMessage = {
    id: uuidv4(),
    viewerId: viewerId || activeBroadcast.hostId,
    viewerName: viewerName || activeBroadcast.hostName,
    content,
    timestamp: new Date(),
  };

  activeBroadcast.messages.push(message);

  // Trim old messages
  if (activeBroadcast.messages.length > MAX_CHAT_MESSAGES) {
    activeBroadcast.messages = activeBroadcast.messages.slice(-MAX_CHAT_MESSAGES);
  }

  sendWebSocketMessage({
    type: 'chat-message',
    sessionId: activeBroadcast.sessionId,
    message,
  });

  emit('chat-message', message);
}

/**
 * Join a broadcast as a viewer
 */
export async function joinBroadcast(
  sessionId: string,
  viewerName: string
): Promise<BroadcastState | null> {
  const viewerId = uuidv4();
  const color = getViewerColor(viewerId);

  // Connect to WebSocket
  connectWebSocket(sessionId, viewerId, viewerName, false);

  // Request current state from host
  sendWebSocketMessage({
    type: 'viewer-join',
    sessionId,
    viewer: {
      id: viewerId,
      name: viewerName,
      color,
      joinedAt: new Date(),
    },
  });

  // Wait for state from host (with timeout)
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null);
    }, 5000);

    const unsubscribe = on('state-received', (state) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(state as BroadcastState);
    });
  });
}

/**
 * Leave a broadcast as a viewer
 */
export function leaveBroadcast(viewerId: string): void {
  sendWebSocketMessage({
    type: 'viewer-leave',
    viewerId,
  });

  disconnectWebSocket();
}

/**
 * Check if a broadcast is active
 */
export function isBroadcasting(): boolean {
  return activeBroadcast !== null && activeBroadcast.isLive;
}

/**
 * Get the active broadcast state
 */
export function getActiveBroadcast(): BroadcastState | null {
  return activeBroadcast;
}

/**
 * Get stored broadcasts
 */
export function getStoredBroadcasts(): BroadcastState[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((b: Record<string, unknown>) => ({
        ...b,
        startedAt: new Date(b.startedAt as string),
        viewers: (b.viewers as BroadcastViewer[])?.map(v => ({
          ...v,
          joinedAt: new Date(v.joinedAt),
        })) || [],
        messages: (b.messages as BroadcastMessage[])?.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })) || [],
      }));
    }
  } catch (error) {
    console.error('Failed to load broadcasts:', error);
  }
  return [];
}

/**
 * Save broadcast to storage
 */
function saveBroadcast(broadcast: BroadcastState): void {
  try {
    const broadcasts = getStoredBroadcasts();
    const index = broadcasts.findIndex(b => b.sessionId === broadcast.sessionId);
    if (index >= 0) {
      broadcasts[index] = broadcast;
    } else {
      broadcasts.unshift(broadcast);
    }
    // Keep only last 20 broadcasts
    localStorage.setItem(STORAGE_KEY, JSON.stringify(broadcasts.slice(0, 20)));
  } catch (error) {
    console.error('Failed to save broadcast:', error);
  }
}

// WebSocket management
function connectWebSocket(
  sessionId: string,
  peerId: string,
  peerName: string,
  isHost: boolean
): void {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    return;
  }

  const roomName = `patchpad-broadcast-${sessionId}`;

  try {
    // Try Supabase Realtime first, fall back to demo server
    const supabase = getSupabase();
    if (supabase) {
      // Use Supabase Realtime
      const channel = supabase.channel(roomName);

      channel
        .on('broadcast', { event: 'message' }, (payload) => {
          handleWebSocketMessage(payload.payload as Record<string, unknown>);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            emit('connected', { sessionId, isHost });
          }
        });

      // Store channel reference for cleanup
      (window as unknown as { __broadcastChannel?: typeof channel }).__broadcastChannel = channel;
    } else {
      // Use demo WebSocket server
      websocket = new WebSocket(`${WEBSOCKET_URL}/${roomName}`);

      websocket.onopen = () => {
        // Send join message
        sendWebSocketMessage({
          type: isHost ? 'host-connect' : 'viewer-connect',
          sessionId,
          peerId,
          peerName,
        });
        emit('connected', { sessionId, isHost });
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        emit('disconnected', { sessionId });
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        emit('error', { sessionId, error });
      };
    }
  } catch (error) {
    console.error('Failed to connect WebSocket:', error);
    emit('error', { sessionId, error });
  }
}

function disconnectWebSocket(): void {
  if (websocket) {
    websocket.close();
    websocket = null;
  }

  // Also disconnect Supabase channel if used
  const channel = (window as unknown as { __broadcastChannel?: { unsubscribe: () => void } }).__broadcastChannel;
  if (channel) {
    channel.unsubscribe();
    delete (window as unknown as { __broadcastChannel?: unknown }).__broadcastChannel;
  }
}

function sendWebSocketMessage(data: Record<string, unknown>): void {
  const supabase = getSupabase();
  const channel = (window as unknown as { __broadcastChannel?: { send: (args: { type: string; event: string; payload: Record<string, unknown> }) => void } }).__broadcastChannel;

  if (channel) {
    // Use Supabase Realtime
    channel.send({
      type: 'broadcast',
      event: 'message',
      payload: data,
    });
  } else if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify(data));
  }
}

function handleWebSocketMessage(data: Record<string, unknown>): void {
  switch (data.type) {
    case 'viewer-join':
      if (activeBroadcast) {
        const viewer = data.viewer as BroadcastViewer;
        activeBroadcast.viewers.push(viewer);
        emit('viewer-join', viewer);

        // Send current state to new viewer
        if (activeBroadcast.hostId) {
          sendWebSocketMessage({
            type: 'state-sync',
            state: activeBroadcast,
          });
        }
      }
      break;

    case 'viewer-leave':
      if (activeBroadcast) {
        const viewerId = data.viewerId as string;
        activeBroadcast.viewers = activeBroadcast.viewers.filter(v => v.id !== viewerId);
        emit('viewer-leave', { viewerId });
      }
      break;

    case 'state-sync':
      emit('state-received', data.state);
      break;

    case 'session-event':
      emit('session-event', data.event);
      break;

    case 'snapshot-update':
      emit('snapshot-update', data.snapshot);
      break;

    case 'chat-message':
      if (activeBroadcast) {
        const message = data.message as BroadcastMessage;
        activeBroadcast.messages.push(message);
        emit('chat-message', message);
      }
      break;

    case 'broadcast-end':
      emit('broadcast-end', data);
      disconnectWebSocket();
      break;

    default:
      console.warn('Unknown broadcast message type:', data.type);
  }
}

// Event emitter
function emit(event: string, data: unknown): void {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach(callback => callback(data));
  }
}

/**
 * Subscribe to broadcast events
 */
export function on(event: string, callback: (data: unknown) => void): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback);

  return () => {
    eventListeners.get(event)?.delete(callback);
  };
}

/**
 * Check if live broadcasting is available
 */
export function isLiveBroadcastingAvailable(): boolean {
  // Available with WebSocket fallback
  return true;
}

/**
 * Get live broadcast statistics
 */
export function getBroadcastStats(): {
  totalBroadcasts: number;
  totalViewers: number;
  totalMessages: number;
} {
  const broadcasts = getStoredBroadcasts();
  return {
    totalBroadcasts: broadcasts.length,
    totalViewers: broadcasts.reduce((sum, b) => sum + (b.viewers?.length || 0), 0),
    totalMessages: broadcasts.reduce((sum, b) => sum + (b.messages?.length || 0), 0),
  };
}

/**
 * SQL for creating broadcast tables in Supabase
 */
export const BROADCAST_SQL = `
-- Live broadcasts table
CREATE TABLE IF NOT EXISTS live_broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  title TEXT NOT NULL,
  is_live BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  viewer_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Broadcast messages table
CREATE TABLE IF NOT EXISTS broadcast_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID REFERENCES live_broadcasts(id) ON DELETE CASCADE NOT NULL,
  viewer_id TEXT NOT NULL,
  viewer_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS live_broadcasts_session_id_idx ON live_broadcasts(session_id);
CREATE INDEX IF NOT EXISTS live_broadcasts_is_live_idx ON live_broadcasts(is_live);
CREATE INDEX IF NOT EXISTS broadcast_messages_broadcast_id_idx ON broadcast_messages(broadcast_id);

-- Row Level Security
ALTER TABLE live_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can view live broadcasts
CREATE POLICY "Anyone can view live broadcasts" ON live_broadcasts
  FOR SELECT USING (is_public = true AND is_live = true);

-- Host can manage their broadcasts
CREATE POLICY "Host can manage broadcasts" ON live_broadcasts
  FOR ALL USING (auth.uid()::text = host_id);

-- Anyone can insert messages to live broadcasts
CREATE POLICY "Anyone can send messages" ON broadcast_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM live_broadcasts
      WHERE id = broadcast_id AND is_live = true
    )
  );

-- Anyone can view messages
CREATE POLICY "Anyone can view messages" ON broadcast_messages
  FOR SELECT USING (true);
`;

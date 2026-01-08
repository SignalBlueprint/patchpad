/**
 * Session Recorder Service
 *
 * Records user activity on the canvas as a temporal trace.
 * Events are buffered in memory and periodically flushed to IndexedDB.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ThinkingSession,
  ThinkingEvent,
  ThinkingEventType,
  ThinkingEventPayload,
  CanvasSnapshot,
  SessionAnnotation,
  SessionStats,
} from '../types/session';

const SESSIONS_STORAGE_KEY = 'patchpad_sessions';
const ACTIVE_SESSION_KEY = 'patchpad_active_session';
const EVENT_DEBOUNCE_MS = 100;
const FLUSH_INTERVAL_MS = 30000; // Flush to storage every 30 seconds

// In-memory state
let sessionsCache: ThinkingSession[] | null = null;
let activeSession: ThinkingSession | null = null;
let eventBuffer: ThinkingEvent[] = [];
let lastEventTime: Record<string, number> = {};
let flushInterval: NodeJS.Timeout | null = null;
let sessionStartTime: number = 0;

// Event listeners for external components
type SessionEventListener = (session: ThinkingSession) => void;
const eventListeners = new Map<string, Set<SessionEventListener>>();

/**
 * Get all sessions from storage
 */
export function getAllSessions(): ThinkingSession[] {
  if (sessionsCache) return sessionsCache;

  try {
    const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      sessionsCache = parsed.map((s: Record<string, unknown>) => ({
        ...s,
        startedAt: new Date(s.startedAt as string),
        endedAt: s.endedAt ? new Date(s.endedAt as string) : null,
        annotations: (s.annotations as SessionAnnotation[])?.map((a) => ({
          ...a,
          createdAt: new Date(a.createdAt),
        })) || [],
      }));
      return sessionsCache!;
    }
  } catch (error) {
    console.error('Failed to load sessions:', error);
  }

  sessionsCache = [];
  return sessionsCache;
}

/**
 * Save sessions to storage
 */
function saveSessions(sessions: ThinkingSession[]): void {
  sessionsCache = sessions;
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save sessions:', error);
  }
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): ThinkingSession | null {
  return getAllSessions().find((s) => s.id === sessionId) || null;
}

/**
 * Check if a session is currently being recorded
 */
export function isRecording(): boolean {
  return activeSession !== null;
}

/**
 * Get the active recording session
 */
export function getActiveSession(): ThinkingSession | null {
  return activeSession;
}

interface StartRecordingOptions {
  title?: string;
  templateId?: string;
  templateName?: string;
  autoTags?: string[];
}

/**
 * Start recording a new session
 */
export function startRecording(
  canvasSnapshot: CanvasSnapshot,
  options?: StartRecordingOptions | string // Support legacy string title
): string {
  if (activeSession) {
    throw new Error('A session is already being recorded');
  }

  // Handle legacy string title argument
  const opts: StartRecordingOptions =
    typeof options === 'string' ? { title: options } : options || {};

  const sessionId = uuidv4();
  sessionStartTime = Date.now();

  activeSession = {
    id: sessionId,
    title: opts.title || `Session ${new Date().toLocaleString()}`,
    canvasSnapshot,
    events: [],
    annotations: [],
    startedAt: new Date(),
    endedAt: null,
    durationMs: 0,
    createdNoteIds: [],
    modifiedNoteIds: [],
    tags: opts.autoTags || [],
    templateId: opts.templateId,
    templateName: opts.templateName,
    currentWorkflowStep: opts.templateId ? 0 : undefined,
  };

  eventBuffer = [];
  lastEventTime = {};

  // Start periodic flush
  flushInterval = setInterval(flushEvents, FLUSH_INTERVAL_MS);

  // Persist active session marker
  localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);

  emitEvent('start', activeSession);

  return sessionId;
}

/**
 * Stop recording and save the session
 */
export function stopRecording(): ThinkingSession | null {
  if (!activeSession) return null;

  // Flush any remaining events
  flushEvents();

  // Stop periodic flush
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }

  // Finalize session
  activeSession.endedAt = new Date();
  activeSession.durationMs = Date.now() - sessionStartTime;

  // Save to storage
  const sessions = getAllSessions();
  sessions.unshift(activeSession);
  saveSessions(sessions);

  // Clear active session marker
  localStorage.removeItem(ACTIVE_SESSION_KEY);

  const completedSession = activeSession;
  activeSession = null;
  eventBuffer = [];

  emitEvent('stop', completedSession);

  return completedSession;
}

/**
 * Record an event
 */
export function recordEvent(
  type: ThinkingEventType,
  payload: ThinkingEventPayload
): void {
  if (!activeSession) return;

  const now = Date.now();
  const eventKey = `${type}:${JSON.stringify(payload).slice(0, 50)}`;

  // Debounce rapid events of the same type
  if (lastEventTime[eventKey] && now - lastEventTime[eventKey] < EVENT_DEBOUNCE_MS) {
    return;
  }
  lastEventTime[eventKey] = now;

  const event: ThinkingEvent = {
    type,
    timestamp: now - sessionStartTime,
    payload,
  };

  eventBuffer.push(event);

  // Track affected notes
  if ('noteId' in payload) {
    const noteId = (payload as { noteId: string }).noteId;
    if (type === 'note-create') {
      if (!activeSession.createdNoteIds.includes(noteId)) {
        activeSession.createdNoteIds.push(noteId);
      }
    } else if (type !== 'note-delete') {
      if (!activeSession.modifiedNoteIds.includes(noteId)) {
        activeSession.modifiedNoteIds.push(noteId);
      }
    }
  }

  emitEvent('event', activeSession);
}

/**
 * Flush buffered events to storage
 */
function flushEvents(): void {
  if (!activeSession || eventBuffer.length === 0) return;

  activeSession.events.push(...eventBuffer);
  activeSession.durationMs = Date.now() - sessionStartTime;
  eventBuffer = [];

  // Save active session state
  const sessions = getAllSessions();
  const index = sessions.findIndex((s) => s.id === activeSession!.id);
  if (index >= 0) {
    sessions[index] = activeSession;
  } else {
    sessions.unshift(activeSession);
  }
  saveSessions(sessions);
}

/**
 * Add an annotation to the current session
 */
export function addAnnotation(
  type: 'note' | 'highlight' | 'voice',
  content: string,
  canvasPosition?: { x: number; y: number }
): SessionAnnotation | null {
  if (!activeSession) return null;

  const annotation: SessionAnnotation = {
    id: uuidv4(),
    timestamp: Date.now() - sessionStartTime,
    type,
    content,
    canvasPosition,
    createdAt: new Date(),
  };

  activeSession.annotations.push(annotation);
  flushEvents(); // Save immediately

  return annotation;
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): boolean {
  const sessions = getAllSessions();
  const index = sessions.findIndex((s) => s.id === sessionId);

  if (index === -1) return false;

  sessions.splice(index, 1);
  saveSessions(sessions);

  return true;
}

/**
 * Update session title, tags, or workflow step
 */
export function updateSession(
  sessionId: string,
  updates: Partial<Pick<ThinkingSession, 'title' | 'tags' | 'currentWorkflowStep'>>
): ThinkingSession | null {
  const sessions = getAllSessions();
  const index = sessions.findIndex((s) => s.id === sessionId);

  if (index === -1) return null;

  sessions[index] = { ...sessions[index], ...updates };
  saveSessions(sessions);

  // Also update active session if it matches
  if (activeSession && activeSession.id === sessionId) {
    activeSession = { ...activeSession, ...updates };
  }

  return sessions[index];
}

/**
 * Update the current workflow step for the active session
 */
export function updateWorkflowStep(stepIndex: number): void {
  if (!activeSession) return;
  activeSession.currentWorkflowStep = stepIndex;
  flushEvents(); // Persist change
}

/**
 * Get session statistics
 */
export function getSessionStats(session: ThinkingSession): SessionStats {
  const events = session.events;

  return {
    totalEvents: events.length,
    notesMoved: events.filter((e) => e.type === 'note-move').length,
    notesCreated: events.filter((e) => e.type === 'note-create').length,
    notesEdited: events.filter((e) => e.type === 'note-edit').length,
    connectionsCreated: events.filter((e) => e.type === 'note-connect').length,
    aiQueries: events.filter((e) => e.type === 'ai-query').length,
    durationMs: session.durationMs,
  };
}

/**
 * Subscribe to session events
 */
export function onSessionEvent(
  eventType: 'start' | 'stop' | 'event',
  callback: SessionEventListener
): () => void {
  if (!eventListeners.has(eventType)) {
    eventListeners.set(eventType, new Set());
  }
  eventListeners.get(eventType)!.add(callback);

  return () => {
    eventListeners.get(eventType)?.delete(callback);
  };
}

/**
 * Emit session event to listeners
 */
function emitEvent(
  eventType: 'start' | 'stop' | 'event',
  session: ThinkingSession
): void {
  const listeners = eventListeners.get(eventType);
  if (listeners) {
    listeners.forEach((callback) => callback(session));
  }
}

/**
 * Recover any active session from a previous crash
 */
export function recoverActiveSession(): ThinkingSession | null {
  const activeSessionId = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!activeSessionId) return null;

  const session = getSession(activeSessionId);
  if (session && !session.endedAt) {
    // Session was active when app crashed - finalize it
    session.endedAt = new Date();
    session.durationMs = session.events.length > 0
      ? session.events[session.events.length - 1].timestamp
      : 0;

    const sessions = getAllSessions();
    const index = sessions.findIndex((s) => s.id === activeSessionId);
    if (index >= 0) {
      sessions[index] = session;
      saveSessions(sessions);
    }

    localStorage.removeItem(ACTIVE_SESSION_KEY);
    return session;
  }

  localStorage.removeItem(ACTIVE_SESSION_KEY);
  return null;
}

/**
 * Export session as JSON
 */
export function exportSessionAsJSON(session: ThinkingSession): string {
  return JSON.stringify(session, null, 2);
}

/**
 * Import session from JSON
 */
export function importSessionFromJSON(json: string): ThinkingSession | null {
  try {
    const parsed = JSON.parse(json);
    const session: ThinkingSession = {
      ...parsed,
      id: uuidv4(), // Generate new ID to avoid conflicts
      startedAt: new Date(parsed.startedAt),
      endedAt: parsed.endedAt ? new Date(parsed.endedAt) : null,
      annotations: parsed.annotations?.map((a: SessionAnnotation) => ({
        ...a,
        createdAt: new Date(a.createdAt),
      })) || [],
    };

    const sessions = getAllSessions();
    sessions.unshift(session);
    saveSessions(sessions);

    return session;
  } catch (error) {
    console.error('Failed to import session:', error);
    return null;
  }
}

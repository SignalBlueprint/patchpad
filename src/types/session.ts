/**
 * Session Recording Types
 *
 * Types for recording and replaying thinking sessions on the canvas.
 */

export type ThinkingEventType =
  | 'note-move'
  | 'note-create'
  | 'note-edit'
  | 'note-delete'
  | 'note-connect'
  | 'viewport-change'
  | 'ai-query'
  | 'ai-response'
  | 'selection-change';

export interface ThinkingEvent {
  type: ThinkingEventType;
  /** Milliseconds since session start */
  timestamp: number;
  /** Type-specific data */
  payload: ThinkingEventPayload;
}

export type ThinkingEventPayload =
  | NoteMovePayload
  | NoteCreatePayload
  | NoteEditPayload
  | NoteDeletePayload
  | NoteConnectPayload
  | ViewportChangePayload
  | AIQueryPayload
  | AIResponsePayload
  | SelectionChangePayload;

export interface NoteMovePayload {
  noteId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface NoteCreatePayload {
  noteId: string;
  title: string;
  x: number;
  y: number;
}

export interface NoteEditPayload {
  noteId: string;
  oldTitle: string;
  newTitle: string;
  /** Character count change */
  contentDelta: number;
}

export interface NoteDeletePayload {
  noteId: string;
  title: string;
}

export interface NoteConnectPayload {
  sourceNoteId: string;
  targetNoteId: string;
  sourceTite: string;
  targetTitle: string;
}

export interface ViewportChangePayload {
  x: number;
  y: number;
  zoom: number;
}

export interface AIQueryPayload {
  query: string;
  context?: string;
}

export interface AIResponsePayload {
  response: string;
  citations?: string[];
}

export interface SelectionChangePayload {
  noteIds: string[];
}

export interface CanvasSnapshot {
  /** Note positions at start of session */
  positions: Record<string, { x: number; y: number; width: number; height: number }>;
  /** Viewport state */
  viewport: { x: number; y: number; zoom: number };
  /** Note IDs that existed at session start */
  existingNoteIds: string[];
}

export interface SessionAnnotation {
  id: string;
  /** Milliseconds since session start */
  timestamp: number;
  type: 'note' | 'highlight' | 'voice';
  content: string;
  /** Canvas position if spatially anchored */
  canvasPosition?: { x: number; y: number };
  createdAt: Date;
}

export interface ThinkingSession {
  id: string;
  title: string;
  /** Initial canvas state */
  canvasSnapshot: CanvasSnapshot;
  /** Recorded events */
  events: ThinkingEvent[];
  /** User annotations */
  annotations: SessionAnnotation[];
  /** Session start time */
  startedAt: Date;
  /** Session end time (null if still recording) */
  endedAt: Date | null;
  /** Total duration in ms */
  durationMs: number;
  /** Notes created during session */
  createdNoteIds: string[];
  /** Notes modified during session */
  modifiedNoteIds: string[];
  /** Tags for organization */
  tags: string[];
  /** Template used for this session (if any) */
  templateId?: string;
  /** Template name at time of recording */
  templateName?: string;
  /** Current workflow step index (for ongoing sessions) */
  currentWorkflowStep?: number;
}

export interface SessionStats {
  totalEvents: number;
  notesMoved: number;
  notesCreated: number;
  notesEdited: number;
  connectionsCreated: number;
  aiQueries: number;
  durationMs: number;
}

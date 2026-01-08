/**
 * Session Playback Service
 *
 * Replays thinking sessions as animated visualizations.
 * Uses requestAnimationFrame for smooth playback.
 */

import type {
  ThinkingSession,
  ThinkingEvent,
  CanvasSnapshot,
  NoteMovePayload,
  NoteCreatePayload,
  ViewportChangePayload,
} from '../types/session';

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface PlaybackPosition {
  currentTime: number;
  totalTime: number;
  eventIndex: number;
  totalEvents: number;
  progress: number;
}

export interface PlaybackCallbacks {
  onStateChange?: (state: PlaybackState) => void;
  onPositionChange?: (position: PlaybackPosition) => void;
  onEvent?: (event: ThinkingEvent) => void;
  onNoteMove?: (noteId: string, x: number, y: number) => void;
  onNoteCreate?: (noteId: string, title: string, x: number, y: number) => void;
  onNoteDelete?: (noteId: string) => void;
  onViewportChange?: (x: number, y: number, zoom: number) => void;
  onAnnotation?: (timestamp: number, content: string) => void;
}

export class SessionPlayer {
  private session: ThinkingSession;
  private callbacks: PlaybackCallbacks;
  private state: PlaybackState = 'stopped';
  private currentTime: number = 0;
  private eventIndex: number = 0;
  private speed: number = 1;
  private lastFrameTime: number = 0;
  private animationFrameId: number | null = null;

  constructor(session: ThinkingSession, callbacks: PlaybackCallbacks = {}) {
    this.session = session;
    this.callbacks = callbacks;
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * Get current position
   */
  getPosition(): PlaybackPosition {
    return {
      currentTime: this.currentTime,
      totalTime: this.session.durationMs,
      eventIndex: this.eventIndex,
      totalEvents: this.session.events.length,
      progress: this.session.durationMs > 0
        ? this.currentTime / this.session.durationMs
        : 0,
    };
  }

  /**
   * Get initial canvas snapshot
   */
  getInitialSnapshot(): CanvasSnapshot {
    return this.session.canvasSnapshot;
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(4, speed));
  }

  /**
   * Get playback speed
   */
  getSpeed(): number {
    return this.speed;
  }

  /**
   * Start playback
   */
  play(): void {
    if (this.state === 'playing') return;

    this.state = 'playing';
    this.lastFrameTime = performance.now();
    this.callbacks.onStateChange?.(this.state);
    this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.state !== 'playing') return;

    this.state = 'paused';
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.callbacks.onStateChange?.(this.state);
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.state = 'stopped';
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.currentTime = 0;
    this.eventIndex = 0;
    this.callbacks.onStateChange?.(this.state);
    this.emitPosition();
  }

  /**
   * Seek to a specific time
   */
  seek(timeMs: number): void {
    const targetTime = Math.max(0, Math.min(this.session.durationMs, timeMs));

    if (targetTime < this.currentTime) {
      // Seeking backwards - reset and replay to target
      this.currentTime = 0;
      this.eventIndex = 0;
    }

    // Fast-forward to target time
    while (
      this.eventIndex < this.session.events.length &&
      this.session.events[this.eventIndex].timestamp <= targetTime
    ) {
      this.processEvent(this.session.events[this.eventIndex]);
      this.eventIndex++;
    }

    this.currentTime = targetTime;
    this.emitPosition();
  }

  /**
   * Seek to progress (0-1)
   */
  seekToProgress(progress: number): void {
    this.seek(progress * this.session.durationMs);
  }

  /**
   * Skip to next event
   */
  nextEvent(): void {
    if (this.eventIndex < this.session.events.length) {
      const event = this.session.events[this.eventIndex];
      this.currentTime = event.timestamp;
      this.processEvent(event);
      this.eventIndex++;
      this.emitPosition();
    }
  }

  /**
   * Skip to previous event
   */
  previousEvent(): void {
    if (this.eventIndex > 1) {
      this.eventIndex -= 2;
      const event = this.session.events[this.eventIndex];
      this.currentTime = event.timestamp;
      // Need to replay from beginning to get correct state
      this.seek(this.currentTime);
    } else if (this.eventIndex === 1) {
      this.currentTime = 0;
      this.eventIndex = 0;
      this.emitPosition();
    }
  }

  /**
   * Main animation tick
   */
  private tick(currentFrameTime: number): void {
    if (this.state !== 'playing') return;

    const deltaTime = (currentFrameTime - this.lastFrameTime) * this.speed;
    this.lastFrameTime = currentFrameTime;
    this.currentTime += deltaTime;

    // Process events up to current time
    while (
      this.eventIndex < this.session.events.length &&
      this.session.events[this.eventIndex].timestamp <= this.currentTime
    ) {
      this.processEvent(this.session.events[this.eventIndex]);
      this.eventIndex++;
    }

    // Check for annotations to display
    for (const annotation of this.session.annotations) {
      // Show annotations within a 1-second window
      if (
        annotation.timestamp >= this.currentTime - 500 &&
        annotation.timestamp <= this.currentTime + 500
      ) {
        this.callbacks.onAnnotation?.(annotation.timestamp, annotation.content);
      }
    }

    this.emitPosition();

    // Check if playback is complete
    if (this.currentTime >= this.session.durationMs) {
      this.state = 'stopped';
      this.callbacks.onStateChange?.(this.state);
      return;
    }

    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
  }

  /**
   * Process a single event
   */
  private processEvent(event: ThinkingEvent): void {
    this.callbacks.onEvent?.(event);

    switch (event.type) {
      case 'note-move': {
        const payload = event.payload as NoteMovePayload;
        this.callbacks.onNoteMove?.(payload.noteId, payload.toX, payload.toY);
        break;
      }
      case 'note-create': {
        const payload = event.payload as NoteCreatePayload;
        this.callbacks.onNoteCreate?.(
          payload.noteId,
          payload.title,
          payload.x,
          payload.y
        );
        break;
      }
      case 'note-delete': {
        const payload = event.payload as { noteId: string };
        this.callbacks.onNoteDelete?.(payload.noteId);
        break;
      }
      case 'viewport-change': {
        const payload = event.payload as ViewportChangePayload;
        this.callbacks.onViewportChange?.(payload.x, payload.y, payload.zoom);
        break;
      }
    }
  }

  /**
   * Emit position update to callback
   */
  private emitPosition(): void {
    this.callbacks.onPositionChange?.(this.getPosition());
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
  }
}

/**
 * Format duration in MM:SS format
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get events at a specific time
 */
export function getEventsAtTime(
  session: ThinkingSession,
  timeMs: number,
  windowMs: number = 1000
): ThinkingEvent[] {
  return session.events.filter(
    (e) => e.timestamp >= timeMs - windowMs && e.timestamp <= timeMs + windowMs
  );
}

/**
 * Get event density for timeline visualization
 */
export function getEventDensity(
  session: ThinkingSession,
  bucketCount: number = 100
): number[] {
  if (session.durationMs === 0 || session.events.length === 0) {
    return new Array(bucketCount).fill(0);
  }

  const bucketSize = session.durationMs / bucketCount;
  const density = new Array(bucketCount).fill(0);

  for (const event of session.events) {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.floor(event.timestamp / bucketSize)
    );
    density[bucketIndex]++;
  }

  // Normalize to 0-1
  const maxDensity = Math.max(...density, 1);
  return density.map((d) => d / maxDensity);
}

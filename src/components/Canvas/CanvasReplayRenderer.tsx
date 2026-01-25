/**
 * Canvas Replay Renderer Component
 *
 * Visualizes session playback with note movements and AI interactions.
 * Displays a miniature canvas view that animates based on session events.
 */

import { useState, useEffect, useMemo } from 'react';
import type { ThinkingSession, ThinkingEvent } from '../../types/session';
import type { CanvasPosition } from '../../types/note';

interface CanvasReplayRendererProps {
  session: ThinkingSession;
  currentEvent: ThinkingEvent | null;
  currentTime: number;
  progress: number;
}

interface ReplayNote {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isNew?: boolean;
  isDeleted?: boolean;
  isMoving?: boolean;
}

interface ReplayViewport {
  x: number;
  y: number;
  zoom: number;
}

export function CanvasReplayRenderer({
  session,
  currentEvent,
  currentTime,
  progress,
}: CanvasReplayRendererProps) {
  const [notes, setNotes] = useState<Map<string, ReplayNote>>(new Map());
  const [viewport, setViewport] = useState<ReplayViewport>({
    x: session.canvasSnapshot.viewport.x,
    y: session.canvasSnapshot.viewport.y,
    zoom: session.canvasSnapshot.viewport.zoom,
  });
  const [aiActivity, setAiActivity] = useState<string | null>(null);

  // Initialize notes from canvas snapshot
  useEffect(() => {
    const initialNotes = new Map<string, ReplayNote>();

    // Load all existing notes from snapshot
    for (const noteId of session.canvasSnapshot.existingNoteIds) {
      const position = session.canvasSnapshot.positions[noteId];
      if (position) {
        initialNotes.set(noteId, {
          id: noteId,
          title: noteId.slice(0, 8), // Abbreviated ID for display
          x: position.x,
          y: position.y,
          width: position.width,
          height: position.height,
        });
      }
    }

    setNotes(initialNotes);
    setViewport({
      x: session.canvasSnapshot.viewport.x,
      y: session.canvasSnapshot.viewport.y,
      zoom: session.canvasSnapshot.viewport.zoom,
    });
  }, [session]);

  // Process events up to current time
  useEffect(() => {
    if (!currentEvent) return;

    const newNotes = new Map(notes);

    switch (currentEvent.type) {
      case 'note-create': {
        const payload = currentEvent.payload as any;
        newNotes.set(payload.noteId, {
          id: payload.noteId,
          title: payload.title || payload.noteId.slice(0, 8),
          x: payload.x || 0,
          y: payload.y || 0,
          width: 200,
          height: 150,
          isNew: true,
        });
        setNotes(newNotes);

        // Clear isNew flag after animation
        setTimeout(() => {
          const updated = new Map(newNotes);
          const note = updated.get(payload.noteId);
          if (note) {
            note.isNew = false;
            setNotes(updated);
          }
        }, 500);
        break;
      }

      case 'note-move': {
        const payload = currentEvent.payload as any;
        const note = newNotes.get(payload.noteId);
        if (note) {
          note.x = payload.toX;
          note.y = payload.toY;
          note.isMoving = true;
          setNotes(new Map(newNotes));

          // Clear isMoving flag after animation
          setTimeout(() => {
            const updated = new Map(newNotes);
            const movedNote = updated.get(payload.noteId);
            if (movedNote) {
              movedNote.isMoving = false;
              setNotes(updated);
            }
          }, 300);
        }
        break;
      }

      case 'note-delete': {
        const payload = currentEvent.payload as any;
        const note = newNotes.get(payload.noteId);
        if (note) {
          note.isDeleted = true;
          setNotes(new Map(newNotes));

          // Actually remove after animation
          setTimeout(() => {
            const updated = new Map(newNotes);
            updated.delete(payload.noteId);
            setNotes(updated);
          }, 500);
        }
        break;
      }

      case 'viewport-change': {
        const payload = currentEvent.payload as any;
        setViewport({
          x: payload.x,
          y: payload.y,
          zoom: payload.zoom,
        });
        break;
      }

      case 'ai-query': {
        const payload = currentEvent.payload as any;
        setAiActivity(`🤖 ${payload.query?.slice(0, 50) || 'AI Query'}...`);
        setTimeout(() => setAiActivity(null), 2000);
        break;
      }

      case 'ai-response': {
        setAiActivity('💬 AI Response');
        setTimeout(() => setAiActivity(null), 2000);
        break;
      }
    }
  }, [currentEvent, currentTime]);

  // Calculate canvas bounds for viewport
  const canvasBounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    notes.forEach(note => {
      minX = Math.min(minX, note.x);
      minY = Math.min(minY, note.y);
      maxX = Math.max(maxX, note.x + note.width);
      maxY = Math.max(maxY, note.y + note.height);
    });

    // Add padding
    const padding = 100;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Fallback for empty canvas
    if (!isFinite(minX)) {
      minX = -500;
      minY = -500;
      maxX = 500;
      maxY = 500;
    }

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }, [notes]);

  // Transform note position to SVG coordinates
  const transformX = (x: number) => {
    return ((x - canvasBounds.minX) / canvasBounds.width) * 100;
  };

  const transformY = (y: number) => {
    return ((y - canvasBounds.minY) / canvasBounds.height) * 100;
  };

  const transformWidth = (w: number) => {
    return (w / canvasBounds.width) * 100;
  };

  const transformHeight = (h: number) => {
    return (h / canvasBounds.height) * 100;
  };

  return (
    <div className="relative w-full h-64 bg-neutral-50 rounded-lg border border-neutral-200 overflow-hidden">
      {/* AI Activity Indicator */}
      {aiActivity && (
        <div className="absolute top-2 left-2 px-3 py-1 bg-primary-500 text-white text-sm rounded-full shadow-lg z-10 animate-pulse">
          {aiActivity}
        </div>
      )}

      {/* Canvas Stats */}
      <div className="absolute top-2 right-2 text-xs text-neutral-500 bg-white/80 px-2 py-1 rounded">
        {notes.size} notes • Zoom: {viewport.zoom.toFixed(2)}x
      </div>

      {/* Canvas SVG */}
      <svg
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background grid */}
        <defs>
          <pattern
            id="grid"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 10 0 L 0 0 0 10"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="0.1"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />

        {/* Viewport indicator */}
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="0.5"
          strokeDasharray="2,2"
          opacity="0.3"
        />

        {/* Notes */}
        {Array.from(notes.values()).map((note) => (
          <g key={note.id}>
            {/* Note shadow */}
            <rect
              x={transformX(note.x) + 0.5}
              y={transformY(note.y) + 0.5}
              width={transformWidth(note.width)}
              height={transformHeight(note.height)}
              fill="rgba(0,0,0,0.1)"
              rx="0.5"
            />

            {/* Note body */}
            <rect
              x={transformX(note.x)}
              y={transformY(note.y)}
              width={transformWidth(note.width)}
              height={transformHeight(note.height)}
              fill={note.isNew ? '#dbeafe' : note.isDeleted ? '#fecaca' : '#fef3c7'}
              stroke={note.isMoving ? '#3b82f6' : '#d1d5db'}
              strokeWidth={note.isMoving ? '0.5' : '0.2'}
              rx="0.5"
              className={`
                ${note.isNew ? 'animate-pulse' : ''}
                ${note.isDeleted ? 'opacity-50' : 'opacity-100'}
                transition-all duration-300 ease-out
              `}
            />

            {/* Note title */}
            <text
              x={transformX(note.x) + transformWidth(note.width) / 2}
              y={transformY(note.y) + transformHeight(note.height) / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="1.5"
              fill="#374151"
              className="pointer-events-none select-none"
            >
              {note.title.length > 10 ? note.title.slice(0, 10) + '...' : note.title}
            </text>
          </g>
        ))}

        {/* Event type indicator */}
        {currentEvent && (
          <text
            x="2"
            y="96"
            fontSize="2"
            fill="#6b7280"
            className="pointer-events-none select-none"
          >
            {currentEvent.type.replace('-', ' ')}
          </text>
        )}
      </svg>

      {/* Empty state */}
      {notes.size === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
          <div className="text-center">
            <div className="text-4xl mb-2">📝</div>
            <div className="text-sm">No notes yet</div>
          </div>
        </div>
      )}
    </div>
  );
}

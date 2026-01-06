import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Note } from '../../types/note';
import { StickyNote, type StickyNoteData } from './StickyNote';
import { ConnectionLine } from './ConnectionLine';

// localStorage keys
const CANVAS_POSITIONS_KEY = 'patchpad_canvas_positions';
const CANVAS_VIEWPORT_KEY = 'patchpad_canvas_viewport';

export interface CanvasPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasViewProps {
  notes: Note[];
  onNoteClick?: (id: string) => void;
  onCreateConnection?: (fromId: string, toId: string) => void;
  selectedNoteIds?: string[];
}

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// Load saved positions from localStorage
function loadSavedPositions(): Map<string, CanvasPosition> {
  try {
    const saved = localStorage.getItem(CANVAS_POSITIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.warn('Failed to load canvas positions:', e);
  }
  return new Map();
}

// Save positions to localStorage
function savePositions(positions: Map<string, CanvasPosition>): void {
  try {
    const obj = Object.fromEntries(positions);
    localStorage.setItem(CANVAS_POSITIONS_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('Failed to save canvas positions:', e);
  }
}

// Load saved viewport
function loadViewport(): Viewport {
  try {
    const saved = localStorage.getItem(CANVAS_VIEWPORT_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load canvas viewport:', e);
  }
  return { x: 0, y: 0, zoom: 1 };
}

// Save viewport to localStorage
function saveViewport(viewport: Viewport): void {
  try {
    localStorage.setItem(CANVAS_VIEWPORT_KEY, JSON.stringify(viewport));
  } catch (e) {
    console.warn('Failed to save canvas viewport:', e);
  }
}

// Get color based on folder or tags
function getNoteColor(note: Note): string {
  if (note.folder) {
    // Hash folder name to consistent color
    const hash = note.folder.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colors = ['#FEF3C7', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#E0E7FF', '#FED7AA', '#CFFAFE', '#F5D0FE'];
    return colors[Math.abs(hash) % colors.length];
  }
  if (note.tags && note.tags.length > 0) {
    const hash = note.tags[0].split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colors = ['#FEF3C7', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#E0E7FF', '#FED7AA', '#CFFAFE', '#F5D0FE'];
    return colors[Math.abs(hash) % colors.length];
  }
  return '#FFFFFF';
}

// Parse wiki links from content
function parseWikiLinks(content: string): string[] {
  const links: string[] = [];
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1]);
  }
  return links;
}

// Default note size
const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 150;

export function CanvasView({
  notes,
  onNoteClick,
  onCreateConnection,
  selectedNoteIds = [],
}: CanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [viewport, setViewport] = useState<Viewport>(loadViewport);
  const [positions, setPositions] = useState<Map<string, CanvasPosition>>(() => loadSavedPositions());
  const [draggingNote, setDraggingNote] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [connectionDrag, setConnectionDrag] = useState<{
    fromId: string;
    fromPos: { x: number; y: number };
    currentPos: { x: number; y: number };
  } | null>(null);

  // Build sticky note data with positions
  const stickyNotes: StickyNoteData[] = useMemo(() => {
    return notes.map((note, index) => {
      const saved = positions.get(note.id);
      const pos = saved || {
        // Grid layout for notes without positions
        x: 50 + (index % 4) * 250,
        y: 50 + Math.floor(index / 4) * 200,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      };
      return {
        id: note.id,
        title: note.title,
        content: note.content.substring(0, 150) + (note.content.length > 150 ? '...' : ''),
        tags: note.tags || [],
        color: getNoteColor(note),
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
      };
    });
  }, [notes, positions]);

  // Build connections from wiki links
  const connections = useMemo(() => {
    const notesByTitle = new Map(notes.map(n => [n.title.toLowerCase(), n.id]));
    const conns: { fromId: string; toId: string }[] = [];

    for (const note of notes) {
      const links = parseWikiLinks(note.content);
      for (const link of links) {
        const targetId = notesByTitle.get(link.toLowerCase());
        if (targetId && targetId !== note.id) {
          // Avoid duplicate connections
          const exists = conns.some(
            c => (c.fromId === note.id && c.toId === targetId) ||
                 (c.fromId === targetId && c.toId === note.id)
          );
          if (!exists) {
            conns.push({ fromId: note.id, toId: targetId });
          }
        }
      }
    }
    return conns;
  }, [notes]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Save viewport on change
  useEffect(() => {
    saveViewport(viewport);
  }, [viewport]);

  // Handle note drag
  const handleNoteDragStart = useCallback((noteId: string) => {
    setDraggingNote(noteId);
  }, []);

  const handleNoteDrag = useCallback((noteId: string, x: number, y: number) => {
    setPositions(prev => {
      const next = new Map(prev);
      const current = next.get(noteId) || {
        x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT
      };
      next.set(noteId, { ...current, x, y });
      return next;
    });
  }, []);

  const handleNoteDragEnd = useCallback((noteId: string) => {
    setDraggingNote(null);
    // Save to localStorage
    savePositions(positions);
  }, [positions]);

  // Handle note resize
  const handleNoteResize = useCallback((noteId: string, width: number, height: number) => {
    setPositions(prev => {
      const next = new Map(prev);
      const current = next.get(noteId) || { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
      next.set(noteId, { ...current, width, height });
      return next;
    });
    savePositions(positions);
  }, [positions]);

  // Handle canvas pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if clicking on canvas background (not a note)
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-background')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
    }
  }, [viewport]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setViewport(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    }
    if (connectionDrag) {
      setConnectionDrag(prev => prev ? {
        ...prev,
        currentPos: {
          x: (e.clientX - viewport.x) / viewport.zoom,
          y: (e.clientY - viewport.y) / viewport.zoom,
        }
      } : null);
    }
  }, [isPanning, panStart, connectionDrag, viewport]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    setIsPanning(false);

    // Check if connection drag ended over a note
    if (connectionDrag && onCreateConnection) {
      // Find if mouse is over a note
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const canvasX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
        const canvasY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

        for (const note of stickyNotes) {
          if (
            note.id !== connectionDrag.fromId &&
            canvasX >= note.x &&
            canvasX <= note.x + note.width &&
            canvasY >= note.y &&
            canvasY <= note.y + note.height
          ) {
            onCreateConnection(connectionDrag.fromId, note.id);
            break;
          }
        }
      }
    }
    setConnectionDrag(null);
  }, [connectionDrag, onCreateConnection, viewport, stickyNotes]);

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Zoom toward mouse position
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewport(prev => {
      const newZoom = Math.max(0.25, Math.min(2, prev.zoom * delta));
      const zoomRatio = newZoom / prev.zoom;

      return {
        zoom: newZoom,
        x: mouseX - (mouseX - prev.x) * zoomRatio,
        y: mouseY - (mouseY - prev.y) * zoomRatio,
      };
    });
  }, []);

  // Handle connection drag start (Shift + drag from note)
  const handleConnectionDragStart = useCallback((noteId: string, startX: number, startY: number) => {
    const note = stickyNotes.find(n => n.id === noteId);
    if (note) {
      setConnectionDrag({
        fromId: noteId,
        fromPos: { x: note.x + note.width / 2, y: note.y + note.height / 2 },
        currentPos: { x: startX, y: startY },
      });
    }
  }, [stickyNotes]);

  // Calculate minimap data
  const minimapScale = 0.1;
  const minimapWidth = 150;
  const minimapHeight = 100;

  // Get bounds of all notes
  const bounds = useMemo(() => {
    if (stickyNotes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    }
    return stickyNotes.reduce(
      (acc, note) => ({
        minX: Math.min(acc.minX, note.x),
        minY: Math.min(acc.minY, note.y),
        maxX: Math.max(acc.maxX, note.x + note.width),
        maxY: Math.max(acc.maxY, note.y + note.height),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
  }, [stickyNotes]);

  // Zoom to fit all notes
  const handleZoomToFit = useCallback(() => {
    if (stickyNotes.length === 0) return;

    const padding = 50;
    const contentWidth = bounds.maxX - bounds.minX + padding * 2;
    const contentHeight = bounds.maxY - bounds.minY + padding * 2;

    const zoomX = dimensions.width / contentWidth;
    const zoomY = dimensions.height / contentHeight;
    const newZoom = Math.min(Math.max(0.25, Math.min(zoomX, zoomY)), 1);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    setViewport({
      zoom: newZoom,
      x: dimensions.width / 2 - centerX * newZoom,
      y: dimensions.height / 2 - centerY * newZoom,
    });
  }, [bounds, dimensions, stickyNotes.length]);

  // Reset view
  const handleResetView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, []);

  if (notes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 bg-gray-50">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <p className="text-sm">No notes to display</p>
          <p className="text-xs text-gray-400 mt-1">Create some notes to see them on the canvas</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full bg-gray-100 overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsPanning(false);
        setConnectionDrag(null);
      }}
      onWheel={handleWheel}
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
    >
      {/* Canvas background with grid pattern */}
      <div
        className="canvas-background absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle, #D1D5DB 1px, transparent 1px)
          `,
          backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />

      {/* Transform container for zoom/pan */}
      <div
        className="absolute"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Connection lines */}
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            width: bounds.maxX + 500,
            height: bounds.maxY + 500,
            overflow: 'visible',
          }}
        >
          {connections.map((conn, i) => {
            const fromNote = stickyNotes.find(n => n.id === conn.fromId);
            const toNote = stickyNotes.find(n => n.id === conn.toId);
            if (!fromNote || !toNote) return null;

            return (
              <ConnectionLine
                key={`${conn.fromId}-${conn.toId}-${i}`}
                fromX={fromNote.x + fromNote.width / 2}
                fromY={fromNote.y + fromNote.height / 2}
                toX={toNote.x + toNote.width / 2}
                toY={toNote.y + toNote.height / 2}
              />
            );
          })}

          {/* Rubber band line while dragging connection */}
          {connectionDrag && (
            <ConnectionLine
              fromX={connectionDrag.fromPos.x}
              fromY={connectionDrag.fromPos.y}
              toX={connectionDrag.currentPos.x}
              toY={connectionDrag.currentPos.y}
              isDragging
            />
          )}
        </svg>

        {/* Sticky notes */}
        {stickyNotes.map(note => (
          <StickyNote
            key={note.id}
            note={note}
            isSelected={selectedNoteIds.includes(note.id)}
            isDragging={draggingNote === note.id}
            onClick={() => onNoteClick?.(note.id)}
            onDragStart={() => handleNoteDragStart(note.id)}
            onDrag={(x, y) => handleNoteDrag(note.id, x, y)}
            onDragEnd={() => handleNoteDragEnd(note.id)}
            onResize={(w, h) => handleNoteResize(note.id, w, h)}
            onConnectionDragStart={(x, y) => handleConnectionDragStart(note.id, x, y)}
            viewportZoom={viewport.zoom}
          />
        ))}
      </div>

      {/* Minimap */}
      <div className="absolute bottom-2 left-2 bg-white/90 rounded-lg shadow-lg overflow-hidden">
        <div
          className="relative"
          style={{ width: minimapWidth, height: minimapHeight }}
        >
          {/* Notes in minimap */}
          {stickyNotes.map(note => {
            const x = ((note.x - bounds.minX) / (bounds.maxX - bounds.minX + 200)) * minimapWidth;
            const y = ((note.y - bounds.minY) / (bounds.maxY - bounds.minY + 200)) * minimapHeight;
            return (
              <div
                key={note.id}
                className="absolute rounded-sm"
                style={{
                  left: Math.max(0, x),
                  top: Math.max(0, y),
                  width: Math.max(4, note.width * minimapScale),
                  height: Math.max(3, note.height * minimapScale),
                  backgroundColor: note.color,
                  border: selectedNoteIds.includes(note.id) ? '1px solid #3B82F6' : '1px solid #9CA3AF',
                }}
              />
            );
          })}

          {/* Viewport indicator */}
          <div
            className="absolute border-2 border-blue-500 bg-blue-500/10 rounded-sm pointer-events-none"
            style={{
              left: ((-viewport.x / viewport.zoom - bounds.minX) / (bounds.maxX - bounds.minX + 200)) * minimapWidth,
              top: ((-viewport.y / viewport.zoom - bounds.minY) / (bounds.maxY - bounds.minY + 200)) * minimapHeight,
              width: ((dimensions.width / viewport.zoom) / (bounds.maxX - bounds.minX + 200)) * minimapWidth,
              height: ((dimensions.height / viewport.zoom) / (bounds.maxY - bounds.minY + 200)) * minimapHeight,
            }}
          />
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          onClick={() => setViewport(v => ({ ...v, zoom: Math.min(2, v.zoom * 1.2) }))}
          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
          title="Zoom in"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={() => setViewport(v => ({ ...v, zoom: Math.max(0.25, v.zoom / 1.2) }))}
          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
          title="Zoom out"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={handleZoomToFit}
          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
          title="Zoom to fit"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <button
          onClick={handleResetView}
          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
          title="Reset view"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
        {notes.length} notes, {connections.length} connections • {Math.round(viewport.zoom * 100)}%
      </div>

      {/* Help text */}
      <div className="absolute top-2 left-2 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
        Drag to pan • Scroll to zoom • Shift+drag from note to connect
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Note, CanvasPosition } from '../../types/note';
import { StickyNote, type StickyNoteData } from './StickyNote';
import { ConnectionLine } from './ConnectionLine';
import { CanvasGroup, type CanvasGroupData } from './CanvasGroup';
import { PresenceIndicator } from '../PresenceIndicator';
import { RemoteCanvasCursors } from './RemoteCanvasCursor';
import {
  type Peer,
  type PeerWithCanvasPosition,
  updateRoomCursor,
  syncNotePosition,
  onRemotePositionChange,
  getRoomPeersWithCanvasPositions,
} from '../../services/collaboration';

// Re-export CanvasPosition for convenience
export type { CanvasPosition } from '../../types/note';

// localStorage keys
const CANVAS_VIEWPORT_KEY = 'patchpad_canvas_viewport';
const CANVAS_GROUPS_KEY = 'patchpad_canvas_groups';

interface CanvasViewProps {
  notes: Note[];
  onNoteClick?: (id: string) => void;
  onCreateConnection?: (fromId: string, toId: string) => void;
  onPositionChange?: (noteId: string, position: CanvasPosition) => void;
  onAddNote?: () => void;
  onAutoLayout?: (algorithm: 'grid' | 'force') => void;
  selectedNoteIds?: string[];
  /** Whether collaboration mode is active */
  collaborationMode?: boolean;
  /** List of peers in the collaboration room */
  collaborationPeers?: Peer[];
  /** Whether connected to the collaboration server */
  collaborationConnected?: boolean;
}

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// Load positions from notes (stored in DB via canvasPosition field)
function loadPositionsFromNotes(notes: Note[]): Map<string, CanvasPosition> {
  const positions = new Map<string, CanvasPosition>();
  for (const note of notes) {
    if (note.canvasPosition) {
      positions.set(note.id, note.canvasPosition);
    }
  }
  return positions;
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

// Load groups from localStorage
function loadGroups(): CanvasGroupData[] {
  try {
    const saved = localStorage.getItem(CANVAS_GROUPS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load canvas groups:', e);
  }
  return [];
}

// Save groups to localStorage
function saveGroups(groups: CanvasGroupData[]): void {
  try {
    localStorage.setItem(CANVAS_GROUPS_KEY, JSON.stringify(groups));
  } catch (e) {
    console.warn('Failed to save canvas groups:', e);
  }
}

// Generate unique ID
function generateId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Group colors
const GROUP_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

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
  onPositionChange,
  onAddNote,
  onAutoLayout,
  selectedNoteIds = [],
  collaborationMode = false,
  collaborationPeers = [],
  collaborationConnected = false,
}: CanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [viewport, setViewport] = useState<Viewport>(loadViewport);
  const [positions, setPositions] = useState<Map<string, CanvasPosition>>(() => loadPositionsFromNotes(notes));
  const [draggingNote, setDraggingNote] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [groups, setGroups] = useState<CanvasGroupData[]>(() => loadGroups());
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<{
    fromId: string;
    fromPos: { x: number; y: number };
    currentPos: { x: number; y: number };
  } | null>(null);

  // Collaboration: peers with canvas positions
  const [canvasPeers, setCanvasPeers] = useState<PeerWithCanvasPosition[]>([]);

  // Track mouse position for collaboration cursor
  const handleMouseMoveForCursor = useCallback((e: React.MouseEvent) => {
    if (!collaborationMode || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    // Convert screen position to canvas position
    const canvasX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const canvasY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

    updateRoomCursor({ x: canvasX, y: canvasY });
  }, [collaborationMode, viewport]);

  // Clear cursor when leaving canvas
  const handleMouseLeaveForCursor = useCallback(() => {
    if (collaborationMode) {
      updateRoomCursor(null);
    }
  }, [collaborationMode]);

  // Subscribe to remote peer canvas positions
  useEffect(() => {
    if (!collaborationMode) {
      setCanvasPeers([]);
      return;
    }

    // Get initial state
    setCanvasPeers(getRoomPeersWithCanvasPositions());

    // Poll for updates (awareness doesn't have a direct subscription for all state changes)
    const interval = setInterval(() => {
      setCanvasPeers(getRoomPeersWithCanvasPositions());
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [collaborationMode]);

  // Subscribe to remote position changes and apply them
  useEffect(() => {
    if (!collaborationMode) return;

    const unsubscribe = onRemotePositionChange((noteId, position) => {
      setPositions(prev => {
        const next = new Map(prev);
        next.set(noteId, {
          x: position.x,
          y: position.y,
          width: position.width,
          height: position.height,
        });
        return next;
      });
    });

    return unsubscribe;
  }, [collaborationMode]);

  // Sync local position changes to collaboration room
  const syncPositionToRoom = useCallback((noteId: string, position: CanvasPosition) => {
    if (collaborationMode) {
      syncNotePosition(noteId, {
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
      });
    }
  }, [collaborationMode]);

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

  // Sync positions from notes when they change (e.g., loaded from DB)
  useEffect(() => {
    const newPositions = loadPositionsFromNotes(notes);
    setPositions(prev => {
      // Merge new positions, keeping local changes for notes being dragged
      const merged = new Map(prev);
      for (const [id, pos] of newPositions) {
        if (!draggingNote || id !== draggingNote) {
          merged.set(id, pos);
        }
      }
      return merged;
    });
  }, [notes, draggingNote]);

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
    // Notify parent to save to database
    const position = positions.get(noteId);
    if (position) {
      onPositionChange?.(noteId, position);
      // Sync to collaboration room
      syncPositionToRoom(noteId, position);
    }
  }, [positions, onPositionChange, syncPositionToRoom]);

  // Handle note resize
  const handleNoteResize = useCallback((noteId: string, width: number, height: number) => {
    setPositions(prev => {
      const next = new Map(prev);
      const current = next.get(noteId) || { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
      const newPosition = { ...current, width, height };
      next.set(noteId, newPosition);

      // Notify parent to save to database
      onPositionChange?.(noteId, newPosition);
      // Sync to collaboration room
      syncPositionToRoom(noteId, newPosition);

      return next;
    });
  }, [onPositionChange, syncPositionToRoom]);

  // Handle canvas pan or selection rectangle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if clicking on canvas background (not a note)
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-background')) {
      // Alt+drag starts selection rectangle
      if (e.altKey) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const canvasX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
          const canvasY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
          setSelectionRect({
            startX: canvasX,
            startY: canvasY,
            endX: canvasX,
            endY: canvasY,
          });
        }
      } else {
        // Regular pan
        setIsPanning(true);
        setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      }
      // Deselect group when clicking background
      setSelectedGroupId(null);
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
    if (selectionRect) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const canvasX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
        const canvasY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
        setSelectionRect(prev => prev ? { ...prev, endX: canvasX, endY: canvasY } : null);
      }
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
  }, [isPanning, panStart, selectionRect, connectionDrag, viewport]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    setIsPanning(false);

    // Check if selection rectangle ended - create group from selected notes
    if (selectionRect) {
      const minX = Math.min(selectionRect.startX, selectionRect.endX);
      const maxX = Math.max(selectionRect.startX, selectionRect.endX);
      const minY = Math.min(selectionRect.startY, selectionRect.endY);
      const maxY = Math.max(selectionRect.startY, selectionRect.endY);

      // Find notes inside selection
      const selectedNotes = stickyNotes.filter(note => {
        const noteRight = note.x + note.width;
        const noteBottom = note.y + note.height;
        return note.x < maxX && noteRight > minX && note.y < maxY && noteBottom > minY;
      });

      if (selectedNotes.length >= 2) {
        // Calculate group bounds with padding
        const padding = 20;
        const groupBounds = selectedNotes.reduce(
          (acc, note) => ({
            minX: Math.min(acc.minX, note.x),
            minY: Math.min(acc.minY, note.y),
            maxX: Math.max(acc.maxX, note.x + note.width),
            maxY: Math.max(acc.maxY, note.y + note.height),
          }),
          { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
        );

        const newGroup: CanvasGroupData = {
          id: generateId(),
          name: `Group ${groups.length + 1}`,
          noteIds: selectedNotes.map(n => n.id),
          x: groupBounds.minX - padding,
          y: groupBounds.minY - padding,
          width: groupBounds.maxX - groupBounds.minX + padding * 2,
          height: groupBounds.maxY - groupBounds.minY + padding * 2,
          color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
          collapsed: false,
        };

        const newGroups = [...groups, newGroup];
        setGroups(newGroups);
        saveGroups(newGroups);
        setSelectedGroupId(newGroup.id);
      }

      setSelectionRect(null);
    }

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
  }, [selectionRect, connectionDrag, onCreateConnection, viewport, stickyNotes, groups]);

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

  // Export canvas as PNG
  const handleExportPNG = useCallback(async () => {
    if (!canvasContentRef.current || stickyNotes.length === 0) return;

    setIsExporting(true);

    try {
      // Dynamically import html2canvas
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;

      // Create a temporary container for export
      const exportContainer = document.createElement('div');
      exportContainer.style.position = 'absolute';
      exportContainer.style.left = '-9999px';
      exportContainer.style.top = '-9999px';
      document.body.appendChild(exportContainer);

      // Clone the canvas content
      const contentClone = canvasContentRef.current.cloneNode(true) as HTMLElement;

      // Reset transform for export
      contentClone.style.transform = 'none';
      contentClone.style.position = 'relative';

      // Set size to fit all notes with padding
      const padding = 50;
      const width = bounds.maxX - bounds.minX + padding * 2;
      const height = bounds.maxY - bounds.minY + padding * 2;
      contentClone.style.width = `${width}px`;
      contentClone.style.height = `${height}px`;
      contentClone.style.backgroundColor = '#F3F4F6';

      // Adjust positions of children to account for bounds offset
      const children = contentClone.querySelectorAll('[style*="left"]');
      children.forEach((child) => {
        const el = child as HTMLElement;
        const left = parseFloat(el.style.left) || 0;
        const top = parseFloat(el.style.top) || 0;
        el.style.left = `${left - bounds.minX + padding}px`;
        el.style.top = `${top - bounds.minY + padding}px`;
      });

      exportContainer.appendChild(contentClone);

      // Render to canvas with 2x scale for high resolution
      const canvas = await html2canvas(contentClone, {
        scale: 2,
        backgroundColor: '#F3F4F6',
        logging: false,
      });

      // Clean up
      document.body.removeChild(exportContainer);

      // Download
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.download = `patchpad-canvas-${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to export canvas:', error);
      // Fallback: alert user that html2canvas is needed
      alert('Export failed. Make sure html2canvas is installed: npm install html2canvas');
    } finally {
      setIsExporting(false);
    }
  }, [bounds, stickyNotes.length]);

  // Group management callbacks
  const handleGroupToggleCollapse = useCallback((groupId: string) => {
    setGroups(prev => {
      const updated = prev.map(g =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
      );
      saveGroups(updated);
      return updated;
    });
  }, []);

  const handleGroupDelete = useCallback((groupId: string) => {
    setGroups(prev => {
      const updated = prev.filter(g => g.id !== groupId);
      saveGroups(updated);
      return updated;
    });
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }
  }, [selectedGroupId]);

  const handleGroupRename = useCallback((groupId: string, name: string) => {
    setGroups(prev => {
      const updated = prev.map(g =>
        g.id === groupId ? { ...g, name } : g
      );
      saveGroups(updated);
      return updated;
    });
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
      onMouseMove={(e) => {
        handleMouseMove(e);
        handleMouseMoveForCursor(e);
      }}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsPanning(false);
        setConnectionDrag(null);
        handleMouseLeaveForCursor();
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

      {/* Remote canvas cursors from collaborators */}
      {collaborationMode && (
        <RemoteCanvasCursors
          peers={canvasPeers}
          viewport={viewport}
        />
      )}

      {/* Transform container for zoom/pan */}
      <div
        ref={canvasContentRef}
        className="absolute"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Groups (render behind notes) */}
        {groups.map(group => (
          <CanvasGroup
            key={group.id}
            group={group}
            isSelected={selectedGroupId === group.id}
            onSelect={() => setSelectedGroupId(group.id)}
            onToggleCollapse={() => handleGroupToggleCollapse(group.id)}
            onDelete={() => handleGroupDelete(group.id)}
            onRename={(name) => handleGroupRename(group.id, name)}
          />
        ))}

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

        {/* Selection rectangle */}
        {selectionRect && (
          <div
            className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
            style={{
              left: Math.min(selectionRect.startX, selectionRect.endX),
              top: Math.min(selectionRect.startY, selectionRect.endY),
              width: Math.abs(selectionRect.endX - selectionRect.startX),
              height: Math.abs(selectionRect.endY - selectionRect.startY),
            }}
          />
        )}
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

      {/* Toolbar */}
      <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/95 rounded-lg shadow-lg p-1">
        {/* Add Note */}
        {onAddNote && (
          <button
            onClick={onAddNote}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title="Add Note"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {/* Auto Layout */}
        {onAutoLayout && (
          <div className="relative">
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Auto Layout"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </button>
            {showLayoutMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px] z-50">
                <button
                  onClick={() => {
                    onAutoLayout('grid');
                    setShowLayoutMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  Grid Layout
                </button>
                <button
                  onClick={() => {
                    onAutoLayout('force');
                    setShowLayoutMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  Force Layout
                </button>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Zoom to Fit */}
        <button
          onClick={handleZoomToFit}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Zoom to Fit"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        {/* Export PNG */}
        <button
          onClick={handleExportPNG}
          disabled={isExporting}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          title="Export as PNG"
        >
          {isExporting ? (
            <svg className="w-4 h-4 text-gray-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Help text */}
        <span className="text-xs text-gray-400 px-2">
          Drag: pan • Scroll: zoom • Alt+drag: group
        </span>

        {/* Collaboration presence indicator */}
        {collaborationMode && (
          <>
            <div className="w-px h-6 bg-gray-200 mx-1" />
            <PresenceIndicator
              peers={collaborationPeers}
              isConnected={collaborationConnected}
              maxVisible={3}
            />
          </>
        )}
      </div>
    </div>
  );
}

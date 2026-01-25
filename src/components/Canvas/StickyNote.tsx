import { useRef, useCallback, useState, useEffect } from 'react';

export interface StickyNoteData {
  id: string;
  title: string;
  content: string;
  tags: string[];
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StickyNoteProps {
  note: StickyNoteData;
  isSelected: boolean;
  isDragging: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDrag: (x: number, y: number) => void;
  onDragEnd: () => void;
  onResize: (width: number, height: number) => void;
  onConnectionDragStart: (x: number, y: number) => void;
  viewportZoom: number;
}

const MIN_WIDTH = 150;
const MIN_HEIGHT = 100;
const MAX_WIDTH = 400;
const MAX_HEIGHT = 400;

export function StickyNote({
  note,
  isSelected,
  isDragging,
  onClick,
  onDragStart,
  onDrag,
  onDragEnd,
  onResize,
  onConnectionDragStart,
  viewportZoom,
}: StickyNoteProps) {
  const noteRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dragStartRef = useRef<{ x: number; y: number; noteX: number; noteY: number } | null>(null);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    // Shift + drag starts connection
    if (e.shiftKey) {
      const rect = noteRef.current?.getBoundingClientRect();
      if (rect) {
        onConnectionDragStart(
          note.x + note.width / 2,
          note.y + note.height / 2
        );
      }
      return;
    }

    // Regular drag
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      noteX: note.x,
      noteY: note.y,
    };
    onDragStart();
  }, [note.x, note.y, note.width, note.height, onDragStart, onConnectionDragStart]);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const dx = (e.clientX - dragStartRef.current.x) / viewportZoom;
      const dy = (e.clientY - dragStartRef.current.y) / viewportZoom;

      onDrag(
        dragStartRef.current.noteX + dx,
        dragStartRef.current.noteY + dy
      );
    };

    const handleMouseUp = () => {
      dragStartRef.current = null;
      onDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, viewportZoom, onDrag, onDragEnd]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: note.width,
      height: note.height,
    });
  }, [note.width, note.height]);

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - resizeStart.x) / viewportZoom;
      const dy = (e.clientY - resizeStart.y) / viewportZoom;

      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStart.width + dx));
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStart.height + dy));

      onResize(newWidth, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart, viewportZoom, onResize]);

  // Handle double-click to open note
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  }, [onClick]);

  return (
    <div
      ref={noteRef}
      className={`absolute rounded-lg shadow-lg cursor-move transition-shadow ${
        isSelected ? 'ring-2 ring-primary-500 shadow-xl' : ''
      } ${isDragging ? 'shadow-2xl z-50' : ''}`}
      style={{
        left: note.x,
        top: note.y,
        width: note.width,
        height: note.height,
        backgroundColor: note.color,
        opacity: isDragging ? 0.9 : 1,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-black/10">
        <h3 className="font-medium text-neutral-900 text-sm truncate">{note.title}</h3>
      </div>

      {/* Content */}
      <div className="px-3 py-2 text-xs text-neutral-600 overflow-hidden" style={{ height: note.height - 70 }}>
        <p className="line-clamp-5">{note.content}</p>
      </div>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="absolute bottom-2 left-2 right-8 flex flex-wrap gap-1 overflow-hidden">
          {note.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 text-[10px] bg-black/10 text-neutral-700 rounded truncate max-w-[60px]"
            >
              {tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="text-[10px] text-neutral-500">+{note.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Connection drag handle (Shift+drag) */}
      <div
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-400/50 flex items-center justify-center text-white text-[10px] opacity-0 hover:opacity-100 transition-opacity cursor-crosshair"
        title="Shift+drag to connect"
        onMouseDown={(e) => {
          if (e.shiftKey) {
            e.stopPropagation();
            onConnectionDragStart(note.x + note.width / 2, note.y + note.height / 2);
          }
        }}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
        onMouseDown={handleResizeStart}
      >
        <svg
          className="w-3 h-3 text-neutral-400 group-hover:text-neutral-600 absolute bottom-0.5 right-0.5"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22ZM18 14H16V12H18V14ZM14 18H12V16H14V18ZM14 14H12V12H14V14Z" />
        </svg>
      </div>
    </div>
  );
}

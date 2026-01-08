/**
 * Remote Canvas Cursor Component
 *
 * Renders a cursor icon at a peer's position on the canvas with their name label.
 * Different from the editor cursor - uses a pointer/arrow icon.
 */

import { useEffect, useState } from 'react';
import type { Peer } from '../../services/collaboration';

interface CanvasCursorPosition {
  x: number;
  y: number;
}

interface RemoteCanvasCursorProps {
  /** The peer whose cursor to display */
  peer: Peer & { canvasPosition?: CanvasCursorPosition };
  /** Viewport transform values for correct positioning */
  viewport: { x: number; y: number; zoom: number };
}

export function RemoteCanvasCursor({
  peer,
  viewport,
}: RemoteCanvasCursorProps) {
  const [showLabel, setShowLabel] = useState(true);

  // Get canvas position from peer's awareness state
  const canvasPosition = (peer as { canvasPosition?: CanvasCursorPosition }).canvasPosition;

  // Show label briefly when cursor moves
  useEffect(() => {
    if (!canvasPosition) return;

    setShowLabel(true);
    const timeout = setTimeout(() => {
      setShowLabel(false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [canvasPosition?.x, canvasPosition?.y]);

  if (!canvasPosition) {
    return null;
  }

  // Transform canvas position to screen position
  const screenX = canvasPosition.x * viewport.zoom + viewport.x;
  const screenY = canvasPosition.y * viewport.zoom + viewport.y;

  return (
    <div
      className="absolute pointer-events-none transition-all duration-100 ease-out z-50"
      style={{
        left: screenX,
        top: screenY,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Cursor arrow icon */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={peer.color}
        className="drop-shadow-md"
      >
        <path
          d="M5.65 3.15l13.5 7.5c.4.22.4.78 0 1l-5.5 3.06c-.15.08-.27.2-.35.35l-3.06 5.5c-.22.4-.78.4-1 0l-7.5-13.5c-.22-.4.1-.86.55-.86l3.36-.05z"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Name label */}
      {showLabel && (
        <div
          className="absolute left-5 top-4 px-2 py-1 text-xs font-medium text-white rounded shadow-lg whitespace-nowrap animate-fade-in"
          style={{ backgroundColor: peer.color }}
        >
          {peer.name}
        </div>
      )}
    </div>
  );
}

interface RemoteCanvasCursorsProps {
  /** List of peers with canvas positions */
  peers: (Peer & { canvasPosition?: CanvasCursorPosition })[];
  /** Current viewport transform */
  viewport: { x: number; y: number; zoom: number };
}

/**
 * Container for all remote canvas cursors
 */
export function RemoteCanvasCursors({
  peers,
  viewport,
}: RemoteCanvasCursorsProps) {
  const peersWithCursors = peers.filter(
    (p) => (p as { canvasPosition?: CanvasCursorPosition }).canvasPosition
  );

  if (peersWithCursors.length === 0) {
    return null;
  }

  return (
    <>
      {peersWithCursors.map((peer) => (
        <RemoteCanvasCursor
          key={peer.id}
          peer={peer}
          viewport={viewport}
        />
      ))}
    </>
  );
}

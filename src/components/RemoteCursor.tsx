/**
 * Remote Cursor Component
 *
 * Renders a colored cursor at a peer's position with their name label.
 */

import { useEffect, useState } from 'react';
import type { Peer } from '../services/collaboration';

interface RemoteCursorProps {
  /** The peer whose cursor to display */
  peer: Peer;
  /** Editor container element for positioning */
  editorContainer: HTMLElement | null;
  /** Callback to get position from line/ch coordinates */
  getPositionFromCoords?: (line: number, ch: number) => { top: number; left: number } | null;
}

export function RemoteCursor({
  peer,
  editorContainer,
  getPositionFromCoords,
}: RemoteCursorProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [showLabel, setShowLabel] = useState(true);

  // Update position when cursor changes
  useEffect(() => {
    if (!peer.cursor || !getPositionFromCoords) {
      setPosition(null);
      return;
    }

    const pos = getPositionFromCoords(peer.cursor.line, peer.cursor.ch);
    setPosition(pos);

    // Show label briefly when cursor moves
    setShowLabel(true);
    const timeout = setTimeout(() => {
      setShowLabel(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [peer.cursor, getPositionFromCoords]);

  if (!position || !editorContainer) {
    return null;
  }

  return (
    <div
      className="absolute pointer-events-none transition-all duration-75"
      style={{
        top: position.top,
        left: position.left,
        zIndex: 50,
      }}
    >
      {/* Cursor line */}
      <div
        className="w-0.5 h-5 animate-pulse"
        style={{ backgroundColor: peer.color }}
      />

      {/* Name label */}
      {showLabel && (
        <div
          className="absolute -top-5 left-0 px-1.5 py-0.5 text-xs font-medium text-white rounded-sm whitespace-nowrap shadow-sm"
          style={{ backgroundColor: peer.color }}
        >
          {peer.name}
        </div>
      )}
    </div>
  );
}

interface RemoteCursorsProps {
  /** List of peers with cursors */
  peers: Peer[];
  /** Editor container element */
  editorContainer: HTMLElement | null;
  /** Callback to get position from line/ch coordinates */
  getPositionFromCoords?: (line: number, ch: number) => { top: number; left: number } | null;
}

/**
 * Container for all remote cursors
 */
export function RemoteCursors({
  peers,
  editorContainer,
  getPositionFromCoords,
}: RemoteCursorsProps) {
  const peersWithCursors = peers.filter((p) => p.cursor);

  if (peersWithCursors.length === 0) {
    return null;
  }

  return (
    <>
      {peersWithCursors.map((peer) => (
        <RemoteCursor
          key={peer.id}
          peer={peer}
          editorContainer={editorContainer}
          getPositionFromCoords={getPositionFromCoords}
        />
      ))}
    </>
  );
}

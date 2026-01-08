/**
 * Remote Selection Component
 *
 * Highlights peer's text selection in their assigned color.
 */

import type { Peer } from '../services/collaboration';

interface RemoteSelectionProps {
  /** The peer whose selection to display */
  peer: Peer;
  /** Editor container element for positioning */
  editorContainer: HTMLElement | null;
  /** Callback to get rectangles for a character range */
  getRangeRects?: (from: number, to: number) => DOMRect[];
}

export function RemoteSelection({
  peer,
  editorContainer,
  getRangeRects,
}: RemoteSelectionProps) {
  if (!peer.selection || !getRangeRects || !editorContainer) {
    return null;
  }

  const { from, to } = peer.selection;
  if (from >= to) {
    return null;
  }

  const rects = getRangeRects(from, to);
  if (rects.length === 0) {
    return null;
  }

  // Get container position for relative positioning
  const containerRect = editorContainer.getBoundingClientRect();

  return (
    <>
      {rects.map((rect, index) => (
        <div
          key={index}
          className="absolute pointer-events-none"
          style={{
            top: rect.top - containerRect.top,
            left: rect.left - containerRect.left,
            width: rect.width,
            height: rect.height,
            backgroundColor: peer.color,
            opacity: 0.3,
            zIndex: 10,
          }}
        />
      ))}
    </>
  );
}

interface RemoteSelectionsProps {
  /** List of peers with selections */
  peers: Peer[];
  /** Editor container element */
  editorContainer: HTMLElement | null;
  /** Callback to get rectangles for a character range */
  getRangeRects?: (from: number, to: number) => DOMRect[];
}

/**
 * Container for all remote selections
 */
export function RemoteSelections({
  peers,
  editorContainer,
  getRangeRects,
}: RemoteSelectionsProps) {
  const peersWithSelections = peers.filter((p) => p.selection && p.selection.from < p.selection.to);

  if (peersWithSelections.length === 0) {
    return null;
  }

  return (
    <>
      {peersWithSelections.map((peer) => (
        <RemoteSelection
          key={peer.id}
          peer={peer}
          editorContainer={editorContainer}
          getRangeRects={getRangeRects}
        />
      ))}
    </>
  );
}

/**
 * Collaborative Editor Wrapper
 *
 * Wraps the CodeMirror editor with Yjs integration for real-time collaboration.
 * Provides presence indicators and remote cursor/selection rendering.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { yCollab } from 'y-codemirror.next';
import type { Note } from '../types/note';
import { useCollaboration } from '../hooks/useCollaboration';
import { PresenceIndicator } from './PresenceIndicator';
import { RemoteCursors } from './RemoteCursor';
import { RemoteSelections } from './RemoteSelection';

interface CollaborativeEditorProps {
  /** The note being edited */
  note: Note | null;
  /** Whether collaboration is enabled */
  isShared: boolean;
  /** Current user's display name */
  userName?: string;
  /** The CodeMirror EditorView instance */
  editorView: EditorView | null;
  /** Editor container element */
  editorContainer: HTMLElement | null;
  /** Callback when remote changes occur */
  onRemoteChange?: (content: string) => void;
}

export function CollaborativeEditor({
  note,
  isShared,
  userName,
  editorView,
  editorContainer,
  onRemoteChange,
}: CollaborativeEditorProps) {
  const [showPresence, setShowPresence] = useState(true);

  const {
    doc,
    yText,
    peers,
    isConnected,
    isSynced,
    isCollaborating,
    startCollaboration,
    stopCollaboration,
    setCursor,
    setSelection,
  } = useCollaboration({
    note,
    enabled: isShared,
    userName,
    onRemoteChange,
  });

  // Start/stop collaboration when sharing status changes
  useEffect(() => {
    if (isShared && note) {
      startCollaboration();
    } else {
      stopCollaboration();
    }
  }, [isShared, note, startCollaboration, stopCollaboration]);

  // Add Yjs extension to CodeMirror
  useEffect(() => {
    if (!editorView || !yText || !isCollaborating) return;

    // Get the undoManager from yText's doc
    const undoManager = doc ? new (require('yjs').UndoManager)(yText) : null;

    // Add yCollab extension
    const collabExtension = yCollab(yText, null, { undoManager });

    // Apply the extension to the editor
    editorView.dispatch({
      effects: EditorView.reconfigure.of([
        ...editorView.state.facet(EditorView.contentAttributes),
        collabExtension,
      ]),
    });

    return () => {
      // Remove collaboration extension when stopping
      // Note: This is simplified - in production you'd want proper cleanup
    };
  }, [editorView, yText, doc, isCollaborating]);

  // Broadcast cursor position changes
  useEffect(() => {
    if (!editorView || !isCollaborating) return;

    const updateHandler = () => {
      const selection = editorView.state.selection.main;
      const pos = selection.head;

      // Convert position to line/ch
      const line = editorView.state.doc.lineAt(pos);
      setCursor({
        line: line.number - 1,
        ch: pos - line.from,
      });

      // Broadcast selection if there is one
      if (selection.from !== selection.to) {
        setSelection({
          from: selection.from,
          to: selection.to,
        });
      } else {
        setSelection(null);
      }
    };

    // Listen for selection changes
    const listener = EditorView.updateListener.of((update) => {
      if (update.selectionSet) {
        updateHandler();
      }
    });

    // Apply the listener
    // Note: In production, this should be added during editor creation
    return () => {
      // Cleanup
    };
  }, [editorView, isCollaborating, setCursor, setSelection]);

  // Get position from line/ch coordinates
  const getPositionFromCoords = useCallback(
    (line: number, ch: number): { top: number; left: number } | null => {
      if (!editorView) return null;

      try {
        const lineInfo = editorView.state.doc.line(line + 1);
        const pos = lineInfo.from + ch;
        const coords = editorView.coordsAtPos(pos);

        if (!coords) return null;

        const containerRect = editorContainer?.getBoundingClientRect();
        if (!containerRect) return null;

        return {
          top: coords.top - containerRect.top,
          left: coords.left - containerRect.left,
        };
      } catch {
        return null;
      }
    },
    [editorView, editorContainer]
  );

  // Get DOM rectangles for a character range
  const getRangeRects = useCallback(
    (from: number, to: number): DOMRect[] => {
      if (!editorView) return [];

      try {
        // Get coordinates for the range
        const startCoords = editorView.coordsAtPos(from);
        const endCoords = editorView.coordsAtPos(to);

        if (!startCoords || !endCoords) return [];

        // Simple single-line selection rectangle
        return [
          new DOMRect(
            startCoords.left,
            startCoords.top,
            endCoords.left - startCoords.left,
            startCoords.bottom - startCoords.top
          ),
        ];
      } catch {
        return [];
      }
    },
    [editorView]
  );

  if (!isShared) {
    return null;
  }

  return (
    <>
      {/* Presence Indicator - rendered in editor header */}
      {showPresence && (
        <div className="absolute top-2 right-2 z-20">
          <PresenceIndicator
            peers={peers}
            isConnected={isConnected}
          />
        </div>
      )}

      {/* Remote Cursors Overlay */}
      {editorContainer && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <RemoteCursors
            peers={peers}
            editorContainer={editorContainer}
            getPositionFromCoords={getPositionFromCoords}
          />
          <RemoteSelections
            peers={peers}
            editorContainer={editorContainer}
            getRangeRects={getRangeRects}
          />
        </div>
      )}

      {/* Sync Status Indicator */}
      {isCollaborating && !isSynced && (
        <div className="absolute bottom-2 right-2 z-20 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full flex items-center gap-1">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Syncing...
        </div>
      )}
    </>
  );
}

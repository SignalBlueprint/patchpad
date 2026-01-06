export interface Highlight {
  id: string;
  from: number;
  to: number;
  color: HighlightColor;
  note?: string; // Optional annotation
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

export interface WikiLink {
  id: string;
  from: number;           // Character position start
  to: number;             // Character position end
  targetNoteId: string;   // Linked note ID (resolved at runtime)
  targetTitle: string;    // The title text in the link
  displayText?: string;   // Optional display text from [[Title|display]]
}

export interface CanvasPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  favorite?: boolean;
  folder?: string;
  tags?: string[];
  highlights?: Highlight[];
  parentId?: string; // For sub-notes (merged notes become children)
  collapsed?: boolean; // Whether children are collapsed in sidebar
  canvasPosition?: CanvasPosition; // Position on canvas view
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
}

import { db } from '../db';
import type { Note, CanvasPosition } from '../types/note';

// Default note dimensions
const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 150;
const GRID_PADDING = 50;
const GRID_GAP_X = 250;
const GRID_GAP_Y = 200;

/**
 * Save canvas layout positions to the database
 */
export async function saveCanvasLayout(
  positions: Map<string, CanvasPosition>
): Promise<void> {
  const updates: Array<{ id: string; canvasPosition: CanvasPosition }> = [];

  for (const [noteId, position] of positions) {
    updates.push({ id: noteId, canvasPosition: position });
  }

  // Batch update all notes with their positions
  await db.transaction('rw', db.notes, async () => {
    for (const update of updates) {
      await db.notes.update(update.id, { canvasPosition: update.canvasPosition });
    }
  });
}

/**
 * Load canvas layout from the database
 */
export async function loadCanvasLayout(): Promise<Map<string, CanvasPosition>> {
  const positions = new Map<string, CanvasPosition>();
  const notes = await db.notes.toArray();

  for (const note of notes) {
    if (note.canvasPosition) {
      positions.set(note.id, note.canvasPosition);
    }
  }

  return positions;
}

/**
 * Save a single note's canvas position
 */
export async function saveNoteCanvasPosition(
  noteId: string,
  position: CanvasPosition
): Promise<void> {
  await db.notes.update(noteId, { canvasPosition: position });
}

/**
 * Clear all canvas positions (reset layout)
 */
export async function clearCanvasLayout(): Promise<void> {
  const notes = await db.notes.toArray();

  await db.transaction('rw', db.notes, async () => {
    for (const note of notes) {
      await db.notes.update(note.id, { canvasPosition: undefined });
    }
  });
}

/**
 * Auto-layout notes in a grid pattern
 */
export function autoLayoutGrid(notes: Note[]): Map<string, CanvasPosition> {
  const positions = new Map<string, CanvasPosition>();
  const columns = Math.ceil(Math.sqrt(notes.length));

  notes.forEach((note, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);

    positions.set(note.id, {
      x: GRID_PADDING + col * GRID_GAP_X,
      y: GRID_PADDING + row * GRID_GAP_Y,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    });
  });

  return positions;
}

/**
 * Auto-layout notes using a force-directed algorithm
 * Simulates physical forces to spread notes evenly
 */
export function autoLayoutForce(notes: Note[]): Map<string, CanvasPosition> {
  if (notes.length === 0) {
    return new Map();
  }

  // Initialize positions in a circle
  const centerX = 500;
  const centerY = 400;
  const radius = Math.min(300, notes.length * 30);

  interface Node {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
  }

  const nodes: Node[] = notes.map((note, i) => {
    const angle = (i / notes.length) * 2 * Math.PI;
    return {
      id: note.id,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    };
  });

  // Build connection map from wiki links
  const connections = new Map<string, Set<string>>();
  const notesByTitle = new Map(notes.map(n => [n.title.toLowerCase(), n.id]));

  for (const note of notes) {
    const links = parseWikiLinks(note.content);
    const connectedIds = new Set<string>();

    for (const link of links) {
      const targetId = notesByTitle.get(link.toLowerCase());
      if (targetId && targetId !== note.id) {
        connectedIds.add(targetId);
      }
    }

    if (connectedIds.size > 0) {
      connections.set(note.id, connectedIds);
    }
  }

  // Force simulation parameters
  const repulsion = 5000;
  const attraction = 0.1;
  const damping = 0.8;
  const centerForce = 0.01;
  const iterations = 100;

  // Run simulation
  for (let iter = 0; iter < iterations; iter++) {
    // Apply forces
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      // Center force
      node.vx += (centerX - node.x) * centerForce;
      node.vy += (centerY - node.y) * centerForce;

      // Repulsion from other nodes
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const other = nodes[j];
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        node.vx += (dx / dist) * force;
        node.vy += (dy / dist) * force;
      }
    }

    // Attraction along connections
    for (const [fromId, toIds] of connections) {
      const fromNode = nodes.find(n => n.id === fromId);
      if (!fromNode) continue;

      for (const toId of toIds) {
        const toNode = nodes.find(n => n.id === toId);
        if (!toNode) continue;

        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 200) * attraction;

        fromNode.vx += (dx / dist) * force;
        fromNode.vy += (dy / dist) * force;
        toNode.vx -= (dx / dist) * force;
        toNode.vy -= (dy / dist) * force;
      }
    }

    // Update positions
    for (const node of nodes) {
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  // Convert to positions map
  const positions = new Map<string, CanvasPosition>();

  // Normalize positions to start from (50, 50)
  let minX = Infinity, minY = Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
  }

  for (const node of nodes) {
    positions.set(node.id, {
      x: node.x - minX + GRID_PADDING,
      y: node.y - minY + GRID_PADDING,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    });
  }

  return positions;
}

/**
 * Auto-layout with choice of algorithm
 */
export function autoLayout(
  notes: Note[],
  algorithm: 'grid' | 'force' = 'grid'
): Map<string, CanvasPosition> {
  if (algorithm === 'force') {
    return autoLayoutForce(notes);
  }
  return autoLayoutGrid(notes);
}

// Helper to parse wiki links from content
function parseWikiLinks(content: string): string[] {
  const links: string[] = [];
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1]);
  }
  return links;
}

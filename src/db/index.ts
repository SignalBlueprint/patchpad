import Dexie, { type EntityTable } from 'dexie';
import type { Note, Folder } from '../types/note';
import type { Patch } from '../types/patch';

const db = new Dexie('PatchPadDB') as Dexie & {
  notes: EntityTable<Note, 'id'>;
  patches: EntityTable<Patch, 'id'>;
  folders: EntityTable<Folder, 'id'>;
};

// Version 2: original schema
db.version(2).stores({
  notes: 'id, title, updatedAt',
  patches: 'id, noteId, status, createdAt',
});

// Version 3: add organization features
db.version(3).stores({
  notes: 'id, title, updatedAt, favorite, folder, *tags',
  patches: 'id, noteId, status, createdAt',
  folders: 'id, name',
});

// Version 4: add parent-child relationship for merged notes
db.version(4).stores({
  notes: 'id, title, updatedAt, favorite, folder, *tags, parentId',
  patches: 'id, noteId, status, createdAt',
  folders: 'id, name',
});

// Version 5: add canvas position fields for spatial note arrangement
db.version(5).stores({
  notes: 'id, title, updatedAt, favorite, folder, *tags, parentId',
  patches: 'id, noteId, status, createdAt',
  folders: 'id, name',
});
// Note: canvasPosition is stored as a JSON field on the Note object
// No index needed since we don't query by position
// Migration: existing notes will have undefined canvasPosition (null/undefined)

// Version 6: add embeddings table for semantic search
db.version(6).stores({
  notes: 'id, title, updatedAt, favorite, folder, *tags, parentId',
  patches: 'id, noteId, status, createdAt',
  folders: 'id, name',
  embeddings: 'id, noteId',
});
// Embeddings store vector embeddings for semantic search
// contentHash field tracks when embeddings need regeneration

// Version 7: add conversations table for AI Research Partner
db.version(7).stores({
  notes: 'id, title, updatedAt, favorite, folder, *tags, parentId',
  patches: 'id, noteId, status, createdAt',
  folders: 'id, name',
  embeddings: 'id, noteId',
  conversations: 'id, createdAt',
});
// Conversations store chat history with AI Research Partner

export { db };

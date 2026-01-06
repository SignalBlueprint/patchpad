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

export { db };

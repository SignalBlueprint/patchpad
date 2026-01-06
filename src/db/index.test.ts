import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';
import type { Note } from '../types/note';
import type { Patch } from '../types/patch';

describe('Database', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await db.notes.clear();
    await db.patches.clear();
  });

  describe('notes table', () => {
    it('can add and retrieve a note', async () => {
      const note: Note = {
        id: 'test-1',
        title: 'Test Note',
        content: 'Test content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.notes.add(note);
      const retrieved = await db.notes.get('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Test Note');
      expect(retrieved?.content).toBe('Test content');
    });

    it('can update a note', async () => {
      const note: Note = {
        id: 'test-1',
        title: 'Original Title',
        content: 'Original content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.notes.add(note);
      await db.notes.update('test-1', { title: 'Updated Title' });
      const retrieved = await db.notes.get('test-1');

      expect(retrieved?.title).toBe('Updated Title');
    });

    it('can delete a note', async () => {
      const note: Note = {
        id: 'test-1',
        title: 'Test Note',
        content: 'Test content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.notes.add(note);
      await db.notes.delete('test-1');
      const retrieved = await db.notes.get('test-1');

      expect(retrieved).toBeUndefined();
    });

    it('can query notes by updatedAt', async () => {
      const now = new Date();
      const notes: Note[] = [
        { id: '1', title: 'Old', content: '', createdAt: now, updatedAt: new Date(now.getTime() - 1000) },
        { id: '2', title: 'New', content: '', createdAt: now, updatedAt: new Date(now.getTime() + 1000) },
      ];

      await db.notes.bulkAdd(notes);
      const sorted = await db.notes.orderBy('updatedAt').reverse().toArray();

      expect(sorted[0].title).toBe('New');
      expect(sorted[1].title).toBe('Old');
    });
  });

  describe('patches table', () => {
    it('can add and retrieve a patch', async () => {
      const patch: Patch = {
        id: 'patch-1',
        noteId: 'note-1',
        action: 'summarize',
        rationale: 'Test rationale',
        ops: [{ type: 'insert', start: 0, text: 'Hello' }],
        status: 'pending',
        createdAt: new Date(),
      };

      await db.patches.add(patch);
      const retrieved = await db.patches.get('patch-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.action).toBe('summarize');
      expect(retrieved?.ops).toHaveLength(1);
    });

    it('can query patches by noteId', async () => {
      const patches: Patch[] = [
        { id: 'p1', noteId: 'note-1', action: 'summarize', rationale: '', ops: [], status: 'pending', createdAt: new Date() },
        { id: 'p2', noteId: 'note-1', action: 'rewrite', rationale: '', ops: [], status: 'pending', createdAt: new Date() },
        { id: 'p3', noteId: 'note-2', action: 'summarize', rationale: '', ops: [], status: 'pending', createdAt: new Date() },
      ];

      await db.patches.bulkAdd(patches);
      const note1Patches = await db.patches.where('noteId').equals('note-1').toArray();

      expect(note1Patches).toHaveLength(2);
    });

    it('can update patch status', async () => {
      const patch: Patch = {
        id: 'patch-1',
        noteId: 'note-1',
        action: 'summarize',
        rationale: '',
        ops: [],
        status: 'pending',
        createdAt: new Date(),
      };

      await db.patches.add(patch);
      await db.patches.update('patch-1', { status: 'applied' });
      const retrieved = await db.patches.get('patch-1');

      expect(retrieved?.status).toBe('applied');
    });
  });
});

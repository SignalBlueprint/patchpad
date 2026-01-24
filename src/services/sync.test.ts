/**
 * Tests for sync.ts
 * Cloud synchronization with conflict resolution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectConflicts,
  resolveConflict,
  type SyncConflict,
  type ConflictResolution,
} from './sync';
import type { Note } from '../types/note';

describe('detectConflicts', () => {
  const createNote = (
    id: string,
    title: string,
    content: string,
    updatedAt: Date
  ): Note => ({
    id,
    title,
    content,
    createdAt: new Date(),
    updatedAt,
  });

  it('should detect no conflicts when notes are identical', () => {
    const date = new Date();
    const localNotes: Note[] = [
      createNote('note1', 'Test', 'content', date),
    ];
    const remoteNotes: Note[] = [
      createNote('note1', 'Test', 'content', date),
    ];

    const conflicts = detectConflicts(localNotes, remoteNotes);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect no conflicts when only timestamps differ slightly', () => {
    const localDate = new Date('2024-01-01T10:00:00Z');
    const remoteDate = new Date('2024-01-01T10:00:00.500Z'); // 500ms difference
    const localNotes: Note[] = [
      createNote('note1', 'Test', 'same content', localDate),
    ];
    const remoteNotes: Note[] = [
      createNote('note1', 'Test', 'same content', remoteDate),
    ];

    const conflicts = detectConflicts(localNotes, remoteNotes);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect conflict when both content and timestamps differ significantly', () => {
    const localDate = new Date('2024-01-01T10:00:00Z');
    const remoteDate = new Date('2024-01-01T10:05:00Z'); // 5 minutes later
    const localNotes: Note[] = [
      createNote('note1', 'Test', 'local content', localDate),
    ];
    const remoteNotes: Note[] = [
      createNote('note1', 'Test', 'remote content', remoteDate),
    ];

    const conflicts = detectConflicts(localNotes, remoteNotes);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].noteId).toBe('note1');
    expect(conflicts[0].localNote.content).toBe('local content');
    expect(conflicts[0].remoteNote.content).toBe('remote content');
  });

  it('should not detect conflict when content differs but timestamps are identical', () => {
    const date = new Date();
    const localNotes: Note[] = [
      createNote('note1', 'Test', 'local content', date),
    ];
    const remoteNotes: Note[] = [
      createNote('note1', 'Test', 'remote content', date),
    ];

    const conflicts = detectConflicts(localNotes, remoteNotes);
    expect(conflicts).toHaveLength(0);
  });

  it('should not detect conflict when timestamps differ but content is same', () => {
    const localDate = new Date('2024-01-01T10:00:00Z');
    const remoteDate = new Date('2024-01-01T10:05:00Z');
    const localNotes: Note[] = [
      createNote('note1', 'Test', 'same content', localDate),
    ];
    const remoteNotes: Note[] = [
      createNote('note1', 'Test', 'same content', remoteDate),
    ];

    const conflicts = detectConflicts(localNotes, remoteNotes);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect multiple conflicts', () => {
    const localDate1 = new Date('2024-01-01T10:00:00Z');
    const remoteDate1 = new Date('2024-01-01T10:05:00Z');
    const localDate2 = new Date('2024-01-01T11:00:00Z');
    const remoteDate2 = new Date('2024-01-01T11:05:00Z');

    const localNotes: Note[] = [
      createNote('note1', 'Test 1', 'local content 1', localDate1),
      createNote('note2', 'Test 2', 'local content 2', localDate2),
    ];
    const remoteNotes: Note[] = [
      createNote('note1', 'Test 1', 'remote content 1', remoteDate1),
      createNote('note2', 'Test 2', 'remote content 2', remoteDate2),
    ];

    const conflicts = detectConflicts(localNotes, remoteNotes);
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0].noteId).toBe('note1');
    expect(conflicts[1].noteId).toBe('note2');
  });

  it('should handle notes that exist locally but not remotely', () => {
    const localDate = new Date();
    const localNotes: Note[] = [
      createNote('note1', 'Test', 'content', localDate),
    ];
    const remoteNotes: Note[] = [];

    const conflicts = detectConflicts(localNotes, remoteNotes);
    expect(conflicts).toHaveLength(0);
  });

  it('should handle notes that exist remotely but not locally', () => {
    const remoteDate = new Date();
    const localNotes: Note[] = [];
    const remoteNotes: Note[] = [
      createNote('note1', 'Test', 'content', remoteDate),
    ];

    const conflicts = detectConflicts(localNotes, remoteNotes);
    expect(conflicts).toHaveLength(0);
  });
});

describe('resolveConflict', () => {
  const createConflict = (
    noteId: string,
    localContent: string,
    remoteContent: string
  ): SyncConflict => {
    const now = new Date();
    return {
      noteId,
      localNote: {
        id: noteId,
        title: 'Test',
        content: localContent,
        createdAt: now,
        updatedAt: now,
      },
      remoteNote: {
        id: noteId,
        title: 'Test',
        content: remoteContent,
        createdAt: now,
        updatedAt: new Date(now.getTime() + 1000),
      },
      localUpdatedAt: now,
      remoteUpdatedAt: new Date(now.getTime() + 1000),
    };
  };

  it('should keep local when resolution is keep_local', () => {
    const conflict = createConflict('note1', 'local content', 'remote content');
    const result = resolveConflict(conflict, 'keep_local');

    expect(result.notesToKeep).toHaveLength(1);
    expect(result.notesToKeep[0].content).toBe('local content');
    expect(result.notesToDelete).toHaveLength(0);
  });

  it('should keep remote when resolution is keep_remote', () => {
    const conflict = createConflict('note1', 'local content', 'remote content');
    const result = resolveConflict(conflict, 'keep_remote');

    expect(result.notesToKeep).toHaveLength(1);
    expect(result.notesToKeep[0].content).toBe('remote content');
    expect(result.notesToDelete).toHaveLength(0);
  });

  it('should keep both when resolution is keep_both', () => {
    const conflict = createConflict('note1', 'local content', 'remote content');
    const result = resolveConflict(conflict, 'keep_both');

    expect(result.notesToKeep).toHaveLength(2);
    expect(result.notesToDelete).toHaveLength(0);

    // Local should be unchanged
    expect(result.notesToKeep[0].id).toBe('note1');
    expect(result.notesToKeep[0].content).toBe('local content');

    // Remote should have a new ID and modified title
    expect(result.notesToKeep[1].id).not.toBe('note1');
    expect(result.notesToKeep[1].id).toContain('note1-conflict-');
    expect(result.notesToKeep[1].title).toContain('(conflict copy)');
    expect(result.notesToKeep[1].content).toBe('remote content');
  });

  it('should default to keep_local for invalid resolution', () => {
    const conflict = createConflict('note1', 'local content', 'remote content');
    const result = resolveConflict(conflict, 'invalid' as ConflictResolution);

    expect(result.notesToKeep).toHaveLength(1);
    expect(result.notesToKeep[0].content).toBe('local content');
  });

  it('should preserve all note fields when keeping local', () => {
    const now = new Date();
    const conflict: SyncConflict = {
      noteId: 'note1',
      localNote: {
        id: 'note1',
        title: 'Local Title',
        content: 'local content',
        createdAt: now,
        updatedAt: now,
        tags: ['tag1', 'tag2'],
        highlights: [{ id: 'h1', text: 'highlight', color: 'yellow', position: 0, length: 9 }],
      },
      remoteNote: {
        id: 'note1',
        title: 'Remote Title',
        content: 'remote content',
        createdAt: now,
        updatedAt: new Date(now.getTime() + 1000),
      },
      localUpdatedAt: now,
      remoteUpdatedAt: new Date(now.getTime() + 1000),
    };

    const result = resolveConflict(conflict, 'keep_local');

    expect(result.notesToKeep[0].title).toBe('Local Title');
    expect(result.notesToKeep[0].tags).toEqual(['tag1', 'tag2']);
    expect(result.notesToKeep[0].highlights).toHaveLength(1);
  });

  it('should preserve all note fields when keeping remote', () => {
    const now = new Date();
    const conflict: SyncConflict = {
      noteId: 'note1',
      localNote: {
        id: 'note1',
        title: 'Local Title',
        content: 'local content',
        createdAt: now,
        updatedAt: now,
      },
      remoteNote: {
        id: 'note1',
        title: 'Remote Title',
        content: 'remote content',
        createdAt: now,
        updatedAt: new Date(now.getTime() + 1000),
        tags: ['remote-tag'],
      },
      localUpdatedAt: now,
      remoteUpdatedAt: new Date(now.getTime() + 1000),
    };

    const result = resolveConflict(conflict, 'keep_remote');

    expect(result.notesToKeep[0].title).toBe('Remote Title');
    expect(result.notesToKeep[0].tags).toEqual(['remote-tag']);
  });
});

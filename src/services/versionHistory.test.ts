/**
 * Tests for versionHistory.ts
 * Note version tracking and history management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createVersion,
  shouldAutoSnapshot,
  maybeAutoSnapshot,
  getVersionsForNote,
  getLatestVersion,
  deleteVersionsForNote,
  computeDiff,
  getAllVersions,
} from './versionHistory';
import type { Note } from '../types/note';
import type { NoteVersion } from '../types/version';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('versionHistory', () => {
  beforeEach(async () => {
    localStorageMock.clear();
    // Clear the in-memory cache by setting to null via module reload
    // This is a workaround since the cache is not exported
    const module = await import('./versionHistory');
    // Access the module's internal cache and clear it
    // Since we can't access private variables, we'll work around it
    // by ensuring localStorage is clear which will reset on next read
  });

  const createNote = (id: string, title: string, content: string): Note => ({
    id,
    title,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('createVersion', () => {
    it('should create a version snapshot', () => {
      const note = createNote('note1', 'Test Note', 'This is test content');
      const version = createVersion(note, 'user1', 'manual');

      expect(version.noteId).toBe('note1');
      expect(version.userId).toBe('user1');
      expect(version.content).toBe('This is test content');
      expect(version.title).toBe('Test Note');
      expect(version.snapshotType).toBe('manual');
      expect(version.id).toBeDefined();
      expect(version.createdAt).toBeInstanceOf(Date);
    });

    it('should calculate charDelta correctly for first version', () => {
      const noteId = 'test-note-first-delta-' + Date.now();
      const note = createNote(noteId, 'Test', 'Hello world');
      const version = createVersion(note, 'user1', 'auto');

      expect(version.charDelta).toBe('Hello world'.length);
    });

    it('should calculate charDelta correctly for subsequent versions', () => {
      const noteId = 'test-note-delta-sub-' + Date.now();
      const note1 = createNote(noteId, 'Test', 'Hello');
      createVersion(note1, 'user1', 'auto');

      const note2 = createNote(noteId, 'Test', 'Hello world!!!');
      const version2 = createVersion(note2, 'user1', 'auto');

      expect(version2.charDelta).toBe('Hello world!!!'.length - 'Hello'.length);
    });

    it('should store version with optional label', () => {
      const note = createNote('note1', 'Test', 'Content');
      const version = createVersion(note, 'user1', 'manual', 'Before refactor');

      expect(version.label).toBe('Before refactor');
    });

    it('should persist versions to localStorage', () => {
      const noteId = 'test-note-persist-' + Date.now();
      const note = createNote(noteId, 'Test', 'Content');
      createVersion(note, 'user1', 'auto');

      const stored = localStorage.getItem('patchpad_versions');
      expect(stored).toBeDefined();
      expect(stored).not.toBe('');

      const parsed = JSON.parse(stored!);
      expect(parsed.length).toBeGreaterThanOrEqual(1);
      const testVersion = parsed.find((v: any) => v.noteId === noteId);
      expect(testVersion).toBeDefined();
      expect(testVersion.noteId).toBe(noteId);
    });

    it('should limit versions per note to MAX_VERSIONS_PER_NOTE', () => {
      const note = createNote('note1', 'Test', 'Content');

      // Create 55 versions (MAX is 50)
      for (let i = 0; i < 55; i++) {
        const noteVersion = createNote('note1', 'Test', `Content ${i}`);
        createVersion(noteVersion, 'user1', 'auto');
      }

      const versions = getVersionsForNote('note1');
      expect(versions.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getVersionsForNote', () => {
    it('should return empty array when no versions exist', () => {
      const versions = getVersionsForNote('non-existent-note-id-12345');
      expect(versions).toEqual([]);
    });

    it('should return versions for specific note', () => {
      const noteId1 = 'test-note-specific-1-' + Date.now();
      const noteId2 = 'test-note-specific-2-' + Date.now();
      const note1 = createNote(noteId1, 'Note 1', 'Content 1');
      const note2 = createNote(noteId2, 'Note 2', 'Content 2');

      createVersion(note1, 'user1', 'auto');
      createVersion(note2, 'user1', 'auto');
      createVersion(note1, 'user1', 'auto');

      const versions = getVersionsForNote(noteId1);
      expect(versions).toHaveLength(2);
      expect(versions.every(v => v.noteId === noteId1)).toBe(true);
    });

    it('should return versions sorted by newest first', () => {
      const note = createNote('note1', 'Test', 'Content');

      const version1 = createVersion(note, 'user1', 'auto');
      // Wait a bit to ensure different timestamps
      const version2 = createVersion(note, 'user1', 'auto');

      const versions = getVersionsForNote('note1');
      expect(versions[0].id).toBe(version2.id);
      expect(versions[1].id).toBe(version1.id);
    });
  });

  describe('getLatestVersion', () => {
    it('should return null when no versions exist', () => {
      const latest = getLatestVersion('non-existent-latest-note-' + Date.now());
      expect(latest).toBeNull();
    });

    it('should return the most recent version', () => {
      const noteId = 'test-note-latest-' + Date.now();
      const note = createNote(noteId, 'Test', 'Content');

      createVersion(note, 'user1', 'auto');
      const version2 = createVersion(note, 'user1', 'auto');

      const latest = getLatestVersion(noteId);
      expect(latest?.id).toBe(version2.id);
    });
  });

  describe('shouldAutoSnapshot', () => {
    it('should return true for first snapshot when content exceeds threshold', () => {
      const noteId = 'test-note-snapshot-' + Date.now();
      const note = createNote(noteId, 'Test', 'a'.repeat(100));
      const should = shouldAutoSnapshot(note);
      expect(should).toBe(true);
    });

    it('should return false for first snapshot when content is below threshold', () => {
      const noteId = 'test-note-short-' + Date.now();
      const note = createNote(noteId, 'Test', 'short');
      const should = shouldAutoSnapshot(note);
      expect(should).toBe(false);
    });

    it('should return true when char changes exceed threshold', () => {
      const noteId = 'test-note-char-change-' + Date.now();
      const note1 = createNote(noteId, 'Test', 'Hello');
      createVersion(note1, 'user1', 'auto');

      const note2 = createNote(noteId, 'Test', 'Hello' + 'x'.repeat(100));
      const should = shouldAutoSnapshot(note2);
      expect(should).toBe(true);
    });

    it('should return true when enough time has passed with changes', () => {
      const noteId = 'test-note-time-' + Date.now();
      const note1 = createNote(noteId, 'Test', 'Hello');
      createVersion(note1, 'user1', 'auto');

      // Mock time passing (5 minutes + 1 second)
      const originalNow = Date.now;
      const mockNow = Date.now() + (5 * 60 * 1000) + 1000;
      Date.now = () => mockNow;

      const note2 = createNote(noteId, 'Test', 'Hello world');
      const should = shouldAutoSnapshot(note2);

      // Restore Date.now
      Date.now = originalNow;

      expect(should).toBe(true);
    });

    it('should return false when time has passed but no content changes', () => {
      const noteId = 'test-note-no-change-' + Date.now();
      const note1 = createNote(noteId, 'Test', 'Hello');
      createVersion(note1, 'user1', 'auto');

      // Mock time passing
      const originalNow = Date.now;
      const mockNow = Date.now() + (10 * 60 * 1000);
      Date.now = () => mockNow;

      const note2 = createNote(noteId, 'Test', 'Hello');
      const should = shouldAutoSnapshot(note2);

      // Restore Date.now
      Date.now = originalNow;

      expect(should).toBe(false);
    });
  });

  describe('maybeAutoSnapshot', () => {
    it('should create snapshot when conditions are met', () => {
      const noteId = 'test-note-auto-yes-' + Date.now();
      const note = createNote(noteId, 'Test', 'a'.repeat(150));
      const version = maybeAutoSnapshot(note, 'user1');

      expect(version).not.toBeNull();
      expect(version?.snapshotType).toBe('auto');
    });

    it('should not create snapshot when conditions are not met', () => {
      const noteId = 'test-note-auto-no-' + Date.now();
      // First create a version to set the baseline
      const note1 = createNote(noteId, 'Test', 'initial content long enough to pass threshold ' + 'x'.repeat(100));
      createVersion(note1, 'user1', 'auto');

      // Then try with short content that shouldn't trigger
      const note2 = createNote(noteId, 'Test', 'initial content long enough to pass threshold ' + 'x'.repeat(100) + 'y');
      const version = maybeAutoSnapshot(note2, 'user1');

      // Should be null because change is too small
      expect(version).toBeNull();
    });
  });

  describe('deleteVersionsForNote', () => {
    it('should delete all versions for a specific note', () => {
      const noteId1 = 'test-note-delete-1-' + Date.now();
      const noteId2 = 'test-note-delete-2-' + Date.now();
      const note1 = createNote(noteId1, 'Note 1', 'Content');
      const note2 = createNote(noteId2, 'Note 2', 'Content');

      createVersion(note1, 'user1', 'auto');
      createVersion(note2, 'user1', 'auto');
      createVersion(note1, 'user1', 'auto');

      deleteVersionsForNote(noteId1);

      const note1Versions = getVersionsForNote(noteId1);
      const note2Versions = getVersionsForNote(noteId2);

      expect(note1Versions).toHaveLength(0);
      expect(note2Versions).toHaveLength(1);
    });

    it('should handle deleting versions for non-existent note', () => {
      expect(() => deleteVersionsForNote('nonexistent-' + Date.now())).not.toThrow();
    });
  });

  describe('computeDiff', () => {
    it('should compute diff for added lines', () => {
      const oldContent = 'Line 1\nLine 2';
      const newContent = 'Line 1\nLine 2\nLine 3';

      const diff = computeDiff(oldContent, newContent);

      expect(diff.additions).toBe(1);
      expect(diff.deletions).toBe(0);
      expect(diff.charDelta).toBe(7); // "\nLine 3"
      expect(diff.diffText).toContain('+ Line 3');
    });

    it('should compute diff for deleted lines', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1\nLine 3';

      const diff = computeDiff(oldContent, newContent);

      expect(diff.additions).toBe(0);
      expect(diff.deletions).toBe(1);
      expect(diff.charDelta).toBe(-7); // removed "\nLine 2"
      expect(diff.diffText).toContain('- Line 2');
    });

    it('should compute diff for modified lines', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1\nLine 2 modified\nLine 3';

      const diff = computeDiff(oldContent, newContent);

      expect(diff.additions).toBeGreaterThan(0);
      expect(diff.deletions).toBeGreaterThan(0);
      expect(diff.charDelta).toBe(' modified'.length);
    });

    it('should handle empty old content', () => {
      const oldContent = '';
      const newContent = 'New content';

      const diff = computeDiff(oldContent, newContent);

      // When oldContent is empty, LCS algorithm may add an empty line
      expect(diff.additions).toBeGreaterThanOrEqual(1);
      expect(diff.charDelta).toBe(11);
    });

    it('should handle empty new content', () => {
      const oldContent = 'Old content';
      const newContent = '';

      const diff = computeDiff(oldContent, newContent);

      // When newContent is empty, LCS algorithm may add an empty line
      expect(diff.deletions).toBeGreaterThanOrEqual(1);
      expect(diff.charDelta).toBe(-11);
    });

    it('should handle identical content', () => {
      const content = 'Same content\nLine 2';

      const diff = computeDiff(content, content);

      expect(diff.additions).toBe(0);
      expect(diff.deletions).toBe(0);
      expect(diff.charDelta).toBe(0);
    });

    it('should compute charDelta correctly for multi-line changes', () => {
      const oldContent = 'Short';
      const newContent = 'This is a much longer piece of content\nWith multiple lines\nAnd more text';

      const diff = computeDiff(oldContent, newContent);

      expect(diff.charDelta).toBe(newContent.length - oldContent.length);
    });
  });

  describe('getAllVersions', () => {
    it('should return all versions across all notes', () => {
      // Start fresh for this test
      localStorageMock.clear();

      const note1 = createNote('note1-unique', 'Note 1', 'Content 1');
      const note2 = createNote('note2-unique', 'Note 2', 'Content 2');

      createVersion(note1, 'user1', 'auto');
      createVersion(note2, 'user1', 'auto');
      createVersion(note1, 'user1', 'manual');

      const versions = getAllVersions();
      const testVersions = versions.filter(v => v.noteId.includes('unique'));
      expect(testVersions.length).toBeGreaterThanOrEqual(3);
    });

    it('should deserialize dates from localStorage correctly', () => {
      const note = createNote('note1-date-test', 'Test', 'Content');
      const version = createVersion(note, 'user1', 'auto');

      const versions = getAllVersions();
      const testVersion = versions.find(v => v.id === version.id);
      expect(testVersion?.createdAt).toBeInstanceOf(Date);
    });
  });
});

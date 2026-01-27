/**
 * Embeddings Service Tests
 *
 * Comprehensive test coverage for vector embedding generation and caching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isEmbeddingsAvailable,
  generateEmbedding,
  getEmbeddingForNote,
  generateAllEmbeddings,
  cosineSimilarity,
  getAllEmbeddings,
  deleteEmbedding,
  getEmbeddingStats,
} from './embeddings';
import { db } from '../db';
import type { Note } from '../types/note';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch for OpenAI API
global.fetch = vi.fn();

describe('embeddings service', () => {
  beforeEach(async () => {
    // Clear localStorage
    localStorageMock.clear();

    // Clear database
    await db.delete();
    await db.open();

    // Reset fetch mock
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('isEmbeddingsAvailable', () => {
    it('returns false when no API key is configured', () => {
      expect(isEmbeddingsAvailable()).toBe(false);
    });

    it('returns true when API key is configured', () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');
      expect(isEmbeddingsAvailable()).toBe(true);
    });
  });

  describe('generateEmbedding', () => {
    it('throws error when API key is not configured', async () => {
      await expect(generateEmbedding('test text')).rejects.toThrow(
        'OpenAI API key not configured'
      );
    });

    it('generates embedding using OpenAI API', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      const mockEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      const embedding = await generateEmbedding('test text');

      expect(embedding).toEqual(mockEmbedding);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk-test-key',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: 'test text',
          }),
        })
      );
    });

    it('truncates very long text to avoid token limits', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      const longText = 'a'.repeat(40000);
      const mockEmbedding = new Array(1536).fill(0.5);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      await generateEmbedding(longText);

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callBody.input.length).toBeLessThanOrEqual(30000);
    });

    it('throws error when API request fails', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Invalid API key' },
        }),
      });

      await expect(generateEmbedding('test')).rejects.toThrow('Invalid API key');
    });

    it('throws generic error when API returns no error message', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      await expect(generateEmbedding('test')).rejects.toThrow(
        'Failed to generate embedding'
      );
    });
  });

  describe('getEmbeddingForNote', () => {
    const createMockNote = (id: string, content: string): Note => ({
      id,
      title: `Note ${id}`,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      starred: false,
    });

    it('generates and caches embedding for new note', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      const note = createMockNote('note1', 'Test content');
      const mockEmbedding = new Array(1536).fill(0.5);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      const embedding = await getEmbeddingForNote(note);

      expect(embedding).toEqual(mockEmbedding);

      // Verify it was cached
      const cached = await db.table('embeddings').where('noteId').equals('note1').first();
      expect(cached).toBeDefined();
      expect(cached.embedding).toEqual(mockEmbedding);
    });

    it('returns cached embedding when content has not changed', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      const note = createMockNote('note2', 'Cached content');
      const mockEmbedding = new Array(1536).fill(0.7);

      // First call generates and caches
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      await getEmbeddingForNote(note);

      // Second call should use cache (no fetch)
      vi.clearAllMocks();
      const cachedEmbedding = await getEmbeddingForNote(note);

      expect(cachedEmbedding).toEqual(mockEmbedding);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('regenerates embedding when content changes', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      const note = createMockNote('note3', 'Original content');
      const mockEmbedding1 = new Array(1536).fill(0.3);
      const mockEmbedding2 = new Array(1536).fill(0.8);

      // First call
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding1 }],
        }),
      });

      await getEmbeddingForNote(note);

      // Update note content
      const updatedNote = { ...note, content: 'Updated content' };

      // Second call with updated content
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding2 }],
        }),
      });

      const newEmbedding = await getEmbeddingForNote(updatedNote);

      expect(newEmbedding).toEqual(mockEmbedding2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('includes both title and content in embedding', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      const note = createMockNote('note4', 'Body text');
      note.title = 'Important Title';
      const mockEmbedding = new Array(1536).fill(0.6);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      await getEmbeddingForNote(note);

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callBody.input).toContain('Important Title');
      expect(callBody.input).toContain('Body text');
    });
  });

  describe('generateAllEmbeddings', () => {
    const createMockNote = (id: string, content: string): Note => ({
      id,
      title: `Note ${id}`,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      starred: false,
    });

    it('throws error when API key is not configured', async () => {
      const notes = [createMockNote('1', 'test')];
      await expect(generateAllEmbeddings(notes)).rejects.toThrow(
        'OpenAI API key not configured'
      );
    });

    it('generates embeddings for all notes', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      const notes = [
        createMockNote('1', 'First note'),
        createMockNote('2', 'Second note'),
        createMockNote('3', 'Third note'),
      ];

      const mockEmbedding = new Array(1536).fill(0.5);

      // Mock fetch for all notes
      for (let i = 0; i < notes.length; i++) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ embedding: mockEmbedding }],
          }),
        });
      }

      await generateAllEmbeddings(notes);

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('calls progress callback with correct counts', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      const notes = [
        createMockNote('1', 'First'),
        createMockNote('2', 'Second'),
      ];

      const mockEmbedding = new Array(1536).fill(0.5);
      const progressCalls: Array<{ completed: number; total: number }> = [];

      for (let i = 0; i < notes.length; i++) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ embedding: mockEmbedding }],
          }),
        });
      }

      await generateAllEmbeddings(notes, (completed, total) => {
        progressCalls.push({ completed, total });
      });

      expect(progressCalls).toEqual([
        { completed: 1, total: 2 },
        { completed: 2, total: 2 },
      ]);
    });

    it('continues processing even if one embedding fails', async () => {
      localStorage.setItem('openai_api_key', 'sk-test-key');

      const notes = [
        createMockNote('1', 'First'),
        createMockNote('2', 'Second'),
        createMockNote('3', 'Third'),
      ];

      const mockEmbedding = new Array(1536).fill(0.5);
      const progressCalls: Array<{ completed: number; total: number }> = [];

      // First succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      // Second fails
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Rate limit' },
        }),
      });

      // Third succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      await generateAllEmbeddings(notes, (completed, total) => {
        progressCalls.push({ completed, total });
      });

      // All three should be marked as completed despite middle failure
      expect(progressCalls).toHaveLength(3);
      expect(progressCalls[2]).toEqual({ completed: 3, total: 3 });
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const v1 = [1, 2, 3, 4];
      const v2 = [1, 2, 3, 4];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
    });

    it('returns 0 for orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0);
    });

    it('returns -1 for opposite vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [-1, -2, -3];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0);
    });

    it('calculates similarity for normalized vectors', () => {
      const v1 = [0.6, 0.8];
      const v2 = [0.8, 0.6];
      const similarity = cosineSimilarity(v1, v2);
      expect(similarity).toBeGreaterThan(0.9);
      expect(similarity).toBeLessThan(1.0);
    });

    it('returns 0 when one vector is zero', () => {
      const v1 = [1, 2, 3];
      const v2 = [0, 0, 0];
      expect(cosineSimilarity(v1, v2)).toBe(0);
    });

    it('throws error for vectors of different lengths', () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2];
      expect(() => cosineSimilarity(v1, v2)).toThrow('Vectors must have same length');
    });

    it('handles high-dimensional vectors', () => {
      const v1 = new Array(1536).fill(1);
      const v2 = new Array(1536).fill(1);
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
    });
  });

  describe('getAllEmbeddings', () => {
    it('returns empty map when no embeddings exist', async () => {
      const embeddings = await getAllEmbeddings();
      expect(embeddings.size).toBe(0);
    });

    it('returns all cached embeddings as a map', async () => {
      const mockEmbedding1 = new Array(1536).fill(0.1);
      const mockEmbedding2 = new Array(1536).fill(0.2);

      await db.table('embeddings').add({
        id: 'note1',
        noteId: 'note1',
        embedding: mockEmbedding1,
        contentHash: 'hash1',
        createdAt: new Date(),
      });

      await db.table('embeddings').add({
        id: 'note2',
        noteId: 'note2',
        embedding: mockEmbedding2,
        contentHash: 'hash2',
        createdAt: new Date(),
      });

      const embeddings = await getAllEmbeddings();

      expect(embeddings.size).toBe(2);
      expect(embeddings.get('note1')).toEqual(mockEmbedding1);
      expect(embeddings.get('note2')).toEqual(mockEmbedding2);
    });
  });

  describe('deleteEmbedding', () => {
    it('deletes embedding for specified note', async () => {
      const mockEmbedding = new Array(1536).fill(0.5);

      await db.table('embeddings').add({
        id: 'note1',
        noteId: 'note1',
        embedding: mockEmbedding,
        contentHash: 'hash1',
        createdAt: new Date(),
      });

      await deleteEmbedding('note1');

      const cached = await db.table('embeddings').where('noteId').equals('note1').first();
      expect(cached).toBeUndefined();
    });

    it('does not throw error when deleting non-existent embedding', async () => {
      await expect(deleteEmbedding('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('getEmbeddingStats', () => {
    const createMockNote = (id: string, content: string): Note => ({
      id,
      title: `Note ${id}`,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      starred: false,
    });

    it('returns zero stats when no notes exist', async () => {
      const stats = await getEmbeddingStats();
      expect(stats).toEqual({
        totalNotes: 0,
        embeddedNotes: 0,
        needsUpdate: 0,
      });
    });

    it('identifies notes that need embeddings', async () => {
      await db.notes.add(createMockNote('1', 'First note'));
      await db.notes.add(createMockNote('2', 'Second note'));

      const stats = await getEmbeddingStats();

      expect(stats).toEqual({
        totalNotes: 2,
        embeddedNotes: 0,
        needsUpdate: 2,
      });
    });

    it('identifies notes with up-to-date embeddings', async () => {
      const note = createMockNote('1', 'Test content');
      await db.notes.add(note);

      // Manually compute the hash as the service does
      const contentHash = (() => {
        let hash = 0;
        const content = note.content;
        for (let i = 0; i < content.length; i++) {
          const char = content.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return hash.toString(16);
      })();

      await db.table('embeddings').add({
        id: '1',
        noteId: '1',
        embedding: new Array(1536).fill(0.5),
        contentHash,
        createdAt: new Date(),
      });

      const stats = await getEmbeddingStats();

      expect(stats).toEqual({
        totalNotes: 1,
        embeddedNotes: 1,
        needsUpdate: 0,
      });
    });

    it('identifies notes with outdated embeddings', async () => {
      const note = createMockNote('1', 'Updated content');
      await db.notes.add(note);

      // Add embedding with old content hash
      await db.table('embeddings').add({
        id: '1',
        noteId: '1',
        embedding: new Array(1536).fill(0.5),
        contentHash: 'old-hash',
        createdAt: new Date(),
      });

      const stats = await getEmbeddingStats();

      expect(stats).toEqual({
        totalNotes: 1,
        embeddedNotes: 1,
        needsUpdate: 1,
      });
    });

    it('handles mixed states correctly', async () => {
      const note1 = createMockNote('1', 'First note');
      const note2 = createMockNote('2', 'Second note');
      const note3 = createMockNote('3', 'Third note');

      await db.notes.bulkAdd([note1, note2, note3]);

      // Note 1: up-to-date embedding
      const contentHash1 = (() => {
        let hash = 0;
        const content = note1.content;
        for (let i = 0; i < content.length; i++) {
          const char = content.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return hash.toString(16);
      })();

      await db.table('embeddings').add({
        id: '1',
        noteId: '1',
        embedding: new Array(1536).fill(0.5),
        contentHash: contentHash1,
        createdAt: new Date(),
      });

      // Note 2: outdated embedding
      await db.table('embeddings').add({
        id: '2',
        noteId: '2',
        embedding: new Array(1536).fill(0.5),
        contentHash: 'outdated-hash',
        createdAt: new Date(),
      });

      // Note 3: no embedding

      const stats = await getEmbeddingStats();

      expect(stats).toEqual({
        totalNotes: 3,
        embeddedNotes: 2,
        needsUpdate: 2, // Note 2 (outdated) + Note 3 (missing)
      });
    });
  });
});

/**
 * Tests for semanticSearch.ts
 * Semantic and keyword-based search across notes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  searchNotes,
  findSimilarNotes,
  hybridSearch,
  getNotesAbout,
  type SearchResult,
} from './semanticSearch';
import type { Note } from '../types/note';
import * as embeddings from './embeddings';

// Mock the embeddings module
vi.mock('./embeddings', () => ({
  generateEmbedding: vi.fn(),
  getEmbeddingForNote: vi.fn(),
  cosineSimilarity: vi.fn(),
  isEmbeddingsAvailable: vi.fn(),
}));

// Mock the database
vi.mock('../db', () => ({
  db: {
    notes: {
      toArray: vi.fn(),
      get: vi.fn(),
    },
  },
}));

describe('semanticSearch', () => {
  const createNote = (id: string, title: string, content: string): Note => ({
    id,
    title,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchNotes', () => {
    describe('with embeddings available', () => {
      beforeEach(() => {
        vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(true);
      });

      it('should return top-k notes by semantic similarity', async () => {
        const notes = [
          createNote('1', 'JavaScript Basics', 'Learn about variables and functions'),
          createNote('2', 'Python Tutorial', 'Introduction to Python programming'),
          createNote('3', 'TypeScript Guide', 'TypeScript is a typed superset of JavaScript'),
        ];

        const queryEmbedding = [0.1, 0.2, 0.3];
        vi.mocked(embeddings.generateEmbedding).mockResolvedValue(queryEmbedding);

        // Mock embeddings for each note
        vi.mocked(embeddings.getEmbeddingForNote)
          .mockResolvedValueOnce([0.1, 0.2, 0.3]) // Perfect match
          .mockResolvedValueOnce([0.5, 0.6, 0.7]) // Low similarity
          .mockResolvedValueOnce([0.15, 0.25, 0.35]); // High similarity

        // Mock similarity scores
        vi.mocked(embeddings.cosineSimilarity)
          .mockReturnValueOnce(0.95) // Note 1: high
          .mockReturnValueOnce(0.2)  // Note 2: low (filtered out)
          .mockReturnValueOnce(0.85); // Note 3: high

        const results = await searchNotes('JavaScript programming', 2, notes);

        expect(results).toHaveLength(2);
        expect(results[0].note.id).toBe('1');
        expect(results[0].score).toBe(0.95);
        expect(results[1].note.id).toBe('3');
        expect(results[1].score).toBe(0.85);
      });

      it('should filter out notes below similarity threshold', async () => {
        const notes = [
          createNote('1', 'Note 1', 'Content 1'),
          createNote('2', 'Note 2', 'Content 2'),
        ];

        vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1, 0.2]);
        vi.mocked(embeddings.getEmbeddingForNote)
          .mockResolvedValueOnce([0.1, 0.2])
          .mockResolvedValueOnce([0.9, 0.9]);

        // First note above threshold, second below
        vi.mocked(embeddings.cosineSimilarity)
          .mockReturnValueOnce(0.8)
          .mockReturnValueOnce(0.25);

        const results = await searchNotes('query', 5, notes);

        expect(results).toHaveLength(1);
        expect(results[0].note.id).toBe('1');
      });

      it('should include relevant excerpts', async () => {
        const notes = [
          createNote('1', 'Note', 'This is some content. JavaScript is great. More content here.'),
        ];

        vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1]);
        vi.mocked(embeddings.getEmbeddingForNote).mockResolvedValue([0.1]);
        vi.mocked(embeddings.cosineSimilarity).mockReturnValue(0.9);

        const results = await searchNotes('JavaScript', 1, notes);

        expect(results[0].relevantExcerpt).toBeDefined();
        expect(results[0].relevantExcerpt).toContain('JavaScript');
      });

      it('should handle embedding errors gracefully', async () => {
        const notes = [
          createNote('1', 'Good Note', 'Content'),
          createNote('2', 'Bad Note', 'Content'),
        ];

        vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1]);
        vi.mocked(embeddings.getEmbeddingForNote)
          .mockResolvedValueOnce([0.1])
          .mockRejectedValueOnce(new Error('Embedding failed'));

        vi.mocked(embeddings.cosineSimilarity).mockReturnValue(0.8);

        const results = await searchNotes('query', 5, notes);

        // Should only include the note that didn't error
        expect(results).toHaveLength(1);
        expect(results[0].note.id).toBe('1');
      });

      it('should respect k parameter', async () => {
        const notes = Array.from({ length: 10 }, (_, i) =>
          createNote(`${i}`, `Note ${i}`, 'Content')
        );

        vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1]);
        vi.mocked(embeddings.getEmbeddingForNote).mockResolvedValue([0.1]);
        vi.mocked(embeddings.cosineSimilarity).mockReturnValue(0.8);

        const results = await searchNotes('query', 3, notes);

        expect(results).toHaveLength(3);
      });
    });

    describe('without embeddings (keyword fallback)', () => {
      beforeEach(() => {
        vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(false);
      });

      it('should fall back to keyword search', async () => {
        const notes = [
          createNote('1', 'JavaScript Tutorial', 'Learn JavaScript basics'),
          createNote('2', 'Python Guide', 'Python programming concepts'),
          createNote('3', 'Web Development', 'JavaScript and HTML'),
        ];

        const results = await searchNotes('JavaScript', 5, notes);

        expect(results.length).toBeGreaterThan(0);
        // Notes with JavaScript should rank higher
        expect(results[0].note.title).toContain('JavaScript');
      });

      it('should score title matches higher than content matches', async () => {
        const notes = [
          createNote('1', 'React', 'Some content about programming'),
          createNote('2', 'Programming Guide', 'React is a JavaScript library for building user interfaces'),
        ];

        const results = await searchNotes('React', 5, notes);

        // Note with React in title should score higher
        expect(results[0].note.id).toBe('1');
      });

      it('should handle multi-word queries', async () => {
        const notes = [
          createNote('1', 'Note', 'Machine learning algorithms'),
          createNote('2', 'Note', 'Deep learning and neural networks'),
        ];

        const results = await searchNotes('machine learning', 5, notes);

        expect(results).toHaveLength(2);
        // Note with both words should rank higher
        expect(results[0].note.content).toContain('Machine learning');
      });

      it('should filter out short words', async () => {
        const notes = [
          createNote('1', 'A Note', 'This is a test note with some content'),
        ];

        const results = await searchNotes('a is the', 5, notes);

        // Should return no results as all words are too short
        expect(results).toHaveLength(0);
      });

      it('should normalize scores to 0-1 range', async () => {
        const notes = [
          createNote('1', 'Note', 'test test test'),
        ];

        const results = await searchNotes('test', 5, notes);

        expect(results[0].score).toBeGreaterThanOrEqual(0);
        expect(results[0].score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('findSimilarNotes', () => {
    it('should find notes similar to a given note', async () => {
      const { db } = await import('../db');
      const targetNote = createNote('target', 'Machine Learning', 'Introduction to ML concepts and algorithms');
      const similarNote = createNote('similar', 'AI Basics', 'Artificial intelligence and ML fundamentals');
      const unrelatedNote = createNote('unrelated', 'Cooking', 'How to make pasta');

      vi.mocked(db.notes.get).mockResolvedValue(targetNote);
      vi.mocked(db.notes.toArray).mockResolvedValue([targetNote, similarNote, unrelatedNote]);

      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(true);
      vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1, 0.2]);
      vi.mocked(embeddings.getEmbeddingForNote).mockResolvedValue([0.1, 0.2]);
      vi.mocked(embeddings.cosineSimilarity)
        .mockReturnValueOnce(0.9)  // similar note
        .mockReturnValueOnce(0.1); // unrelated note

      const results = await findSimilarNotes('target', 5);

      expect(results).toHaveLength(1);
      expect(results[0].note.id).toBe('similar');
    });

    it('should exclude the source note from results', async () => {
      const { db } = await import('../db');
      const targetNote = createNote('target', 'Title', 'Content');

      vi.mocked(db.notes.get).mockResolvedValue(targetNote);
      vi.mocked(db.notes.toArray).mockResolvedValue([targetNote]);

      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(false);

      const results = await findSimilarNotes('target', 5);

      expect(results).toHaveLength(0);
    });

    it('should return empty array if note not found', async () => {
      const { db } = await import('../db');
      vi.mocked(db.notes.get).mockResolvedValue(undefined);

      const results = await findSimilarNotes('nonexistent', 5);

      expect(results).toHaveLength(0);
    });

    it('should use title and first paragraph as query', async () => {
      const { db } = await import('../db');
      const targetNote = createNote(
        'target',
        'Machine Learning',
        'Introduction to ML.\n\nSecond paragraph.\n\nThird paragraph.'
      );

      vi.mocked(db.notes.get).mockResolvedValue(targetNote);
      vi.mocked(db.notes.toArray).mockResolvedValue([targetNote]);
      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(true);
      vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1]);

      await findSimilarNotes('target', 5);

      // Verify that generateEmbedding was called with title + first paragraph
      expect(embeddings.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('Machine Learning')
      );
      expect(embeddings.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('Introduction to ML')
      );
    });
  });

  describe('hybridSearch', () => {
    it('should combine semantic and keyword results', async () => {
      const notes = [
        createNote('1', 'JavaScript', 'Programming language'),
        createNote('2', 'Python', 'Programming language'),
        createNote('3', 'Ruby', 'Programming language'),
      ];

      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(true);
      vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1]);
      vi.mocked(embeddings.getEmbeddingForNote).mockResolvedValue([0.1]);

      // Semantic search ranks Note 2 highest
      vi.mocked(embeddings.cosineSimilarity)
        .mockReturnValueOnce(0.5)  // Note 1
        .mockReturnValueOnce(0.9)  // Note 2
        .mockReturnValueOnce(0.4); // Note 3

      const results = await hybridSearch('programming', 3, notes);

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should deduplicate results', async () => {
      const notes = [
        createNote('1', 'JavaScript Guide', 'JavaScript programming'),
      ];

      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(true);
      vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1]);
      vi.mocked(embeddings.getEmbeddingForNote).mockResolvedValue([0.1]);
      vi.mocked(embeddings.cosineSimilarity).mockReturnValue(0.8);

      const results = await hybridSearch('JavaScript', 5, notes);

      // Should not have duplicate note IDs
      const ids = results.map(r => r.note.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should prefer semantic results when available', async () => {
      const notes = [
        createNote('1', 'Exact match', 'Content'),
        createNote('2', 'Semantic match', 'Related content'),
      ];

      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(true);
      vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1]);
      vi.mocked(embeddings.getEmbeddingForNote).mockResolvedValue([0.1]);

      // Note 2 has higher semantic score
      vi.mocked(embeddings.cosineSimilarity)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.95);

      const results = await hybridSearch('query', 2, notes);

      expect(results[0].note.id).toBe('2');
    });

    it('should handle semantic search failures gracefully', async () => {
      const notes = [
        createNote('1', 'Note', 'Content with keywords'),
      ];

      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(true);
      vi.mocked(embeddings.generateEmbedding).mockRejectedValue(new Error('API error'));

      const results = await hybridSearch('keywords', 5, notes);

      // Should still return keyword results
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getNotesAbout', () => {
    it('should use hybrid search with k=10', async () => {
      const notes = Array.from({ length: 15 }, (_, i) =>
        createNote(`${i}`, `Note ${i}`, `Content about topic`)
      );

      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(false);

      const results = await getNotesAbout('topic');

      // Should return up to 10 results
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('excerpt extraction', () => {
    it('should extract relevant excerpts containing query words', async () => {
      const note = createNote(
        '1',
        'Title',
        'Irrelevant start. This is about JavaScript programming. More content.'
      );

      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(true);
      vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1]);
      vi.mocked(embeddings.getEmbeddingForNote).mockResolvedValue([0.1]);
      vi.mocked(embeddings.cosineSimilarity).mockReturnValue(0.8);

      const results = await searchNotes('JavaScript', 1, [note]);

      expect(results[0].relevantExcerpt).toContain('JavaScript');
    });

    it('should add ellipsis for truncated excerpts', async () => {
      const longContent = 'Start content. ' + 'x'.repeat(500) + ' JavaScript here ' + 'y'.repeat(500);
      const note = createNote('1', 'Title', longContent);

      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(true);
      vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1]);
      vi.mocked(embeddings.getEmbeddingForNote).mockResolvedValue([0.1]);
      vi.mocked(embeddings.cosineSimilarity).mockReturnValue(0.8);

      const results = await searchNotes('JavaScript', 1, [note]);

      expect(results[0].relevantExcerpt).toMatch(/\.\.\./);
    });

    it('should try to extract complete sentences', async () => {
      const note = createNote(
        '1',
        'Title',
        'First sentence. Second sentence with JavaScript keyword. Third sentence.'
      );

      vi.mocked(embeddings.isEmbeddingsAvailable).mockReturnValue(true);
      vi.mocked(embeddings.generateEmbedding).mockResolvedValue([0.1]);
      vi.mocked(embeddings.getEmbeddingForNote).mockResolvedValue([0.1]);
      vi.mocked(embeddings.cosineSimilarity).mockReturnValue(0.8);

      const results = await searchNotes('JavaScript', 1, [note]);

      // Excerpt should ideally be a complete sentence
      expect(results[0].relevantExcerpt).toContain('JavaScript');
    });
  });
});

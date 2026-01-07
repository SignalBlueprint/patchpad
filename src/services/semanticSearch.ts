/**
 * Semantic Search Service
 *
 * Provides vector-based semantic search across notes using embeddings.
 * Returns notes ranked by relevance to the query.
 */

import { db } from '../db';
import type { Note } from '../types/note';
import {
  generateEmbedding,
  getEmbeddingForNote,
  cosineSimilarity,
  isEmbeddingsAvailable,
} from './embeddings';

export interface SearchResult {
  note: Note;
  score: number;
  relevantExcerpt?: string;
}

/**
 * Search notes by semantic similarity to a query
 * Returns top-k most relevant notes
 */
export async function searchNotes(
  query: string,
  k: number = 5,
  notes?: Note[]
): Promise<SearchResult[]> {
  if (!isEmbeddingsAvailable()) {
    // Fall back to keyword search if embeddings not available
    return keywordSearch(query, k, notes);
  }

  // Get query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Get all notes if not provided
  const allNotes = notes ?? await db.notes.toArray();

  // Calculate similarity scores
  const results: SearchResult[] = [];

  for (const note of allNotes) {
    try {
      const noteEmbedding = await getEmbeddingForNote(note);
      const score = cosineSimilarity(queryEmbedding, noteEmbedding);

      // Only include notes with reasonable similarity
      if (score > 0.3) {
        results.push({
          note,
          score,
          relevantExcerpt: extractRelevantExcerpt(note.content, query),
        });
      }
    } catch (err) {
      // Skip notes that fail embedding
      console.warn(`Failed to get embedding for note ${note.id}:`, err);
    }
  }

  // Sort by score descending and return top k
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}

/**
 * Keyword-based fallback search
 */
function keywordSearch(query: string, k: number, notes?: Note[]): SearchResult[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  const results: SearchResult[] = [];

  const allNotes = notes ?? [];
  for (const note of allNotes) {
    const contentLower = note.content.toLowerCase();
    const titleLower = note.title.toLowerCase();

    // Score based on word matches
    let score = 0;
    for (const word of queryWords) {
      if (titleLower.includes(word)) {
        score += 2; // Title matches are worth more
      }
      const contentMatches = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += Math.min(contentMatches, 5); // Cap per-word contribution
    }

    if (score > 0) {
      results.push({
        note,
        score: score / 10, // Normalize to 0-1 range roughly
        relevantExcerpt: extractRelevantExcerpt(note.content, query),
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}

/**
 * Extract a relevant excerpt from content based on query
 */
function extractRelevantExcerpt(content: string, query: string, maxLength: number = 200): string {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  // Find first occurrence of any query word
  const contentLower = content.toLowerCase();
  let bestStart = 0;
  let bestScore = 0;

  for (let i = 0; i < content.length - 50; i++) {
    let score = 0;
    const window = contentLower.slice(i, i + maxLength);

    for (const word of queryWords) {
      if (window.includes(word)) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }

  // Find sentence boundaries
  let start = bestStart;
  while (start > 0 && !/[.!?\n]/.test(content[start - 1])) {
    start--;
  }

  let end = Math.min(start + maxLength, content.length);
  while (end < content.length && !/[.!?\n]/.test(content[end])) {
    end++;
  }

  let excerpt = content.slice(start, end + 1).trim();

  // Add ellipsis if needed
  if (start > 0) excerpt = '...' + excerpt;
  if (end < content.length - 1) excerpt = excerpt + '...';

  return excerpt;
}

/**
 * Find notes similar to a given note
 */
export async function findSimilarNotes(
  noteId: string,
  k: number = 5
): Promise<SearchResult[]> {
  const note = await db.notes.get(noteId);
  if (!note) return [];

  // Search using the note's content as the query
  const allNotes = await db.notes.toArray();
  const otherNotes = allNotes.filter(n => n.id !== noteId);

  // Use title + first paragraph as query to find similar content
  const firstParagraph = note.content.split('\n\n')[0] || note.content.slice(0, 500);
  const query = note.title + ' ' + firstParagraph;

  return searchNotes(query, k, otherNotes);
}

/**
 * Search with hybrid approach: combines semantic and keyword search
 */
export async function hybridSearch(
  query: string,
  k: number = 5,
  notes?: Note[]
): Promise<SearchResult[]> {
  const allNotes = notes ?? await db.notes.toArray();

  // Get semantic results if available
  let semanticResults: SearchResult[] = [];
  if (isEmbeddingsAvailable()) {
    try {
      semanticResults = await searchNotes(query, k * 2, allNotes);
    } catch (err) {
      console.warn('Semantic search failed:', err);
    }
  }

  // Get keyword results
  const keywordResults = keywordSearch(query, k * 2, allNotes);

  // Merge and deduplicate
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  // Interleave results, preferring semantic
  for (let i = 0; i < Math.max(semanticResults.length, keywordResults.length); i++) {
    if (i < semanticResults.length && !seen.has(semanticResults[i].note.id)) {
      seen.add(semanticResults[i].note.id);
      merged.push(semanticResults[i]);
    }
    if (i < keywordResults.length && !seen.has(keywordResults[i].note.id)) {
      seen.add(keywordResults[i].note.id);
      merged.push(keywordResults[i]);
    }
  }

  return merged.slice(0, k);
}

/**
 * Get notes that mention a specific topic or concept
 */
export async function getNotesAbout(topic: string): Promise<SearchResult[]> {
  // Use a higher k to find more comprehensive coverage
  return hybridSearch(topic, 10);
}

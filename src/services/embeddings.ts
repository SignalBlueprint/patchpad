/**
 * Embeddings Service
 *
 * Generates and caches vector embeddings for notes using OpenAI's embedding API.
 * Embeddings enable semantic search across notes.
 */

import { db } from '../db';
import type { Note } from '../types/note';

// Embedding cache in IndexedDB
interface EmbeddingRecord {
  id: string;
  noteId: string;
  embedding: number[];
  contentHash: string;
  createdAt: Date;
}

// Storage key for embeddings in IndexedDB
const EMBEDDINGS_STORE = 'embeddings';

// Dimensions for OpenAI text-embedding-3-small
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Get OpenAI API key from localStorage
 */
function getOpenAIKey(): string | null {
  return localStorage.getItem('openai_api_key');
}

/**
 * Check if embeddings are available
 */
export function isEmbeddingsAvailable(): boolean {
  return getOpenAIKey() !== null;
}

/**
 * Simple hash function for content change detection
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Generate embedding for text using OpenAI API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Truncate to avoid token limits (approx 8000 tokens = ~32000 chars)
  const truncatedText = text.slice(0, 30000);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: truncatedText,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate embedding');
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Get or generate embedding for a note
 * Uses cached embedding if content hasn't changed
 */
export async function getEmbeddingForNote(note: Note): Promise<number[]> {
  const contentHash = hashContent(note.content);

  // Check cache
  const cached = await db.table(EMBEDDINGS_STORE)
    .where('noteId')
    .equals(note.id)
    .first() as EmbeddingRecord | undefined;

  if (cached && cached.contentHash === contentHash) {
    return cached.embedding;
  }

  // Generate new embedding
  const embedding = await generateEmbedding(note.title + '\n\n' + note.content);

  // Cache it
  const record: EmbeddingRecord = {
    id: note.id,
    noteId: note.id,
    embedding,
    contentHash,
    createdAt: new Date(),
  };

  await db.table(EMBEDDINGS_STORE).put(record);

  return embedding;
}

/**
 * Generate embeddings for all notes (background processing)
 */
export async function generateAllEmbeddings(
  notes: Note[],
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  if (!isEmbeddingsAvailable()) {
    throw new Error('OpenAI API key not configured');
  }

  const total = notes.length;
  let completed = 0;

  for (const note of notes) {
    try {
      await getEmbeddingForNote(note);
      completed++;
      onProgress?.(completed, total);
    } catch (err) {
      console.error(`Failed to generate embedding for note ${note.id}:`, err);
      completed++;
      onProgress?.(completed, total);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get all cached embeddings
 */
export async function getAllEmbeddings(): Promise<Map<string, number[]>> {
  const records = await db.table(EMBEDDINGS_STORE).toArray() as EmbeddingRecord[];
  const map = new Map<string, number[]>();

  for (const record of records) {
    map.set(record.noteId, record.embedding);
  }

  return map;
}

/**
 * Delete embedding for a note
 */
export async function deleteEmbedding(noteId: string): Promise<void> {
  await db.table(EMBEDDINGS_STORE).where('noteId').equals(noteId).delete();
}

/**
 * Get embedding statistics
 */
export async function getEmbeddingStats(): Promise<{
  totalNotes: number;
  embeddedNotes: number;
  needsUpdate: number;
}> {
  const notes = await db.notes.toArray();
  const embeddings = await db.table(EMBEDDINGS_STORE).toArray() as EmbeddingRecord[];

  const embeddingMap = new Map<string, EmbeddingRecord>();
  for (const e of embeddings) {
    embeddingMap.set(e.noteId, e);
  }

  let needsUpdate = 0;
  for (const note of notes) {
    const cached = embeddingMap.get(note.id);
    if (!cached || cached.contentHash !== hashContent(note.content)) {
      needsUpdate++;
    }
  }

  return {
    totalNotes: notes.length,
    embeddedNotes: embeddings.length,
    needsUpdate,
  };
}

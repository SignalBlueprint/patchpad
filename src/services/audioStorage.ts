/**
 * Audio Storage Service
 * Stores and retrieves audio blobs for voice notes using IndexedDB
 */

import Dexie, { type EntityTable } from 'dexie';

export interface AudioRecord {
  id: string;
  noteId: string;
  blob: Blob;
  duration: number;
  mimeType: string;
  createdAt: Date;
}

// Separate database for audio blobs to avoid bloating the main DB
const audioDb = new Dexie('PatchPadAudioDB') as Dexie & {
  audios: EntityTable<AudioRecord, 'id'>;
};

audioDb.version(1).stores({
  audios: 'id, noteId, createdAt',
});

/**
 * Store an audio blob for a note
 */
export async function storeAudioForNote(
  noteId: string,
  audioBlob: Blob,
  duration: number
): Promise<string> {
  const audioId = `audio_${noteId}_${Date.now()}`;

  await audioDb.audios.add({
    id: audioId,
    noteId,
    blob: audioBlob,
    duration,
    mimeType: audioBlob.type,
    createdAt: new Date(),
  });

  return audioId;
}

/**
 * Get audio record by ID
 */
export async function getAudioById(audioId: string): Promise<AudioRecord | undefined> {
  return audioDb.audios.get(audioId);
}

/**
 * Get audio for a specific note
 */
export async function getAudioForNote(noteId: string): Promise<AudioRecord | undefined> {
  return audioDb.audios.where('noteId').equals(noteId).first();
}

/**
 * Delete audio for a note
 */
export async function deleteAudioForNote(noteId: string): Promise<void> {
  await audioDb.audios.where('noteId').equals(noteId).delete();
}

/**
 * Delete audio by ID
 */
export async function deleteAudioById(audioId: string): Promise<void> {
  await audioDb.audios.delete(audioId);
}

/**
 * Check if a note has stored audio
 */
export async function hasAudioForNote(noteId: string): Promise<boolean> {
  const count = await audioDb.audios.where('noteId').equals(noteId).count();
  return count > 0;
}

/**
 * Get total audio storage size (in bytes)
 */
export async function getAudioStorageSize(): Promise<number> {
  const audios = await audioDb.audios.toArray();
  return audios.reduce((total, audio) => total + audio.blob.size, 0);
}

/**
 * Clear all stored audio (for settings/cleanup)
 */
export async function clearAllAudio(): Promise<void> {
  await audioDb.audios.clear();
}

export { audioDb };

/**
 * Version History Service
 *
 * Stores snapshots of notes for version history and restoration.
 * Auto-snapshots occur on significant changes (100+ chars or 5+ minutes).
 */

import { v4 as uuidv4 } from 'uuid';
import type { NoteVersion, VersionDiff } from '../types/version';
import type { Note } from '../types/note';
import { getSupabase } from '../config/supabase';

const VERSIONS_STORAGE_KEY = 'patchpad_versions';
const LAST_SNAPSHOT_KEY = 'patchpad_last_snapshot';
const AUTO_SNAPSHOT_CHAR_THRESHOLD = 100;
const AUTO_SNAPSHOT_TIME_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const MAX_VERSIONS_PER_NOTE = 50;

// In-memory cache
let versionsCache: NoteVersion[] | null = null;
let lastSnapshotMap: Map<string, { time: number; charCount: number }> | null = null;

/**
 * Get all versions from storage
 */
export function getAllVersions(): NoteVersion[] {
  if (versionsCache) {
    return versionsCache;
  }

  try {
    const stored = localStorage.getItem(VERSIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      versionsCache = parsed.map((v: Record<string, unknown>) => ({
        ...v,
        createdAt: new Date(v.createdAt as string),
      }));
      return versionsCache!;
    }
  } catch (error) {
    console.error('Failed to load versions:', error);
  }

  versionsCache = [];
  return versionsCache;
}

/**
 * Save versions to storage
 */
function saveVersions(versions: NoteVersion[]): void {
  versionsCache = versions;
  try {
    localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(versions));
  } catch (error) {
    console.error('Failed to save versions:', error);
  }
}

/**
 * Get last snapshot info for tracking auto-snapshot timing
 */
function getLastSnapshotMap(): Map<string, { time: number; charCount: number }> {
  if (lastSnapshotMap) {
    return lastSnapshotMap;
  }

  try {
    const stored = localStorage.getItem(LAST_SNAPSHOT_KEY);
    if (stored) {
      lastSnapshotMap = new Map(Object.entries(JSON.parse(stored)));
      return lastSnapshotMap;
    }
  } catch (error) {
    console.error('Failed to load last snapshot map:', error);
  }

  lastSnapshotMap = new Map();
  return lastSnapshotMap;
}

/**
 * Save last snapshot info
 */
function saveLastSnapshotMap(): void {
  if (!lastSnapshotMap) return;

  try {
    const obj: Record<string, { time: number; charCount: number }> = {};
    lastSnapshotMap.forEach((value, key) => {
      obj[key] = value;
    });
    localStorage.setItem(LAST_SNAPSHOT_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('Failed to save last snapshot map:', error);
  }
}

/**
 * Get versions for a specific note
 */
export function getVersionsForNote(noteId: string): NoteVersion[] {
  return getAllVersions()
    .filter((v) => v.noteId === noteId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get the most recent version for a note
 */
export function getLatestVersion(noteId: string): NoteVersion | null {
  const versions = getVersionsForNote(noteId);
  return versions[0] || null;
}

/**
 * Create a version snapshot
 */
export function createVersion(
  note: Note,
  userId: string,
  snapshotType: 'auto' | 'manual' | 'restore' = 'auto',
  label?: string
): NoteVersion {
  const versions = getAllVersions();
  const noteVersions = versions.filter((v) => v.noteId === note.id);
  const previousVersion = noteVersions[0];

  const charDelta = previousVersion
    ? note.content.length - previousVersion.content.length
    : note.content.length;

  const version: NoteVersion = {
    id: uuidv4(),
    noteId: note.id,
    userId,
    content: note.content,
    title: note.title,
    charDelta,
    snapshotType,
    label,
    createdAt: new Date(),
  };

  // Add new version
  versions.unshift(version);

  // Trim old versions if over limit
  const noteVersionIds = new Set(
    versions
      .filter((v) => v.noteId === note.id)
      .slice(MAX_VERSIONS_PER_NOTE)
      .map((v) => v.id)
  );

  const trimmedVersions = versions.filter((v) => !noteVersionIds.has(v.id));
  saveVersions(trimmedVersions);

  // Update last snapshot tracking
  const snapshotMap = getLastSnapshotMap();
  snapshotMap.set(note.id, {
    time: Date.now(),
    charCount: note.content.length,
  });
  saveLastSnapshotMap();

  // Sync to cloud
  syncVersionToCloud(version);

  return version;
}

/**
 * Check if auto-snapshot should be created
 */
export function shouldAutoSnapshot(note: Note): boolean {
  const snapshotMap = getLastSnapshotMap();
  const lastSnapshot = snapshotMap.get(note.id);

  if (!lastSnapshot) {
    // First snapshot for this note
    return note.content.length >= AUTO_SNAPSHOT_CHAR_THRESHOLD;
  }

  const timeSinceLastSnapshot = Date.now() - lastSnapshot.time;
  const charsSinceLastSnapshot = Math.abs(note.content.length - lastSnapshot.charCount);

  // Snapshot if significant changes or enough time passed
  return (
    charsSinceLastSnapshot >= AUTO_SNAPSHOT_CHAR_THRESHOLD ||
    (timeSinceLastSnapshot >= AUTO_SNAPSHOT_TIME_THRESHOLD && charsSinceLastSnapshot > 0)
  );
}

/**
 * Maybe create auto-snapshot if conditions are met
 */
export function maybeAutoSnapshot(note: Note, userId: string): NoteVersion | null {
  if (shouldAutoSnapshot(note)) {
    return createVersion(note, userId, 'auto');
  }
  return null;
}

/**
 * Delete all versions for a note
 */
export function deleteVersionsForNote(noteId: string): void {
  const versions = getAllVersions();
  const filtered = versions.filter((v) => v.noteId !== noteId);
  saveVersions(filtered);

  const snapshotMap = getLastSnapshotMap();
  snapshotMap.delete(noteId);
  saveLastSnapshotMap();
}

/**
 * Compute diff between two versions
 */
export function computeDiff(
  oldContent: string,
  newContent: string
): VersionDiff {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Simple line-by-line diff
  let additions = 0;
  let deletions = 0;
  const diffLines: string[] = [];

  // Use longest common subsequence for basic diff
  const lcs = computeLCS(oldLines, newLines);
  let oldIndex = 0;
  let newIndex = 0;
  let lcsIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      lcsIndex < lcs.length &&
      oldIndex < oldLines.length &&
      oldLines[oldIndex] === lcs[lcsIndex]
    ) {
      if (newIndex < newLines.length && newLines[newIndex] === lcs[lcsIndex]) {
        diffLines.push('  ' + oldLines[oldIndex]);
        oldIndex++;
        newIndex++;
        lcsIndex++;
      } else if (newIndex < newLines.length) {
        diffLines.push('+ ' + newLines[newIndex]);
        additions++;
        newIndex++;
      }
    } else if (oldIndex < oldLines.length) {
      if (
        lcsIndex < lcs.length &&
        newIndex < newLines.length &&
        newLines[newIndex] === lcs[lcsIndex]
      ) {
        diffLines.push('- ' + oldLines[oldIndex]);
        deletions++;
        oldIndex++;
      } else {
        diffLines.push('- ' + oldLines[oldIndex]);
        deletions++;
        oldIndex++;
      }
    } else if (newIndex < newLines.length) {
      diffLines.push('+ ' + newLines[newIndex]);
      additions++;
      newIndex++;
    }
  }

  return {
    additions,
    deletions,
    charDelta: newContent.length - oldContent.length,
    diffText: diffLines.join('\n'),
  };
}

/**
 * Compute longest common subsequence of lines
 */
function computeLCS(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length;
  const n = arr2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      result.unshift(arr1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Sync version to Supabase
 */
async function syncVersionToCloud(version: NoteVersion): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) return;

    await supabase.from('note_versions').insert({
      id: version.id,
      note_id: version.noteId,
      user_id: version.userId,
      content: version.content,
      title: version.title,
      char_delta: version.charDelta,
      snapshot_type: version.snapshotType,
      label: version.label || null,
      created_at: version.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to sync version to cloud:', error);
  }
}

/**
 * Pull versions from cloud for a note
 */
export async function pullVersionsFromCloud(noteId: string): Promise<NoteVersion[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('note_versions')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at', { ascending: false })
      .limit(MAX_VERSIONS_PER_NOTE);

    if (error) throw error;
    if (!data) return [];

    const cloudVersions: NoteVersion[] = data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      noteId: row.note_id as string,
      userId: row.user_id as string,
      content: row.content as string,
      title: row.title as string,
      charDelta: row.char_delta as number,
      snapshotType: row.snapshot_type as 'auto' | 'manual' | 'restore',
      label: row.label as string | undefined,
      createdAt: new Date(row.created_at as string),
    }));

    // Merge with local versions
    const localVersions = getAllVersions();
    const localOtherVersions = localVersions.filter((v) => v.noteId !== noteId);
    const merged = [...localOtherVersions, ...cloudVersions];
    saveVersions(merged);

    return cloudVersions;
  } catch (error) {
    console.error('Failed to pull versions from cloud:', error);
    return [];
  }
}

/**
 * SQL to create the note_versions table in Supabase
 */
export const VERSIONS_SETUP_SQL = `
-- Note versions table for version history
CREATE TABLE IF NOT EXISTS note_versions (
  id UUID PRIMARY KEY,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  title TEXT NOT NULL,
  char_delta INTEGER NOT NULL DEFAULT 0,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('auto', 'manual', 'restore')),
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS note_versions_note_id_idx ON note_versions(note_id);
CREATE INDEX IF NOT EXISTS note_versions_created_at_idx ON note_versions(created_at);

-- RLS
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

-- Users can view versions of their own notes
CREATE POLICY "Users can view own note versions" ON note_versions
  FOR SELECT USING (
    note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
  );

-- Users can insert versions for their own notes
CREATE POLICY "Users can insert own note versions" ON note_versions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own versions
CREATE POLICY "Users can delete own note versions" ON note_versions
  FOR DELETE USING (auth.uid() = user_id);
`;

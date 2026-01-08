/**
 * Version History Types
 *
 * Types for note version snapshots and history tracking.
 */

export interface NoteVersion {
  id: string;
  noteId: string;
  userId: string;
  /** Full content at this version */
  content: string;
  /** Note title at this version */
  title: string;
  /** Character count change from previous version */
  charDelta: number;
  /** Reason for snapshot (auto, manual, restore) */
  snapshotType: 'auto' | 'manual' | 'restore';
  /** Optional label for manual snapshots */
  label?: string;
  createdAt: Date;
}

export interface VersionDiff {
  /** Lines added */
  additions: number;
  /** Lines removed */
  deletions: number;
  /** Character difference */
  charDelta: number;
  /** Unified diff output */
  diffText: string;
}

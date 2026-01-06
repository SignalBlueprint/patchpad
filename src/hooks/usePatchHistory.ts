import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import type { Patch, PatchOp } from '../types/patch';

export function usePatchHistory(noteId: string | null) {
  const patches = useLiveQuery(
    async () => {
      if (!noteId) return [];
      const results = await db.patches
        .where('noteId')
        .equals(noteId)
        .toArray();
      // Sort by createdAt descending (newest first)
      return results.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    [noteId],
    []
  );

  const addPatch = async (
    action: Patch['action'],
    rationale: string,
    ops: PatchOp[]
  ): Promise<string> => {
    if (!noteId) throw new Error('No note selected');

    const patch: Patch = {
      id: uuidv4(),
      noteId,
      action,
      rationale,
      ops,
      status: 'pending',
      createdAt: new Date(),
    };
    await db.patches.add(patch);
    return patch.id;
  };

  const updatePatchStatus = async (
    patchId: string,
    status: 'applied' | 'rejected'
  ): Promise<void> => {
    await db.patches.update(patchId, { status });
  };

  const getPatch = async (patchId: string): Promise<Patch | undefined> => {
    return db.patches.get(patchId);
  };

  return {
    patches: patches ?? [],
    addPatch,
    updatePatchStatus,
    getPatch,
  };
}

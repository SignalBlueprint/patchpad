import type { PatchOp } from '../types/patch';

/**
 * Apply patch operations to a string.
 * Operations are applied in reverse order (highest index first) to preserve indices.
 */
export function applyOps(content: string, ops: PatchOp[]): string {
  // Sort operations by start index descending to apply from end to start
  const sortedOps = [...ops].sort((a, b) => b.start - a.start);

  let result = content;

  for (const op of sortedOps) {
    switch (op.type) {
      case 'insert':
        result =
          result.slice(0, op.start) +
          (op.text ?? '') +
          result.slice(op.start);
        break;

      case 'delete':
        result =
          result.slice(0, op.start) +
          result.slice(op.end ?? op.start);
        break;

      case 'replace':
        result =
          result.slice(0, op.start) +
          (op.text ?? '') +
          result.slice(op.end ?? op.start);
        break;
    }
  }

  return result;
}

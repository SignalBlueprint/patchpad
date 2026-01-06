import type { Patch } from '../types/patch';

interface PatchCardProps {
  patch: Patch;
  onApply: (patch: Patch) => void;
  onReject: (patch: Patch) => void;
}

const actionLabels: Record<Patch['action'], string> = {
  summarize: 'Summarize',
  'extract-tasks': 'Extract Tasks',
  rewrite: 'Rewrite',
  'title-tags': 'Title + Tags',
};

const statusStyles: Record<Patch['status'], string> = {
  pending: 'bg-yellow-50 border-yellow-200',
  applied: 'bg-green-50 border-green-200',
  rejected: 'bg-gray-50 border-gray-200',
};

const statusBadges: Record<Patch['status'], { text: string; style: string }> = {
  pending: { text: 'Pending', style: 'bg-yellow-100 text-yellow-800' },
  applied: { text: 'Applied', style: 'bg-green-100 text-green-800' },
  rejected: { text: 'Rejected', style: 'bg-gray-100 text-gray-600' },
};

export function PatchCard({ patch, onApply, onReject }: PatchCardProps) {
  const isPending = patch.status === 'pending';

  return (
    <div
      className={`rounded-lg border p-3 ${statusStyles[patch.status]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600">
          {actionLabels[patch.action]}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${statusBadges[patch.status].style}`}
        >
          {statusBadges[patch.status].text}
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-2">{patch.rationale}</p>

      {patch.ops.length > 0 && (
        <div className="text-xs text-gray-500 mb-2">
          {patch.ops.length} operation{patch.ops.length !== 1 ? 's' : ''}
        </div>
      )}

      {isPending && patch.ops.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => onApply(patch)}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Apply
          </button>
          <button
            onClick={() => onReject(patch)}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Reject
          </button>
        </div>
      )}

      {isPending && patch.ops.length === 0 && (
        <div className="text-xs text-gray-500 italic">No changes to apply</div>
      )}
    </div>
  );
}

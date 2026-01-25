import type { Suggestion } from '../types/patch';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApply: () => void;
  onDismiss: () => void;
}

const actionLabels: Record<Suggestion['action'], string> = {
  summarize: 'Summarize',
  'extract-tasks': 'Extract Tasks',
  rewrite: 'Rewrite',
  'title-tags': 'Title + Tags',
};

const priorityStyles: Record<Suggestion['priority'], { bg: string; border: string; badge: string }> = {
  high: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
  medium: {
    bg: 'bg-neutral-50',
    border: 'border-neutral-200',
    badge: 'bg-neutral-100 text-neutral-600',
  },
  low: {
    bg: 'bg-neutral-50',
    border: 'border-gray-100',
    badge: 'bg-neutral-100 text-neutral-500',
  },
};

export function SuggestionCard({ suggestion, onApply, onDismiss }: SuggestionCardProps) {
  const styles = priorityStyles[suggestion.priority];

  return (
    <div className={`rounded-lg border p-3 ${styles.bg} ${styles.border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${styles.badge}`}>
          {actionLabels[suggestion.action]}
        </span>
        <button
          onClick={onDismiss}
          className="text-neutral-400 hover:text-neutral-600 focus:outline-none"
          title="Dismiss suggestion"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-sm text-neutral-700 mb-3">{suggestion.rationale}</p>

      <button
        onClick={onApply}
        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        Apply
      </button>
    </div>
  );
}

import type { FadingMemory } from '../../services/dashboardInsights';

interface FadingMemoriesSectionProps {
  fadingMemories: FadingMemory[];
  onNavigateToNote: (id: string) => void;
}

export function FadingMemoriesSection({
  fadingMemories,
  onNavigateToNote,
}: FadingMemoriesSectionProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-white/50 shadow-lg">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-amber-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Fading Memories
        {fadingMemories.length > 0 && (
          <span className="ml-auto text-xs font-normal text-gray-500">
            {fadingMemories.length} note{fadingMemories.length !== 1 ? 's' : ''}
          </span>
        )}
      </h3>

      {fadingMemories.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-sm">No fading memories found</p>
          <p className="text-xs text-gray-400 mt-1">
            Notes older than 90 days relevant to recent work will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fadingMemories.map((memory) => (
            <MemoryCard
              key={memory.note.id}
              memory={memory}
              onNavigate={() => onNavigateToNote(memory.note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MemoryCardProps {
  memory: FadingMemory;
  onNavigate: () => void;
}

function MemoryCard({ memory, onNavigate }: MemoryCardProps) {
  const { note, relevanceReason, daysSinceUpdate, matchingConcepts } = memory;

  // Format days as weeks/months if large
  const formatAge = (days: number): string => {
    if (days < 30) return `${days} days ago`;
    if (days < 60) return 'about a month ago';
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100/50">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Note title */}
          <button
            onClick={onNavigate}
            className="text-sm font-medium text-gray-800 hover:text-amber-600 transition-colors truncate block max-w-full text-left"
            title={note.title}
          >
            {note.title}
          </button>

          {/* Age indicator */}
          <p className="text-xs text-gray-400 mt-0.5">
            Last updated {formatAge(daysSinceUpdate)}
          </p>

          {/* Relevance reason */}
          <p className="text-xs text-amber-700 mt-1.5 line-clamp-2">
            {relevanceReason}
          </p>

          {/* Matching concepts */}
          {matchingConcepts.length > 1 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {matchingConcepts.slice(0, 3).map((concept) => (
                <span
                  key={concept}
                  className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded"
                >
                  {concept}
                </span>
              ))}
              {matchingConcepts.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{matchingConcepts.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Revisit button */}
        <button
          onClick={onNavigate}
          className="p-2 rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors flex-shrink-0"
          title="Revisit this note"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

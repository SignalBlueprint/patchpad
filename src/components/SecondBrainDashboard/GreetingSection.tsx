import type { Note } from '../../types/note';
import { getTimeBasedGreeting } from '../../services/dashboardInsights';

interface GreetingSectionProps {
  editingStreak: number;
  mostActiveNotes: Note[];
  onNavigateToNote: (id: string) => void;
}

export function GreetingSection({
  editingStreak,
  mostActiveNotes,
  onNavigateToNote,
}: GreetingSectionProps) {
  const greeting = getTimeBasedGreeting();

  return (
    <div className="text-center mb-8">
      {/* Greeting */}
      <h1 className="text-3xl font-bold text-white mb-2">{greeting}!</h1>

      {/* Streak indicator */}
      {editingStreak > 0 && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white/90 text-sm">
          <svg
            className="w-5 h-5 text-amber-300"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            You're on a <strong>{editingStreak}-day</strong> editing streak!
          </span>
        </div>
      )}

      {/* Most active notes */}
      {mostActiveNotes.length > 0 && (
        <div className="mt-6">
          <p className="text-white/70 text-sm mb-3">Most active this week:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {mostActiveNotes.slice(0, 3).map((note) => (
              <button
                key={note.id}
                onClick={() => onNavigateToNote(note.id)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-white/90 text-sm transition-colors truncate max-w-[200px]"
                title={note.title}
              >
                {note.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

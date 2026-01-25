import { useEffect, useState } from 'react';
import type { Note } from '../types/note';
import { findRelatedNotes, type RelatedNote } from '../services/ai';

interface RelatedNotesProps {
  currentNote: Note | null;
  allNotes: Note[];
  onSelectNote: (id: string) => void;
}

export function RelatedNotes({ currentNote, allNotes, onSelectNote }: RelatedNotesProps) {
  const [relatedNotes, setRelatedNotes] = useState<RelatedNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastNoteId, setLastNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentNote || currentNote.id === lastNoteId) return;
    if (currentNote.content.length < 20) {
      setRelatedNotes([]);
      return;
    }

    const otherNotes = allNotes.filter(n => n.id !== currentNote.id && !n.parentId);
    if (otherNotes.length === 0) {
      setRelatedNotes([]);
      return;
    }

    setLoading(true);
    setLastNoteId(currentNote.id);

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      try {
        const related = await findRelatedNotes(currentNote, otherNotes);
        setRelatedNotes(related);
      } catch (error) {
        console.error('Failed to find related notes:', error);
        setRelatedNotes([]);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [currentNote, allNotes, lastNoteId]);

  // Reset when note changes
  useEffect(() => {
    if (currentNote?.id !== lastNoteId) {
      setRelatedNotes([]);
    }
  }, [currentNote?.id, lastNoteId]);

  if (!currentNote) return null;

  const getNoteById = (id: string) => allNotes.find(n => n.id === id);

  return (
    <div className="p-3 border-t border-neutral-200">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Related Notes</h3>
        {loading && (
          <svg className="w-3 h-3 animate-spin text-neutral-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {relatedNotes.length === 0 && !loading ? (
        <p className="text-xs text-neutral-400 italic">
          {currentNote.content.length < 20 ? 'Add more content to find related notes' : 'No related notes found'}
        </p>
      ) : (
        <ul className="space-y-2">
          {relatedNotes.map((related) => {
            const note = getNoteById(related.noteId);
            if (!note) return null;

            return (
              <li key={related.noteId}>
                <button
                  onClick={() => onSelectNote(related.noteId)}
                  className="w-full text-left p-2 rounded-lg hover:bg-neutral-100 transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-800 truncate group-hover:text-primary-600">
                        {note.title}
                      </h4>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">
                        {related.reason}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        related.score > 0.7 ? 'bg-green-400' :
                        related.score > 0.4 ? 'bg-yellow-400' : 'bg-gray-300'
                      }`} title={`Relevance: ${Math.round(related.score * 100)}%`} />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Note } from '../types/note';
import { searchNotesByTitle, getWikiLinkTypingState, completeWikiLink } from '../utils/linkParser';

interface LinkAutocompleteProps {
  content: string;
  cursorPosition: number;
  allNotes: Note[];
  currentNoteId: string;
  onSelect: (newContent: string, newCursorPosition: number) => void;
  onClose: () => void;
  editorElement: HTMLElement | null;
  anchorRect?: DOMRect | null;
}

export function LinkAutocomplete({
  content,
  cursorPosition,
  allNotes,
  currentNoteId,
  onSelect,
  onClose,
  editorElement,
  anchorRect,
}: LinkAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [startPosition, setStartPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Check if we're in wiki link typing mode
  useEffect(() => {
    const typingState = getWikiLinkTypingState(content, cursorPosition);

    if (!typingState) {
      onClose();
      return;
    }

    setQuery(typingState.query);
    setStartPosition(typingState.startPosition);

    // Search notes (exclude current note)
    const otherNotes = allNotes.filter(n => n.id !== currentNoteId);
    const searchResults = searchNotesByTitle(typingState.query, otherNotes, 8);
    setResults(searchResults);
    setSelectedIndex(0);
  }, [content, cursorPosition, allNotes, currentNoteId, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (results.length > 0 && results[selectedIndex]) {
          selectNote(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results, selectedIndex, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Select a note
  const selectNote = (note: Note) => {
    const { content: newContent, cursorPosition: newCursorPos } = completeWikiLink(
      content,
      startPosition,
      cursorPosition,
      note.title
    );
    onSelect(newContent, newCursorPos);
  };

  // Create new note from query
  const createNewNote = () => {
    if (query.trim()) {
      const { content: newContent, cursorPosition: newCursorPos } = completeWikiLink(
        content,
        startPosition,
        cursorPosition,
        query.trim()
      );
      onSelect(newContent, newCursorPos);
    }
  };

  if (results.length === 0 && !query.trim()) {
    return null;
  }

  // Calculate position
  const style: React.CSSProperties = anchorRect && editorElement
    ? {
        position: 'absolute',
        top: anchorRect.bottom - editorElement.getBoundingClientRect().top + 4,
        left: anchorRect.left - editorElement.getBoundingClientRect().left,
        zIndex: 100,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
      };

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden min-w-[280px] max-w-[400px] animate-fade-in"
      style={style}
    >
      {/* Search input display */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">[[</span>
          <span className="text-gray-900 font-medium">{query || 'Type to search...'}</span>
        </div>
      </div>

      {/* Results list */}
      <ul ref={listRef} className="max-h-[240px] overflow-y-auto">
        {results.map((note, index) => (
          <li key={note.id}>
            <button
              onClick={() => selectNote(note)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 text-blue-900'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-gray-100 text-gray-500 text-xs">
                📄
              </span>
              <span className="flex-1 truncate text-sm">{note.title}</span>
              {note.folder && (
                <span className="text-xs text-gray-400 truncate max-w-[100px]">
                  {note.folder}
                </span>
              )}
            </button>
          </li>
        ))}

        {/* Create new note option */}
        {query.trim() && !results.some(n => n.title.toLowerCase() === query.toLowerCase()) && (
          <li>
            <button
              onClick={createNewNote}
              onMouseEnter={() => setSelectedIndex(results.length)}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors border-t border-gray-100 ${
                selectedIndex === results.length
                  ? 'bg-green-50 text-green-900'
                  : 'hover:bg-gray-50 text-gray-600'
              }`}
            >
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-green-100 text-green-600 text-xs">
                +
              </span>
              <span className="flex-1 text-sm">
                Create "<span className="font-medium">{query}</span>"
              </span>
            </button>
          </li>
        )}

        {/* Empty state */}
        {results.length === 0 && !query.trim() && (
          <li className="px-3 py-4 text-sm text-gray-500 text-center">
            Type to search notes...
          </li>
        )}
      </ul>

      {/* Footer hints */}
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 flex items-center gap-3 text-[10px] text-gray-400">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Esc Cancel</span>
      </div>
    </div>
  );
}

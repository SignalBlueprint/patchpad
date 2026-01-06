import { useState, useMemo } from 'react';
import type { Note } from '../types/note';
import { getBacklinks, type Backlink } from '../utils/linkParser';

interface BacklinksPanelProps {
  note: Note | null;
  allNotes: Note[];
  onNavigate: (noteId: string) => void;
}

export function BacklinksPanel({ note, allNotes, onNavigate }: BacklinksPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Compute backlinks
  const backlinks = useMemo(() => {
    if (!note) return [];
    return getBacklinks(note.id, note.title, allNotes);
  }, [note?.id, note?.title, allNotes]);

  if (!note || backlinks.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      {/* Header toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium">Backlinks</span>
        </div>
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          {backlinks.length}
        </span>
      </button>

      {/* Backlinks list */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-2 max-h-[200px] overflow-y-auto">
          {backlinks.map((backlink, index) => (
            <BacklinkItem
              key={`${backlink.sourceNoteId}-${index}`}
              backlink={backlink}
              onClick={() => onNavigate(backlink.sourceNoteId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface BacklinkItemProps {
  backlink: Backlink;
  onClick: () => void;
}

function BacklinkItem({ backlink, onClick }: BacklinkItemProps) {
  // Highlight the wiki link in context
  const highlightedContext = useMemo(() => {
    const context = backlink.context;
    // Find [[...]] pattern and highlight it
    const linkPattern = /\[\[([^\]]+)\]\]/g;
    const parts: { text: string; isLink: boolean }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkPattern.exec(context)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: context.slice(lastIndex, match.index), isLink: false });
      }
      parts.push({ text: match[0], isLink: true });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < context.length) {
      parts.push({ text: context.slice(lastIndex), isLink: false });
    }

    return parts.length > 0 ? parts : [{ text: context, isLink: false }];
  }, [backlink.context]);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all group"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-400 text-xs">📄</span>
        <span className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
          {backlink.sourceTitle}
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">
        {highlightedContext.map((part, i) => (
          <span
            key={i}
            className={part.isLink ? 'text-blue-600 font-medium' : ''}
          >
            {part.text}
          </span>
        ))}
      </p>
    </button>
  );
}

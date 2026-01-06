import { useState, useEffect, useRef } from 'react';
import type { Note } from '../types/note';

interface LinkPreviewCardProps {
  targetTitle: string;
  allNotes: Note[];
  anchorElement: HTMLElement | null;
  onNavigate: (title: string) => void;
  onClose: () => void;
}

export function LinkPreviewCard({
  targetTitle,
  allNotes,
  anchorElement,
  onNavigate,
  onClose,
}: LinkPreviewCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Find the linked note
  const linkedNote = allNotes.find(
    n => n.title.toLowerCase().trim() === targetTitle.toLowerCase().trim()
  );

  // Calculate position
  useEffect(() => {
    if (!anchorElement) return;

    const rect = anchorElement.getBoundingClientRect();
    const cardWidth = 320;
    const cardHeight = 200;

    // Position below the link, centered
    let left = rect.left + rect.width / 2 - cardWidth / 2;
    let top = rect.bottom + 8;

    // Keep within viewport
    if (left < 16) left = 16;
    if (left + cardWidth > window.innerWidth - 16) {
      left = window.innerWidth - cardWidth - 16;
    }

    // If would go below viewport, show above
    if (top + cardHeight > window.innerHeight - 16) {
      top = rect.top - cardHeight - 8;
    }

    setPosition({ top, left });

    // Animate in
    requestAnimationFrame(() => setIsVisible(true));
  }, [anchorElement]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!position) return null;

  // Get preview content (first ~200 chars, cleaned up)
  const getPreviewContent = (content: string) => {
    // Remove markdown syntax for cleaner preview
    let preview = content
      .replace(/^#+\s+/gm, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1') // Clean wiki links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Clean markdown links
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/^\s*[-*]\s+/gm, '• ') // Convert list markers
      .trim();

    if (preview.length > 200) {
      preview = preview.slice(0, 200).trim() + '...';
    }

    return preview || 'Empty note';
  };

  return (
    <div
      ref={cardRef}
      className={`fixed z-[100] w-80 transition-all duration-200 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ top: position.top, left: position.left }}
    >
      {/* Glass card */}
      <div className="glass-card rounded-xl shadow-2xl overflow-hidden border border-white/20">
        {linkedNote ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                  {linkedNote.title.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {linkedNote.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {new Date(linkedNote.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {linkedNote.tags && linkedNote.tags.length > 0 && (
                      <span className="ml-2">
                        {linkedNote.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-[10px] ml-1">
                            #{tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Content preview */}
            <div className="px-4 py-3 max-h-32 overflow-hidden">
              <p className="text-sm text-gray-600 leading-relaxed">
                {getPreviewContent(linkedNote.content)}
              </p>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/10 bg-gray-50/50 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {linkedNote.content.split(/\s+/).filter(w => w).length} words
              </span>
              <button
                onClick={() => onNavigate(targetTitle)}
                className="px-3 py-1 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-full hover:shadow-lg hover:scale-105 transition-all"
              >
                Open Note
              </button>
            </div>
          </>
        ) : (
          /* New note prompt */
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Create "{targetTitle}"</h3>
            <p className="text-sm text-gray-500 mb-4">
              This note doesn't exist yet
            </p>
            <button
              onClick={() => onNavigate(targetTitle)}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-full hover:shadow-lg hover:scale-105 transition-all"
            >
              Create Note
            </button>
          </div>
        )}
      </div>

      {/* Glow effect */}
      <div className="absolute inset-0 -z-10 blur-xl opacity-30 bg-gradient-to-r from-blue-400 to-purple-500 rounded-xl" />
    </div>
  );
}

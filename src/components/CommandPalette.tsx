import { useState, useEffect, useRef, useMemo } from 'react';

export interface Command {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  category: 'note' | 'ai' | 'edit' | 'view' | 'navigate' | 'session';
  icon?: React.ReactNode;
  action: () => void;
  disabled?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

const categoryLabels: Record<Command['category'], string> = {
  note: 'Notes',
  ai: 'AI Actions',
  edit: 'Edit',
  view: 'View',
  navigate: 'Navigate',
  session: 'Sessions',
};

const categoryOrder: Command['category'][] = ['note', 'ai', 'edit', 'view', 'navigate', 'session'];

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands.filter(c => !c.disabled);

    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => {
      if (cmd.disabled) return false;
      return (
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery) ||
        cmd.category.toLowerCase().includes(lowerQuery)
      );
    });
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<Command['category'], Command[]> = {
      note: [],
      ai: [],
      edit: [],
      view: [],
      navigate: [],
      session: [],
    };

    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Flat list for keyboard navigation
  const flatCommands = useMemo(() => {
    return categoryOrder.flatMap(cat => groupedCommands[cat]);
  }, [groupedCommands]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            flatCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector('[data-selected="true"]');
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  let currentFlatIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 glass-overlay"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl glass-card rounded-xl shadow-lg overflow-hidden animate-spring-in border border-neutral-200/50">

        {/* Search input */}
        <div className="flex items-center px-4 border-b border-neutral-200/50">
          <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 px-4 py-4 text-sm bg-transparent outline-none placeholder:text-neutral-400"
          />
          <kbd className="px-2.5 py-1 text-xs font-medium text-neutral-500 bg-neutral-100/80 rounded-lg border border-neutral-200/50">
            esc
          </kbd>
        </div>

        {/* Commands list */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
          {flatCommands.length === 0 ? (
            <div className="py-8 text-center text-neutral-500">
              <p className="text-sm">No commands found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            categoryOrder.map(category => {
              const cmds = groupedCommands[category];
              if (cmds.length === 0) return null;

              return (
                <div key={category} className="mb-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {categoryLabels[category]}
                  </div>
                  {cmds.map(cmd => {
                    currentFlatIndex++;
                    const isSelected = currentFlatIndex === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        data-selected={isSelected}
                        onClick={() => {
                          cmd.action();
                          onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-primary-50 text-primary-900 border border-primary-100'
                            : 'hover:bg-neutral-50 text-neutral-700 border border-transparent'
                        }`}
                      >
                        {cmd.icon && (
                          <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-primary-600 text-white'
                              : 'bg-neutral-100 text-neutral-500'
                          }`}>
                            {cmd.icon}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{cmd.name}</div>
                          {cmd.description && (
                            <div className={`text-xs truncate ${isSelected ? 'text-secondary-600' : 'text-neutral-500'}`}>
                              {cmd.description}
                            </div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-lg transition-colors ${
                            isSelected ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-500'
                          }`}>
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-neutral-200/50 bg-neutral-50/50 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/80 border border-neutral-200/50 rounded-md text-[10px] shadow-sm">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/80 border border-neutral-200/50 rounded-md text-[10px] shadow-sm">↓</kbd>
              <span className="ml-1">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/80 border border-neutral-200/50 rounded-md text-[10px] shadow-sm">↵</kbd>
              <span className="ml-1">Select</span>
            </span>
          </div>
          <span className="font-semibold gradient-text">PatchPad</span>
        </div>
      </div>
    </div>
  );
}

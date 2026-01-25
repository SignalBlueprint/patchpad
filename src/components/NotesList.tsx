import { forwardRef, useState } from 'react';
import type { Note, Folder } from '../types/note';
import type { SortOption, NotesFilter } from '../hooks/useNotes';

interface NotesListProps {
  notes: Note[];
  folders: Folder[];
  allTags: string[];
  selectedId: string | null;
  selectedIds: Set<string>;
  multiSelectMode: boolean;
  searchQuery: string;
  filter: NotesFilter;
  sortBy: SortOption;
  onSearchChange: (query: string) => void;
  onFilterChange: (filter: NotesFilter) => void;
  onSortChange: (sort: SortOption) => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onToggleMultiSelect: () => void;
  onStitch: () => void;
  onToggleFavorite: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  stitchLoading: boolean;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function getContentPreview(content: string): string {
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const preview = lines[0]?.slice(0, 80) || '';
  return preview.length >= 80 ? preview + '...' : preview;
}

export const NotesList = forwardRef<HTMLInputElement, NotesListProps>(
  function NotesList(
    {
      notes,
      folders,
      allTags,
      selectedId,
      selectedIds,
      multiSelectMode,
      searchQuery,
      filter,
      sortBy,
      onSearchChange,
      onFilterChange,
      onSortChange,
      onSelect,
      onToggleSelect,
      onDelete,
      onNew,
      onToggleMultiSelect,
      onStitch,
      onToggleFavorite,
      onToggleCollapsed,
      stitchLoading,
    },
    searchRef
  ) {
    const [showFilters, setShowFilters] = useState(false);

    const filterLabel = () => {
      switch (filter.type) {
        case 'favorites': return 'Favorites';
        case 'folder': {
          const folder = folders.find(f => f.id === filter.value);
          return folder ? folder.name : 'All Notes';
        }
        case 'tag': return `#${filter.value}`;
        default: return 'All Notes';
      }
    };

    return (
      <div className="flex flex-col h-full bg-neutral-50 border-r border-neutral-200">
        {/* Header */}
        <div className="p-3 border-b border-neutral-200">
          {/* Search */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            />
          </div>

          {/* Filter and Sort Row */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                filter.type !== 'all'
                  ? 'bg-primary-50 border-primary-200 text-primary-700'
                  : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <span className="truncate">{filterLabel()}</span>
              <svg className={`w-3.5 h-3.5 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="px-2 py-1.5 text-xs font-medium bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="updated">Recent</option>
              <option value="created">Created</option>
              <option value="title">Title</option>
              <option value="favorite">Favorites</option>
            </select>
          </div>

          {/* Filter Dropdown */}
          {showFilters && (
            <div className="mb-3 p-2 bg-white rounded-lg border border-neutral-200 shadow-sm animate-fade-in">
              <div className="space-y-1">
                <button
                  onClick={() => { onFilterChange({ type: 'all' }); setShowFilters(false); }}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
                    filter.type === 'all' ? 'bg-primary-100 text-primary-700' : 'hover:bg-neutral-100'
                  }`}
                >
                  All Notes
                </button>
                <button
                  onClick={() => { onFilterChange({ type: 'favorites' }); setShowFilters(false); }}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors flex items-center gap-2 ${
                    filter.type === 'favorites' ? 'bg-primary-100 text-primary-700' : 'hover:bg-neutral-100'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-accent-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Favorites
                </button>

                {folders.length > 0 && (
                  <>
                    <div className="h-px bg-gray-200 my-1" />
                    <div className="text-[10px] font-medium text-neutral-500 uppercase px-2 py-1">Folders</div>
                    {folders.map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => { onFilterChange({ type: 'folder', value: folder.id }); setShowFilters(false); }}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors flex items-center gap-2 ${
                          filter.type === 'folder' && filter.value === folder.id ? 'bg-primary-100 text-primary-700' : 'hover:bg-neutral-100'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        {folder.name}
                      </button>
                    ))}
                  </>
                )}

                {allTags.length > 0 && (
                  <>
                    <div className="h-px bg-gray-200 my-1" />
                    <div className="text-[10px] font-medium text-neutral-500 uppercase px-2 py-1">Tags</div>
                    <div className="flex flex-wrap gap-1 px-1">
                      {allTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => { onFilterChange({ type: 'tag', value: tag }); setShowFilters(false); }}
                          className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                            filter.type === 'tag' && filter.value === tag
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onNew}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New
            </button>
            <button
              onClick={onToggleMultiSelect}
              className={`px-3 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 transition-colors ${
                multiSelectMode
                  ? 'bg-secondary-600 text-white'
                  : 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50'
              }`}
              title="Toggle multi-select mode"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
          </div>

          {/* Multi-select Actions */}
          {multiSelectMode && (
            <div className="mt-3 p-2 bg-secondary-50 rounded-lg animate-slide-in-from-bottom">
              <div className="text-xs text-secondary-700 mb-2 font-medium">
                {selectedIds.size} note{selectedIds.size !== 1 ? 's' : ''} selected
              </div>
              <button
                onClick={onStitch}
                disabled={selectedIds.size < 2 || stitchLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-secondary-600 rounded-lg hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-secondary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {stitchLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Stitching...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                    </svg>
                    Stitch Selected
                  </>
                )}
              </button>
              {selectedIds.size < 2 && (
                <p className="text-xs text-secondary-600 mt-1.5 text-center">
                  Select at least 2 notes to stitch
                </p>
              )}
            </div>
          )}
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neutral-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-neutral-600">
                {searchQuery ? 'No notes found' : 'No notes yet'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {searchQuery ? 'Try a different search' : 'Create your first note'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {(() => {
                // Separate root notes from child notes
                const rootNotes = notes.filter(n => !n.parentId);
                const childrenByParent = new Map<string, Note[]>();
                notes.forEach(n => {
                  if (n.parentId) {
                    const children = childrenByParent.get(n.parentId) || [];
                    children.push(n);
                    childrenByParent.set(n.parentId, children);
                  }
                });

                const renderNote = (note: Note, isChild: boolean = false) => {
                  const isSelected = selectedId === note.id;
                  const isMultiSelected = selectedIds.has(note.id);
                  const children = childrenByParent.get(note.id) || [];
                  const hasChildren = children.length > 0;

                  return (
                    <li
                      key={note.id}
                      className={`group cursor-pointer transition-colors ${
                        isMultiSelected
                          ? 'bg-secondary-50'
                          : isSelected
                          ? 'bg-blue-50'
                          : 'hover:bg-neutral-50'
                      }`}
                    >
                      <div
                        className={`px-3 py-3 ${isChild ? 'pl-8' : ''}`}
                        onClick={() => {
                          if (multiSelectMode) {
                            onToggleSelect(note.id);
                          } else {
                            onSelect(note.id);
                          }
                        }}
                      >
                        <div className="flex items-start gap-2">
                          {/* Expand/collapse toggle for parent notes */}
                          {hasChildren && !multiSelectMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleCollapsed(note.id);
                              }}
                              className="mt-0.5 p-0.5 text-neutral-400 hover:text-neutral-600 transition-colors flex-shrink-0"
                              title={note.collapsed ? 'Expand' : 'Collapse'}
                            >
                              <svg
                                className={`w-3.5 h-3.5 transition-transform ${note.collapsed ? '' : 'rotate-90'}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}

                          {/* Child note indicator */}
                          {isChild && (
                            <svg className="w-3 h-3 mt-1 text-neutral-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}

                          {/* Multi-select checkbox */}
                          {multiSelectMode && (
                            <div
                              className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                isMultiSelected
                                  ? 'bg-secondary-600 border-secondary-600'
                                  : 'border-gray-400'
                              }`}
                            >
                              {isMultiSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {/* Parent indicator icon */}
                              {hasChildren && (
                                <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                              )}
                              <h3 className={`text-sm font-medium text-neutral-900 truncate flex-1 ${isChild ? 'text-neutral-600' : ''}`}>
                                {note.title}
                              </h3>
                              {note.favorite && (
                                <svg className="w-3.5 h-3.5 text-accent-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                              )}
                              {note.tags?.includes('voice-note') && (
                                <svg className="w-3.5 h-3.5 text-secondary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Voice note">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                              )}
                              {hasChildren && (
                                <span className="text-[10px] text-neutral-400 flex-shrink-0">
                                  {children.length}
                                </span>
                              )}
                            </div>

                            {/* Content preview - hide for child notes to save space */}
                            {note.content && !isChild && (
                              <p className="text-xs text-neutral-500 truncate mt-0.5">
                                {getContentPreview(note.content)}
                              </p>
                            )}

                            {/* Meta row */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-neutral-400">
                                {formatRelativeTime(note.updatedAt)}
                              </span>
                              {note.tags && note.tags.length > 0 && !isChild && (
                                <div className="flex gap-1">
                                  {note.tags.slice(0, 2).map(tag => (
                                    <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded">
                                      #{tag}
                                    </span>
                                  ))}
                                  {note.tags.length > 2 && (
                                    <span className="text-[10px] text-neutral-400">
                                      +{note.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          {!multiSelectMode && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFavorite(note.id);
                                }}
                                className="p-1 text-neutral-400 hover:text-accent-500 transition-colors"
                                title={note.favorite ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                <svg className="w-4 h-4" fill={note.favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this note?')) {
                                    onDelete(note.id);
                                  }
                                }}
                                className="p-1 text-neutral-400 hover:text-error-600 transition-colors"
                                title="Delete note"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Render children if not collapsed */}
                      {hasChildren && !note.collapsed && !multiSelectMode && (
                        <ul className="border-t border-neutral-100 bg-gray-25">
                          {children.map(child => renderNote(child, true))}
                        </ul>
                      )}
                    </li>
                  );
                };

                return rootNotes.map(note => renderNote(note, false));
              })()}
            </ul>
          )}
        </div>

        {/* Footer stats */}
        <div className="px-3 py-2 border-t border-neutral-200 bg-neutral-50">
          <p className="text-[10px] text-neutral-400 text-center">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
            {filter.type !== 'all' && ' (filtered)'}
          </p>
        </div>
      </div>
    );
  }
);

import { useState, useCallback } from 'react';

export interface CanvasGroupData {
  id: string;
  name: string;
  noteIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  collapsed: boolean;
}

interface CanvasGroupProps {
  group: CanvasGroupData;
  isSelected: boolean;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}

export function CanvasGroup({
  group,
  isSelected,
  onSelect,
  onToggleCollapse,
  onDelete,
  onRename,
}: CanvasGroupProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditName(group.name);
  }, [group.name]);

  const handleNameSubmit = useCallback(() => {
    if (editName.trim()) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  }, [editName, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(group.name);
    }
  }, [handleNameSubmit, group.name]);

  return (
    <div
      className={`absolute rounded-lg border-2 border-dashed transition-all ${
        isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-gray-300 bg-gray-50/20'
      } ${group.collapsed ? 'opacity-75' : ''}`}
      style={{
        left: group.x,
        top: group.y,
        width: group.collapsed ? 200 : group.width,
        height: group.collapsed ? 40 : group.height,
        backgroundColor: group.collapsed ? group.color : `${group.color}20`,
        borderColor: group.collapsed ? group.color : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Group header */}
      <div
        className={`flex items-center justify-between px-2 py-1 rounded-t-md ${
          group.collapsed ? '' : 'bg-white/80'
        }`}
        style={{ backgroundColor: group.collapsed ? 'transparent' : `${group.color}40` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Collapse toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="p-0.5 hover:bg-black/10 rounded"
            title={group.collapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className={`w-3 h-3 text-gray-600 transition-transform ${group.collapsed ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Group name */}
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1 px-1 py-0.5 text-xs font-medium bg-white border border-gray-300 rounded outline-none focus:border-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-xs font-medium text-gray-700 truncate cursor-pointer"
              onDoubleClick={handleDoubleClick}
              title="Double-click to rename"
            >
              {group.name}
            </span>
          )}

          {/* Note count badge */}
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white/80 text-gray-500 rounded">
            {group.noteIds.length}
          </span>
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-0.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-500"
          title="Delete group"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Collapsed indicator */}
      {group.collapsed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] text-gray-500">
            {group.noteIds.length} notes
          </span>
        </div>
      )}
    </div>
  );
}

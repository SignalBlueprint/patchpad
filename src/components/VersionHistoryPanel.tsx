/**
 * Version History Panel
 *
 * Displays note version history with ability to preview and restore versions.
 */

import { useState, useMemo } from 'react';
import type { NoteVersion, VersionDiff } from '../types/version';
import { computeDiff } from '../services/versionHistory';

interface VersionHistoryPanelProps {
  versions: NoteVersion[];
  currentContent: string;
  onRestore: (version: NoteVersion) => void;
  onCreateSnapshot: (label?: string) => void;
  onClose: () => void;
}

export function VersionHistoryPanel({
  versions,
  currentContent,
  onRestore,
  onCreateSnapshot,
  onClose,
}: VersionHistoryPanelProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(true);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [showCreateSnapshot, setShowCreateSnapshot] = useState(false);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  const diff: VersionDiff | null = useMemo(() => {
    if (!selectedVersion) return null;
    return computeDiff(selectedVersion.content, currentContent);
  }, [selectedVersion, currentContent]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday =
      new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today at ${time}`;
    if (isYesterday) return `Yesterday at ${time}`;
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }) + ` at ${time}`;
  };

  const handleCreateSnapshot = () => {
    onCreateSnapshot(snapshotLabel || undefined);
    setSnapshotLabel('');
    setShowCreateSnapshot(false);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Version History</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Create snapshot section */}
      <div className="px-4 py-3 border-b border-gray-100">
        {showCreateSnapshot ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              placeholder="Version label (optional)"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              autoFocus
            />
            <button
              onClick={handleCreateSnapshot}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={() => setShowCreateSnapshot(false)}
              className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreateSnapshot(true)}
            className="w-full px-3 py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create manual snapshot
          </button>
        )}
      </div>

      {/* Version list and preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Version list */}
        <div className="w-64 border-r border-gray-100 overflow-y-auto">
          {versions.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              <p>No versions yet</p>
              <p className="mt-1 text-xs">Versions are created automatically as you edit</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {versions.map((version, index) => (
                <button
                  key={version.id}
                  onClick={() => setSelectedVersionId(version.id)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedVersionId === version.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {version.label || `Version ${versions.length - index}`}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        version.snapshotType === 'manual'
                          ? 'bg-blue-100 text-blue-700'
                          : version.snapshotType === 'restore'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {version.snapshotType}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(version.createdAt)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs ${
                        version.charDelta > 0
                          ? 'text-green-600'
                          : version.charDelta < 0
                          ? 'text-red-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {version.charDelta > 0 ? '+' : ''}
                      {version.charDelta} chars
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedVersion ? (
            <>
              {/* Preview header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowDiff(false)}
                    className={`text-sm ${
                      !showDiff ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Content
                  </button>
                  <button
                    onClick={() => setShowDiff(true)}
                    className={`text-sm ${
                      showDiff ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Diff from current
                  </button>
                </div>
                <button
                  onClick={() => onRestore(selectedVersion)}
                  className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Restore
                </button>
              </div>

              {/* Preview content */}
              <div className="flex-1 overflow-auto p-4">
                {showDiff && diff ? (
                  <div className="space-y-2">
                    <div className="flex gap-4 text-sm mb-4">
                      <span className="text-green-600">+{diff.additions} lines</span>
                      <span className="text-red-600">-{diff.deletions} lines</span>
                      <span className="text-gray-500">
                        {diff.charDelta > 0 ? '+' : ''}{diff.charDelta} chars
                      </span>
                    </div>
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {diff.diffText.split('\n').map((line, i) => (
                        <div
                          key={i}
                          className={`px-2 ${
                            line.startsWith('+ ')
                              ? 'bg-green-50 text-green-800'
                              : line.startsWith('- ')
                              ? 'bg-red-50 text-red-800'
                              : 'text-gray-600'
                          }`}
                        >
                          {line}
                        </div>
                      ))}
                    </pre>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      {selectedVersion.title || 'Untitled'}
                    </h4>
                    <pre className="text-sm whitespace-pre-wrap text-gray-700 font-sans">
                      {selectedVersion.content}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg
                  className="w-12 h-12 mx-auto mb-2 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm">Select a version to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

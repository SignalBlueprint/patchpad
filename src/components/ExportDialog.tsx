import { useState, useEffect, useMemo } from 'react';
import type { Note } from '../types/note';
import { exportAndDownload } from '../services/export';

interface ExportDialogProps {
  isOpen: boolean;
  notes: Note[];
  selectedIds: string[];
  onClose: () => void;
}

export function ExportDialog({
  isOpen,
  notes,
  selectedIds,
  onClose,
}: ExportDialogProps) {
  // Selection state
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(selectedIds));

  // Options
  const [includeManifest, setIncludeManifest] = useState(true);
  const [rewriteLinks, setRewriteLinks] = useState(true);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCheckedIds(new Set(selectedIds.length > 0 ? selectedIds : notes.map(n => n.id)));
      setError(null);
    }
  }, [isOpen, selectedIds, notes]);

  // Get selected notes
  const selectedNotes = useMemo(() => {
    return notes.filter(n => checkedIds.has(n.id));
  }, [notes, checkedIds]);

  // Toggle a note's selection
  const toggleNote = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all
  const selectAll = () => {
    setCheckedIds(new Set(notes.map(n => n.id)));
  };

  // Clear all
  const clearAll = () => {
    setCheckedIds(new Set());
  };

  // Handle export
  const handleExport = async () => {
    if (selectedNotes.length === 0) {
      setError('Please select at least one note to export');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      await exportAndDownload({
        notes: selectedNotes,
        includeManifest,
        rewriteLinks,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Export Notes</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Notes selection */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              Select Notes ({selectedNotes.length} selected)
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={clearAll}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
            {notes.map(note => (
              <label
                key={note.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(note.id)}
                  onChange={() => toggleNote(note.id)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 truncate flex-1">
                  {note.title || 'Untitled'}
                </span>
                {note.tags && note.tags.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {note.tags.length} tag{note.tags.length !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <span className="text-sm font-medium text-gray-700 block mb-3">Options</span>

          <label className="flex items-center gap-3 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeManifest}
              onChange={(e) => setIncludeManifest(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm text-gray-700">Include manifest.json</span>
              <p className="text-xs text-gray-500">Adds metadata file with note information</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rewriteLinks}
              onChange={(e) => setRewriteLinks(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm text-gray-700">Convert wiki links</span>
              <p className="text-xs text-gray-500">Transform [[links]] to relative markdown links</p>
            </div>
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedNotes.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export {selectedNotes.length} Note{selectedNotes.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

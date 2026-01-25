/**
 * Document Export Dialog
 *
 * UI for compiling notes into documents and exporting to various formats.
 */

import { useState, useMemo } from 'react';
import type { Note } from '../types/note';
import {
  compileNotesIntoDocument,
  exportToMarkdown,
  downloadMarkdown,
  downloadHTML,
  exportToPDF,
  type DocumentExportOptions,
  type CompiledDocument,
} from '../services/documentExport';

interface DocumentExportDialogProps {
  notes: Note[];
  selectedNoteIds: string[];
  onClose: () => void;
}

type ExportFormat = 'markdown' | 'html' | 'pdf';
type OrganizationMethod = 'chronological' | 'alphabetical' | 'manual';

export function DocumentExportDialog({
  notes,
  selectedNoteIds,
  onClose,
}: DocumentExportDialogProps) {
  const [title, setTitle] = useState('Compiled Document');
  const [author, setAuthor] = useState('');
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [organization, setOrganization] = useState<OrganizationMethod>('chronological');
  const [includeTableOfContents, setIncludeTableOfContents] = useState(true);
  const [includeFrontmatter, setIncludeFrontmatter] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(selectedNoteIds.length > 0 ? selectedNoteIds : notes.slice(0, 5).map((n) => n.id))
  );
  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const selectedNotes = useMemo(
    () => notes.filter((n) => selectedIds.has(n.id)),
    [notes, selectedIds]
  );

  const compiledDoc: CompiledDocument | null = useMemo(() => {
    if (selectedNotes.length === 0) return null;
    return compileNotesIntoDocument(selectedNotes, title, { author, organizationMethod: organization });
  }, [selectedNotes, title, author, organization]);

  const preview = useMemo(() => {
    if (!compiledDoc) return '';
    return exportToMarkdown(compiledDoc, {
      title,
      author,
      includeTableOfContents,
      includeFrontmatter,
      includeFooter,
    });
  }, [compiledDoc, title, author, includeTableOfContents, includeFrontmatter, includeFooter]);

  const handleToggleNote = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === notes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notes.map((n) => n.id)));
    }
  };

  const handleExport = async () => {
    if (!compiledDoc) return;

    setIsExporting(true);
    const options: DocumentExportOptions = {
      title,
      author: author || undefined,
      includeTableOfContents,
      includeFrontmatter,
      includeFooter,
      theme,
    };

    try {
      switch (format) {
        case 'markdown':
          downloadMarkdown(compiledDoc, options);
          break;
        case 'html':
          downloadHTML(compiledDoc, options);
          break;
        case 'pdf':
          await exportToPDF(compiledDoc, options);
          break;
      }
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Export Document
            </h2>
            <p className="text-sm text-neutral-500">
              Compile notes into a formatted document
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left panel - Note selection */}
          <div className="w-64 border-r border-gray-100 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-neutral-700">
                  Select Notes ({selectedIds.size})
                </h3>
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-primary-600 hover:text-blue-700"
                >
                  {selectedIds.size === notes.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="space-y-1">
                {notes.map((note) => (
                  <label
                    key={note.id}
                    className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                      selectedIds.has(note.id)
                        ? 'bg-blue-50'
                        : 'hover:bg-neutral-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(note.id)}
                      onChange={() => handleToggleNote(note.id)}
                      className="mt-1 rounded border-neutral-300 text-primary-500 focus:ring-blue-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {note.title}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {note.content.slice(0, 50)}...
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel - Options and preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Options */}
            <div className="p-4 border-b border-gray-100 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* Author */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Author (optional)
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Format */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Export Format
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="markdown">Markdown (.md)</option>
                    <option value="html">HTML (.html)</option>
                    <option value="pdf">PDF (Print)</option>
                  </select>
                </div>

                {/* Organization */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Section Order
                  </label>
                  <select
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value as OrganizationMethod)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="chronological">Chronological</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>
                </div>

                {/* Theme (for HTML/PDF) */}
                {format !== 'markdown' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Theme
                    </label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Options checkboxes */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTableOfContents}
                    onChange={(e) => setIncludeTableOfContents(e.target.checked)}
                    className="rounded border-neutral-300 text-primary-500 focus:ring-blue-200"
                  />
                  <span className="text-sm text-neutral-700">Table of Contents</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFrontmatter}
                    onChange={(e) => setIncludeFrontmatter(e.target.checked)}
                    className="rounded border-neutral-300 text-primary-500 focus:ring-blue-200"
                  />
                  <span className="text-sm text-neutral-700">Frontmatter/Metadata</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFooter}
                    onChange={(e) => setIncludeFooter(e.target.checked)}
                    className="rounded border-neutral-300 text-primary-500 focus:ring-blue-200"
                  />
                  <span className="text-sm text-neutral-700">Footer</span>
                </label>
              </div>
            </div>

            {/* Preview toggle */}
            <div className="px-4 py-2 bg-neutral-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowPreview(false)}
                  className={`text-sm font-medium ${
                    !showPreview ? 'text-primary-600' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className={`text-sm font-medium ${
                    showPreview ? 'text-primary-600' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Preview
                </button>
              </div>
              {compiledDoc && (
                <span className="text-xs text-neutral-500">
                  {compiledDoc.metadata.noteCount} notes • {compiledDoc.metadata.wordCount.toLocaleString()} words
                </span>
              )}
            </div>

            {/* Preview area */}
            <div className="flex-1 overflow-auto p-4">
              {selectedIds.size === 0 ? (
                <div className="flex items-center justify-center h-full text-neutral-400">
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-sm">Select notes to include in your document</p>
                  </div>
                </div>
              ) : showPreview ? (
                <pre className="text-sm font-mono whitespace-pre-wrap text-neutral-700 bg-neutral-50 p-4 rounded-lg">
                  {preview.slice(0, 3000)}
                  {preview.length > 3000 && '\n\n... (preview truncated)'}
                </pre>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-semibold text-neutral-900">{title}</h3>
                  {author && (
                    <p className="text-sm text-neutral-600">By {author}</p>
                  )}
                  <div className="text-sm text-neutral-600">
                    <p>
                      <strong>Sections:</strong> {selectedIds.size}
                    </p>
                    <p>
                      <strong>Word count:</strong> {compiledDoc?.metadata.wordCount.toLocaleString()}
                    </p>
                    {compiledDoc?.metadata.tags.length ? (
                      <p>
                        <strong>Tags:</strong> {compiledDoc.metadata.tags.join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-medium text-neutral-700 mb-2">Sections:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-600">
                      {compiledDoc?.sections.map((s, i) => (
                        <li key={i}>{s.heading}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-neutral-50 rounded-b-xl flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {format === 'pdf'
              ? 'Opens print dialog for PDF export'
              : `Export as ${format.toUpperCase()} file`}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-neutral-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedIds.size === 0 || isExporting}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                selectedIds.size === 0 || isExporting
                  ? 'bg-gray-200 text-neutral-500 cursor-not-allowed'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }`}
            >
              {isExporting ? (
                <>
                  <span className="animate-spin">⚙️</span>
                  Exporting...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Export {format.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

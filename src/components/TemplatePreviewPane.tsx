/**
 * Template Preview Pane
 *
 * Shows a live preview of a template with placeholders filled.
 * Supports toggling between raw template view and preview mode.
 */

import { useState, useEffect } from 'react';
import type { Template, TemplateValues, Placeholder, FilledPlaceholder } from '../types/template';
import type { Note } from '../types/note';
import { applyTemplate, fillAIPlaceholders } from '../services/templates';

interface TemplatePreviewPaneProps {
  template: Template;
  values: TemplateValues;
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Check if a placeholder is an AI placeholder
 */
function isAIPlaceholder(placeholder: Placeholder): boolean {
  return placeholder.type === 'ai-search' || placeholder.type === 'ai-generate';
}

export function TemplatePreviewPane({
  template,
  values,
  notes,
  isOpen,
  onClose,
}: TemplatePreviewPaneProps) {
  const [viewMode, setViewMode] = useState<'raw' | 'preview' | 'ai'>('preview');
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [aiFilledPlaceholders, setAiFilledPlaceholders] = useState<FilledPlaceholder[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset when template changes
  useEffect(() => {
    setViewMode('preview');
    setAiContent(null);
    setAiFilledPlaceholders([]);
  }, [template.id]);

  // Generate AI content when switching to AI view
  useEffect(() => {
    if (viewMode === 'ai' && !aiContent && !loading) {
      generateAIContent();
    }
  }, [viewMode]);

  const generateAIContent = async () => {
    setLoading(true);
    try {
      const result = await fillAIPlaceholders(template, notes, values);
      // Apply regular placeholders first
      const basicResult = applyTemplate(template, values);
      // Combine: replace AI placeholders in the basic result
      let finalContent = basicResult.content;
      for (const filled of result.filledPlaceholders) {
        finalContent = finalContent.replace(filled.originalValue, filled.filledValue);
      }
      setAiContent(finalContent);
      setAiFilledPlaceholders(result.filledPlaceholders);
    } catch (err) {
      console.error('Failed to generate AI content:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Get content based on view mode
  const getContent = () => {
    if (viewMode === 'raw') {
      return template.structure;
    }
    if (viewMode === 'ai' && aiContent) {
      return aiContent;
    }
    return applyTemplate(template, values).content;
  };

  // Highlight placeholders in raw view
  const highlightPlaceholders = (content: string) => {
    return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const placeholder = template.placeholders.find(p => p.key === key);
      if (placeholder && isAIPlaceholder(placeholder)) {
        return `<span class="bg-amber-100 text-amber-800 px-1 rounded">${match}</span>`;
      }
      return `<span class="bg-violet-100 text-violet-800 px-1 rounded">${match}</span>`;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 max-h-[80vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <h3 className="font-semibold text-gray-900">Template Preview</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* View mode toggle */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 bg-white">
          <button
            onClick={() => setViewMode('raw')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'raw'
                ? 'bg-gray-200 text-gray-800'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Raw Template
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'preview'
                ? 'bg-violet-100 text-violet-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Preview
          </button>
          {template.aiEnhanced && (
            <button
              onClick={() => setViewMode('ai')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                viewMode === 'ai'
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Preview
              {loading && (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && viewMode === 'ai' ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-gray-500">Generating AI content...</p>
                <p className="text-xs text-gray-400 mt-1">Searching your notes</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Content preview */}
              {viewMode === 'raw' ? (
                <pre
                  className="text-sm font-mono whitespace-pre-wrap text-gray-700 bg-gray-50 p-4 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: highlightPlaceholders(getContent()) }}
                />
              ) : (
                <pre className="text-sm font-mono whitespace-pre-wrap text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {getContent()}
                </pre>
              )}

              {/* AI filled placeholders info */}
              {viewMode === 'ai' && aiFilledPlaceholders.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI-Generated Content
                  </div>
                  <div className="space-y-1">
                    {aiFilledPlaceholders.map((filled, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
                        <span className="font-medium">{filled.key.replace('ai:', '')}:</span>
                        <span className={`px-1.5 py-0.5 rounded ${
                          filled.source === 'search' ? 'bg-blue-100 text-blue-700' :
                          filled.source === 'generate' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {filled.source === 'search' ? 'Searched notes' :
                           filled.source === 'generate' ? 'Generated' :
                           'Fallback'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Placeholder legend */}
              {viewMode === 'raw' && (
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 bg-violet-100 text-violet-800 rounded">{'{{placeholder}}'}</span>
                    <span>User input</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">{'{{ai:...}}'}</span>
                    <span>AI-generated</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import type { Note } from '../types/note';
import type { Template, TemplateValues, Placeholder } from '../types/template';
import { getTemplates, applyTemplate, getFormattedDate, getTemplateCategories, deleteTemplate, fillAIPlaceholders } from '../services/templates';

/**
 * Check if a placeholder is an AI placeholder
 */
function isAIPlaceholder(placeholder: Placeholder): boolean {
  return placeholder.type === 'ai-search' || placeholder.type === 'ai-generate';
}

interface TemplatePickerProps {
  isOpen: boolean;
  notes: Note[];
  onClose: () => void;
  onCreateNote: (title: string, content: string, tags: string[]) => void;
  onOpenTemplateDialog?: () => void;
}

export function TemplatePicker({
  isOpen,
  notes, // Used for AI-enhanced templates
  onClose,
  onCreateNote,
  onOpenTemplateDialog,
}: TemplatePickerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [values, setValues] = useState<TemplateValues>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // AI preview state
  const [aiPreviewMode, setAiPreviewMode] = useState(false);
  const [aiPreviewContent, setAiPreviewContent] = useState<string | null>(null);
  const [aiPreviewLoading, setAiPreviewLoading] = useState(false);
  const [realtimePreviewEnabled, setRealtimePreviewEnabled] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
      setTemplates(getTemplates());
      setSelectedTemplate(null);
      setValues({});
      setSearchQuery('');
      setSelectedCategory(null);
      setAiPreviewMode(false);
      setAiPreviewContent(null);
      setAiPreviewLoading(false);
      setRealtimePreviewEnabled(true);
    }
  }, [isOpen]);

  // Real-time AI preview: Auto-generate when values change
  useEffect(() => {
    if (!selectedTemplate || !selectedTemplate.aiEnhanced || !realtimePreviewEnabled) {
      return;
    }

    // Only auto-generate if we have some required placeholder values filled
    const hasRequiredValues = selectedTemplate.placeholders
      .filter(p => !isAIPlaceholder(p) && p.required)
      .every(p => values[p.key]?.trim());

    if (!hasRequiredValues) {
      return;
    }

    // Debounce: wait 800ms after user stops typing
    const timeoutId = setTimeout(() => {
      handleGenerateAIPreview();
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [values, selectedTemplate, realtimePreviewEnabled, handleGenerateAIPreview]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    // Pre-fill date if template has date placeholder
    const dateValue = template.placeholders.find(p => p.key === 'date')
      ? getFormattedDate()
      : undefined;
    setValues(dateValue ? { date: dateValue } : {});
    // Reset AI preview when selecting a new template
    setAiPreviewMode(false);
    setAiPreviewContent(null);
  };

  // Generate AI preview
  const handleGenerateAIPreview = useCallback(async () => {
    if (!selectedTemplate) return;

    setAiPreviewLoading(true);
    try {
      const result = await fillAIPlaceholders(selectedTemplate, notes, values);
      // Apply regular placeholders first
      const basicResult = applyTemplate(selectedTemplate, values);
      // Combine: replace AI placeholders in the basic result
      let finalContent = basicResult.content;
      for (const filled of result.filledPlaceholders) {
        finalContent = finalContent.replace(filled.originalValue, filled.filledValue);
      }
      setAiPreviewContent(finalContent);
      setAiPreviewMode(true);
    } catch (err) {
      console.error('Failed to generate AI preview:', err);
    } finally {
      setAiPreviewLoading(false);
    }
  }, [selectedTemplate, notes, values]);

  const handleValueChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleCreate = () => {
    if (!selectedTemplate) return;

    const result = applyTemplate(selectedTemplate, values);
    onCreateNote(result.title, result.content, result.tags);
    handleClose();
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteTemplate(id)) {
      setTemplates(getTemplates());
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
    }
  };

  const categories = getTemplateCategories();

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const cat = template.category ?? 'uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  if (!isOpen && !isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible && !isClosing ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-3xl mx-4 max-h-[85vh] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden transition-all duration-300 ${
          isVisible && !isClosing ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header gradient */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 opacity-90" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="relative pt-3 px-6 flex items-center gap-3 text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <h2 className="text-xl font-bold">New Note from Template</h2>
        </div>

        {/* Content */}
        <div className="relative pt-6 flex h-[calc(85vh-120px)]">
          {/* Left: Template list */}
          <div className="w-1/2 px-6 border-r border-gray-100 overflow-y-auto">
            {/* Search */}
            <div className="sticky top-0 bg-white/80 backdrop-blur pb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 text-sm"
              />

              {/* Category filters */}
              {categories.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      !selectedCategory
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-1 rounded text-xs capitalize transition-colors ${
                        selectedCategory === cat
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Template list */}
            {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
              <div key={category} className="mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {category === 'uncategorized' ? 'Other' : category}
                </h3>
                <div className="space-y-2">
                  {categoryTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`w-full p-3 rounded-lg border text-left transition-all group ${
                        selectedTemplate?.id === template.id
                          ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {template.name}
                            {template.aiEnhanced && (
                              <span className="px-1.5 py-0.5 bg-gradient-to-r from-violet-100 to-purple-100 text-violet-600 text-xs rounded">
                                AI
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                            {template.description}
                          </div>
                        </div>
                        {!template.id.startsWith('builtin-') && (
                          <button
                            onClick={(e) => handleDeleteTemplate(template.id, e)}
                            className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete template"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {template.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No templates found.</p>
              </div>
            )}

            {/* Create template link */}
            {onOpenTemplateDialog && (
              <button
                onClick={() => {
                  handleClose();
                  onOpenTemplateDialog();
                }}
                className="w-full mt-4 p-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors text-sm"
              >
                + Create new template
              </button>
            )}
          </div>

          {/* Right: Placeholder form */}
          <div className="w-1/2 px-6 overflow-y-auto">
            {selectedTemplate ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <h3 className="font-semibold text-gray-900">Fill in details</h3>
                </div>

                {/* Regular placeholders (user input) */}
                {selectedTemplate.placeholders
                  .filter(p => !isAIPlaceholder(p))
                  .map(placeholder => (
                    <div key={placeholder.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {placeholder.label}
                        {placeholder.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {placeholder.type === 'date' ? (
                        <input
                          type="text"
                          value={values[placeholder.key] ?? ''}
                          onChange={(e) => handleValueChange(placeholder.key, e.target.value)}
                          placeholder={getFormattedDate()}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200"
                        />
                      ) : (
                        <input
                          type="text"
                          value={values[placeholder.key] ?? ''}
                          onChange={(e) => handleValueChange(placeholder.key, e.target.value)}
                          placeholder={placeholder.defaultValue ?? ''}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200"
                        />
                      )}
                    </div>
                  ))}

                {/* AI placeholders (shown as preview indicators) */}
                {selectedTemplate.placeholders.filter(isAIPlaceholder).length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AI-Generated Sections
                    </div>
                    {selectedTemplate.placeholders
                      .filter(isAIPlaceholder)
                      .map(placeholder => (
                        <div
                          key={placeholder.key}
                          className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100"
                        >
                          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-amber-800">{placeholder.label}</div>
                            <div className="text-xs text-amber-600 truncate">
                              {placeholder.type === 'ai-search' ? 'Searches your notes' : 'Generates content'}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Preview section with AI toggle */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Preview</h4>
                    {selectedTemplate.aiEnhanced && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAiPreviewMode(false)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            !aiPreviewMode
                              ? 'bg-gray-200 text-gray-700'
                              : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          Template
                        </button>
                        <button
                          onClick={handleGenerateAIPreview}
                          disabled={aiPreviewLoading}
                          className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                            aiPreviewMode
                              ? 'bg-amber-100 text-amber-700'
                              : 'text-amber-600 hover:bg-amber-50'
                          } ${aiPreviewLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {aiPreviewLoading ? (
                            <>
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              AI Preview
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setRealtimePreviewEnabled(!realtimePreviewEnabled)}
                          className={`ml-1 px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                            realtimePreviewEnabled
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={realtimePreviewEnabled ? 'Disable real-time preview' : 'Enable real-time preview'}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={realtimePreviewEnabled ? "M13 10V3L4 14h7v7l9-11h-7z" : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                          </svg>
                          {realtimePreviewEnabled ? 'Auto' : 'Manual'}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    {aiPreviewLoading && realtimePreviewEnabled && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Updating...
                      </div>
                    )}
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                      {aiPreviewMode && aiPreviewContent
                        ? aiPreviewContent.slice(0, 800)
                        : applyTemplate(selectedTemplate, values).content.slice(0, 500)}
                      {(aiPreviewMode && aiPreviewContent
                        ? aiPreviewContent.length > 800
                        : applyTemplate(selectedTemplate, values).content.length > 500) && '...'}
                    </pre>
                  </div>
                  {aiPreviewMode && aiPreviewContent && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {realtimePreviewEnabled ? 'Real-time AI preview based on your notes' : 'AI-generated content preview based on your notes'}
                    </p>
                  )}
                  {realtimePreviewEnabled && !aiPreviewMode && selectedTemplate.aiEnhanced && (
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Fill in required fields to see AI preview
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Select a template to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="relative px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedTemplate}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Note
          </button>
        </div>
      </div>
    </div>
  );
}

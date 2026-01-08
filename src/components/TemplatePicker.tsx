import { useEffect, useState } from 'react';
import type { Note } from '../types/note';
import type { Template, TemplateValues } from '../types/template';
import { getTemplates, applyTemplate, getFormattedDate, getTemplateCategories, deleteTemplate } from '../services/templates';

interface TemplatePickerProps {
  isOpen: boolean;
  notes: Note[];
  onClose: () => void;
  onCreateNote: (title: string, content: string, tags: string[]) => void;
  onOpenTemplateDialog?: () => void;
}

export function TemplatePicker({
  isOpen,
  notes: _notes, // Reserved for AI-enhanced templates
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

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
      setTemplates(getTemplates());
      setSelectedTemplate(null);
      setValues({});
      setSearchQuery('');
      setSelectedCategory(null);
    }
  }, [isOpen]);

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
  };

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

                {selectedTemplate.placeholders
                  .filter(p => p.type !== 'ai-fill')
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

                {selectedTemplate.aiEnhanced && (
                  <div className="p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-violet-100">
                    <div className="flex items-center gap-2 text-violet-700 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AI-Enhanced Template
                    </div>
                    <p className="text-xs text-violet-600 mt-1">
                      This template will automatically include related notes from your knowledge base.
                    </p>
                  </div>
                )}

                {/* Preview */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                    {applyTemplate(selectedTemplate, values).content.slice(0, 500)}
                    {applyTemplate(selectedTemplate, values).content.length > 500 && '...'}
                  </pre>
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

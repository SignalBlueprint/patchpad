import { useEffect, useState } from 'react';
import type { Note } from '../types/note';
import type { Template, Placeholder } from '../types/template';
import { detectPatterns, generateTemplateFromPattern } from '../services/templateDetection';
import { saveTemplate, patternToTemplate } from '../services/templates';

interface TemplateDialogProps {
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  onSaveTemplate?: (template: Template) => void;
  initialPattern?: string; // Pattern name to pre-fill
}

export function TemplateDialog({
  notes,
  isOpen,
  onClose,
  onSaveTemplate,
  initialPattern,
}: TemplateDialogProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'detected' | 'custom'>('detected');

  // Detected patterns
  const patterns = detectPatterns(notes);

  // Custom template form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [structure, setStructure] = useState('# {{title}}\n\n');
  const [tags, setTags] = useState('');
  const [titlePrefix, setTitlePrefix] = useState('');
  const [category, setCategory] = useState('');

  // Selected pattern for preview
  const [selectedPattern, setSelectedPattern] = useState<string | null>(
    initialPattern ?? patterns[0]?.name ?? null
  );

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialPattern) {
      setSelectedPattern(initialPattern);
    }
  }, [initialPattern]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

  const handleSavePattern = () => {
    const pattern = patterns.find(p => p.name === selectedPattern);
    if (!pattern) return;

    const templateStructure = generateTemplateFromPattern(pattern);
    const template = patternToTemplate(
      pattern.name,
      templateStructure,
      {
        description: `Template created from ${pattern.frequency} notes`,
        tags: pattern.commonTags,
        titlePrefix: pattern.titlePrefix,
        category: category || undefined,
      }
    );

    const saved = saveTemplate(template);
    onSaveTemplate?.(saved);
    handleClose();
  };

  const handleSaveCustom = () => {
    if (!name.trim() || !structure.trim()) return;

    // Extract placeholders from structure
    const placeholderRegex = /\{\{(\w+(?::\w+)?)\}\}/g;
    const matches = structure.matchAll(placeholderRegex);
    const placeholderKeys = new Set<string>();

    for (const match of matches) {
      placeholderKeys.add(match[1]);
    }

    const placeholders: Placeholder[] = Array.from(placeholderKeys).map(key => {
      if (key.startsWith('ai:')) {
        return {
          key,
          label: key.replace('ai:', '').replace(/_/g, ' '),
          type: 'ai-fill' as const,
          aiPrompt: `Generate ${key.replace('ai:', '').replace(/_/g, ' ')}`,
        };
      }
      if (key === 'date') {
        return { key, label: 'Date', type: 'date' as const };
      }
      return {
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        type: 'text' as const,
        required: key === 'title',
      };
    });

    const saved = saveTemplate({
      name: name.trim(),
      description: description.trim() || `Custom template: ${name}`,
      structure,
      placeholders,
      aiEnhanced: placeholders.some(p => p.type === 'ai-fill'),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      titlePrefix: titlePrefix.trim() || undefined,
      category: category.trim() || undefined,
    });

    onSaveTemplate?.(saved);
    handleClose();
  };

  if (!isOpen && !isVisible) return null;

  const selectedPatternData = patterns.find(p => p.name === selectedPattern);

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
        className={`relative w-full max-w-2xl mx-4 max-h-[80vh] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden transition-all duration-300 ${
          isVisible && !isClosing ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header gradient */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 opacity-90" />

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
        <div className="relative pt-4 px-6">
          <div className="flex items-center gap-3 text-white mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-bold">Create Template</h2>
          </div>
        </div>

        {/* Tabs */}
        <div className="relative px-6 mt-4 flex gap-2">
          <button
            onClick={() => setActiveTab('detected')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'detected'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Detected Patterns ({patterns.length})
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'custom'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Custom Template
          </button>
        </div>

        {/* Content */}
        <div className="relative p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          {activeTab === 'detected' ? (
            <div className="space-y-4">
              {patterns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No patterns detected yet.</p>
                  <p className="text-sm mt-2">Create more notes with similar structures to see patterns.</p>
                </div>
              ) : (
                <>
                  {/* Pattern list */}
                  <div className="grid grid-cols-2 gap-3">
                    {patterns.map(pattern => (
                      <button
                        key={pattern.name}
                        onClick={() => setSelectedPattern(pattern.name)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedPattern === pattern.name
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{pattern.name}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {pattern.frequency} notes
                        </div>
                        {pattern.commonTags && pattern.commonTags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {pattern.commonTags.map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Preview */}
                  {selectedPatternData && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-medium text-gray-700 mb-2">Template Preview</h3>
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-gray-200 max-h-48 overflow-y-auto">
                        {generateTemplateFromPattern(selectedPatternData)}
                      </pre>
                      <div className="mt-3 text-sm text-gray-500">
                        <strong>Features detected:</strong>{' '}
                        {selectedPatternData.structure.hasBulletLists && 'bullet lists, '}
                        {selectedPatternData.structure.hasCheckboxes && 'checkboxes, '}
                        {selectedPatternData.structure.hasCodeBlocks && 'code blocks, '}
                        {selectedPatternData.structure.sections.length > 0 && `${selectedPatternData.structure.sections.length} sections`}
                      </div>
                    </div>
                  )}

                  {/* Category input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category (optional)
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., work, personal, learning"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Weekly Review"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this template"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Structure */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Structure *
                </label>
                <textarea
                  value={structure}
                  onChange={(e) => setStructure(e.target.value)}
                  placeholder="# {{title}}\n\n## Section\n\n- Item"
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use {'{{placeholder}}'} for fillable fields. Special placeholders: {'{{title}}'}, {'{{date}}'}, {'{{ai:related_notes}}'}
                </p>
              </div>

              {/* Title prefix */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title Prefix (optional)
                </label>
                <input
                  type="text"
                  value={titlePrefix}
                  onChange={(e) => setTitlePrefix(e.target.value)}
                  placeholder="e.g., Meeting:"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Auto-apply Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="work, weekly, review"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category (optional)
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., work, personal"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>
          )}
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
            onClick={activeTab === 'detected' ? handleSavePattern : handleSaveCustom}
            disabled={
              activeTab === 'detected'
                ? !selectedPattern
                : !name.trim() || !structure.trim()
            }
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}

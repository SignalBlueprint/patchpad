/**
 * Session Template Picker Component
 *
 * Modal for selecting a session template when starting a new recording.
 */

import { useState } from 'react';
import type { SessionTemplate } from '../types/sessionTemplate';
import {
  getBuiltInTemplates,
  getUserTemplates,
  getWorkflowEstimatedTime,
  getTemplateIconClass,
} from '../services/sessionTemplates';

interface SessionTemplatePickerProps {
  onSelectTemplate: (template: SessionTemplate | null) => void;
  onClose: () => void;
}

// Template icon SVGs
const TemplateIcon = ({ icon, className }: { icon: SessionTemplate['icon']; className?: string }) => {
  switch (icon) {
    case 'brainstorm':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      );
    case 'problem':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      );
    case 'review':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      );
    case 'freeform':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
          />
        </svg>
      );
    case 'custom':
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
          />
        </svg>
      );
  }
};

// Layout preview visualization
const LayoutPreview = ({ layout }: { layout: SessionTemplate['layout'] }) => {
  const getLayoutVisualization = () => {
    switch (layout.type) {
      case 'radial':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="8" className="fill-current opacity-60" />
            <circle cx="50" cy="25" r="5" className="fill-current opacity-40" />
            <circle cx="75" cy="50" r="5" className="fill-current opacity-40" />
            <circle cx="50" cy="75" r="5" className="fill-current opacity-40" />
            <circle cx="25" cy="50" r="5" className="fill-current opacity-40" />
            <circle cx="35" cy="30" r="4" className="fill-current opacity-30" />
            <circle cx="65" cy="30" r="4" className="fill-current opacity-30" />
            <circle cx="65" cy="70" r="4" className="fill-current opacity-30" />
            <circle cx="35" cy="70" r="4" className="fill-current opacity-30" />
          </svg>
        );
      case 'columns':
      case 'kanban':
        const cols = layout.columnConfig?.columns.length || 4;
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {Array.from({ length: cols }).map((_, i) => (
              <g key={i}>
                <rect
                  x={5 + (90 / cols) * i}
                  y="10"
                  width={(90 / cols) - 5}
                  height="80"
                  rx="3"
                  className="fill-current opacity-20"
                />
                <rect
                  x={8 + (90 / cols) * i}
                  y="20"
                  width={(90 / cols) - 11}
                  height="12"
                  rx="2"
                  className="fill-current opacity-40"
                />
                <rect
                  x={8 + (90 / cols) * i}
                  y="36"
                  width={(90 / cols) - 11}
                  height="12"
                  rx="2"
                  className="fill-current opacity-40"
                />
                <rect
                  x={8 + (90 / cols) * i}
                  y="52"
                  width={(90 / cols) - 11}
                  height="12"
                  rx="2"
                  className="fill-current opacity-30"
                />
              </g>
            ))}
          </svg>
        );
      case 'grid':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {[0, 1, 2].map((row) =>
              [0, 1, 2].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={10 + col * 30}
                  y={10 + row * 30}
                  width="25"
                  height="25"
                  rx="3"
                  className="fill-current opacity-40"
                />
              ))
            )}
          </svg>
        );
      case 'freeform':
      default:
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <rect x="15" y="20" width="25" height="20" rx="3" className="fill-current opacity-40" />
            <rect x="55" y="15" width="30" height="25" rx="3" className="fill-current opacity-30" />
            <rect x="25" y="55" width="35" height="18" rx="3" className="fill-current opacity-50" />
            <rect x="70" y="60" width="20" height="22" rx="3" className="fill-current opacity-35" />
            <rect x="10" y="45" width="20" height="15" rx="3" className="fill-current opacity-25" />
          </svg>
        );
    }
  };

  return (
    <div className="w-16 h-16 text-current">
      {getLayoutVisualization()}
    </div>
  );
};

export function SessionTemplatePicker({ onSelectTemplate, onClose }: SessionTemplatePickerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<SessionTemplate | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [showWorkflow, setShowWorkflow] = useState(false);

  const builtInTemplates = getBuiltInTemplates();
  const userTemplates = getUserTemplates();

  const handleStart = () => {
    if (selectedTemplate) {
      onSelectTemplate({
        ...selectedTemplate,
        // If user provided a custom title, we'll pass it through
      });
    } else {
      onSelectTemplate(null); // Start without template
    }
  };

  const handleQuickStart = () => {
    onSelectTemplate(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-[800px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-500">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Start Recording Session
            </h2>
            <p className="text-sm text-white/80 mt-0.5">
              Choose a template or start with a blank canvas
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Quick start option */}
          <div className="mb-6">
            <button
              onClick={handleQuickStart}
              className="w-full p-4 border-2 border-dashed border-neutral-200 hover:border-neutral-300 rounded-xl text-left transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 group-hover:bg-gray-200 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-neutral-900">Quick Start</h3>
                  <p className="text-sm text-neutral-500">Start recording immediately without a template</p>
                </div>
              </div>
            </button>
          </div>

          {/* Templates section */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-neutral-700 mb-3">Session Templates</h3>
            <div className="grid grid-cols-2 gap-4">
              {builtInTemplates.map((template) => {
                const isSelected = selectedTemplate?.id === template.id;
                const estimatedTime = getWorkflowEstimatedTime(template.id);
                const iconClass = getTemplateIconClass(template);

                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(isSelected ? null : template)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                        : 'border-neutral-200 hover:border-neutral-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconClass}`}>
                        <TemplateIcon icon={template.icon} className="w-6 h-6" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-neutral-900">{template.name}</h4>
                          {estimatedTime > 0 && (
                            <span className="text-xs text-neutral-400">~{estimatedTime} min</span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-500 mt-0.5 line-clamp-2">
                          {template.description}
                        </p>
                        {template.autoTags.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            {template.autoTags.map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Layout preview */}
                      <div className="flex-shrink-0" style={{ color: template.color }}>
                        <LayoutPreview layout={template.layout} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User templates */}
          {userTemplates.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-neutral-700 mb-3">My Templates</h3>
              <div className="grid grid-cols-2 gap-4">
                {userTemplates.map((template) => {
                  const isSelected = selectedTemplate?.id === template.id;
                  const iconClass = getTemplateIconClass(template);

                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(isSelected ? null : template)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconClass}`}>
                          <TemplateIcon icon={template.icon} className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-neutral-900">{template.name}</h4>
                          <p className="text-sm text-neutral-500 line-clamp-1">{template.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected template details */}
          {selectedTemplate && (
            <div className="mt-6 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-neutral-900">
                  {selectedTemplate.name} Workflow
                </h4>
                <button
                  onClick={() => setShowWorkflow(!showWorkflow)}
                  className="text-sm text-secondary-600 hover:text-indigo-700"
                >
                  {showWorkflow ? 'Hide steps' : 'Show steps'}
                </button>
              </div>

              {showWorkflow && (
                <div className="space-y-3">
                  {selectedTemplate.workflow.map((step, index) => (
                    <div
                      key={step.order}
                      className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium text-white flex-shrink-0"
                        style={{ backgroundColor: selectedTemplate.color }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-neutral-900 text-sm">{step.title}</h5>
                          {step.estimatedMinutes && (
                            <span className="text-xs text-neutral-400">
                              {step.estimatedMinutes} min
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-500 mt-0.5">{step.description}</p>
                        {step.tips && step.tips.length > 0 && (
                          <ul className="mt-2 text-xs text-neutral-400">
                            {step.tips.map((tip, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-indigo-400">•</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Session title input */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Session Title (optional)
                </label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder={`${selectedTemplate.name} Session`}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-neutral-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-gray-800 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!selectedTemplate}
            className={`px-6 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
              selectedTemplate
                ? 'bg-indigo-500 text-white hover:bg-secondary-600'
                : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Recording
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Template Suggestion Banner
 *
 * Appears when patterns are detected in existing notes,
 * suggesting the user create a template based on those patterns.
 */

import { useState } from 'react';
import type { TemplateSuggestion } from '../services/templateDetection';
import { saveTemplate, patternToTemplate } from '../services/templates';

interface TemplateSuggestionBannerProps {
  suggestion: TemplateSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
}

export function TemplateSuggestionBanner({
  suggestion,
  onAccept,
  onDismiss,
}: TemplateSuggestionBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTemplate = async () => {
    setIsCreating(true);
    try {
      // Convert the suggestion to a template and save it
      const templateData = patternToTemplate(
        suggestion.title,
        suggestion.templateContent,
        {
          description: suggestion.description,
          category: 'custom',
        }
      );
      saveTemplate(templateData);
      onAccept();
    } catch (err) {
      console.error('Failed to create template:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // Get pattern description
  const patternDescription = (() => {
    if (suggestion.sourcePattern === 'title') {
      return `${suggestion.basedOnNotes} notes starting with this prefix`;
    }
    if (suggestion.sourcePattern === 'structure') {
      return `${suggestion.basedOnNotes} notes with similar structure`;
    }
    return `${suggestion.basedOnNotes} notes with matching patterns`;
  })();

  // Get confidence level text
  const confidenceText = (() => {
    if (suggestion.confidence >= 0.9) return 'Very strong pattern';
    if (suggestion.confidence >= 0.7) return 'Strong pattern';
    if (suggestion.confidence >= 0.5) return 'Moderate pattern';
    return 'Possible pattern';
  })();

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4 mb-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-900">
              We noticed a pattern in your notes
            </p>
            <p className="text-sm text-neutral-600 mt-0.5">
              {patternDescription}. Would you like to create a "{suggestion.title}" template?
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                suggestion.confidence >= 0.7
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {confidenceText}
              </span>
              <span className="text-xs text-neutral-500">
                Based on {suggestion.basedOnNotes} notes
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Preview toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-3 flex items-center gap-1 text-sm text-success-600 hover:text-emerald-700 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {isExpanded ? 'Hide preview' : 'Show template preview'}
      </button>

      {/* Template preview */}
      {isExpanded && (
        <div className="mt-3 bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-600">Template Structure</span>
            <span className="text-xs text-neutral-400">{suggestion.title}</span>
          </div>
          <pre className="p-3 text-xs text-neutral-700 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
            {suggestion.templateContent}
          </pre>
          <div className="px-3 py-2 bg-neutral-50 border-t border-neutral-200">
            <p className="text-xs text-neutral-500">{suggestion.description}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleCreateTemplate}
          disabled={isCreating}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
            isCreating
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
          }`}
        >
          {isCreating ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating...
            </span>
          ) : (
            'Create Template'
          )}
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Not now
        </button>
        <button
          onClick={() => {
            // Store dismissal preference in localStorage
            localStorage.setItem('patchpad_pattern_dismissed', suggestion.title);
            onDismiss();
          }}
          className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          Don't show again
        </button>
      </div>
    </div>
  );
}

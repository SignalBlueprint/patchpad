import { useState, useEffect } from 'react';
import type { Template } from '../types/template';

interface TemplateSuggestionToastProps {
  template: Template;
  confidence: number;
  onAccept: (template: Template) => void;
  onDismiss: () => void;
}

export function TemplateSuggestionToast({
  template,
  confidence,
  onAccept,
  onDismiss,
}: TemplateSuggestionToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto-dismiss after 8 seconds if no action taken
    const timeout = setTimeout(() => {
      handleDismiss();
    }, 8000);

    return () => clearTimeout(timeout);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 200);
  };

  const handleAccept = () => {
    setIsExiting(true);
    setTimeout(() => {
      onAccept(template);
    }, 200);
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-200 ${
        isVisible && !isExiting
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-4 max-w-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900">
                Use template?
              </p>
              <p className="text-xs text-neutral-500">
                {template.name}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="mt-2 text-xs text-neutral-600 line-clamp-2">
          {template.description}
        </p>

        {/* Confidence indicator */}
        {confidence >= 0.8 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-success-600">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>High match</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-colors"
          >
            Use Template
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Tags preview */}
        {template.tags && template.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-xs bg-neutral-100 text-neutral-500 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

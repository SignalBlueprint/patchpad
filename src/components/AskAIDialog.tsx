import { useState, useEffect, useRef } from 'react';

interface AskAIDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  selection?: string;
}

export function AskAIDialog({ isOpen, onClose, onSubmit, selection }: AskAIDialogProps) {
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, prompt, onClose]);

  const handleSubmit = () => {
    if (prompt.trim()) {
      onSubmit(prompt.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ask AI</h2>
          <p className="text-sm text-gray-500 mt-1">
            Ask a question about your note or selected text
          </p>
        </div>

        <div className="p-6">
          {selection && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs font-medium text-gray-500 mb-1">Selected text:</div>
              <div className="text-sm text-gray-700 line-clamp-3">{selection}</div>
            </div>
          )}

          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Summarize the key points, What are the action items?, Explain this concept..."
            className="w-full h-32 px-4 py-3 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <div className="mt-2 text-xs text-gray-400">
            Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Ctrl+Enter</kbd> to submit
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ask AI
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import type { HighlightColor } from '../types/note';

interface SelectionToolbarProps {
  selection: { from: number; to: number; text: string } | null;
  editorElement: HTMLElement | null;
  onAction: (action: string) => void;
  onHighlight?: (color: HighlightColor, annotation?: string) => void;
  isAIAvailable: boolean;
}

interface Position {
  top: number;
  left: number;
}

const highlightColors: { color: HighlightColor; bg: string; label: string }[] = [
  { color: 'yellow', bg: 'bg-yellow-300', label: 'Yellow' },
  { color: 'green', bg: 'bg-green-300', label: 'Green' },
  { color: 'blue', bg: 'bg-blue-300', label: 'Blue' },
  { color: 'pink', bg: 'bg-pink-300', label: 'Pink' },
  { color: 'orange', bg: 'bg-orange-300', label: 'Orange' },
];

export function SelectionToolbar({ selection, editorElement, onAction, onHighlight, isAIAvailable }: SelectionToolbarProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const [showHighlightColors, setShowHighlightColors] = useState(false);
  const [selectedColor, setSelectedColor] = useState<HighlightColor | null>(null);
  const [annotation, setAnnotation] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const annotationInputRef = useRef<HTMLInputElement>(null);

  // Reset highlight picker when selection changes
  useEffect(() => {
    setShowHighlightColors(false);
    setSelectedColor(null);
    setAnnotation('');
  }, [selection]);

  // Focus annotation input when color is selected
  useEffect(() => {
    if (selectedColor && annotationInputRef.current) {
      annotationInputRef.current.focus();
    }
  }, [selectedColor]);

  useEffect(() => {
    if (!selection || !editorElement || selection.text.length < 3) {
      setPosition(null);
      return;
    }

    // Get the browser selection to find its position
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.rangeCount === 0) {
      setPosition(null);
      return;
    }

    const range = browserSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorElement.getBoundingClientRect();

    // Position toolbar above the selection
    const toolbarHeight = 40;
    const top = rect.top - editorRect.top - toolbarHeight - 8;
    const left = rect.left - editorRect.left + (rect.width / 2);

    setPosition({ top: Math.max(0, top), left });
  }, [selection, editorElement]);

  if (!position || !selection) {
    return null;
  }

  const actions = [
    { id: 'explain', label: 'Explain', icon: '💡', requiresAI: true },
    { id: 'simplify', label: 'Simplify', icon: '✨', requiresAI: true },
    { id: 'expand', label: 'Expand', icon: '📝', requiresAI: true },
    { id: 'fix-grammar', label: 'Fix', icon: '✓', requiresAI: false },
    { id: 'translate', label: 'Translate', icon: '🌐', requiresAI: true },
    { id: 'ask-ai', label: 'Ask...', icon: '💬', requiresAI: true },
  ];

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 flex items-center gap-1 px-2 py-1.5 bg-gray-900 rounded-lg shadow-xl animate-fade-in"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Highlight button with color picker and annotation */}
      {onHighlight && (
        <div className="relative">
          <button
            onClick={() => {
              setShowHighlightColors(!showHighlightColors);
              setSelectedColor(null);
              setAnnotation('');
            }}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors text-gray-200 hover:bg-gray-700"
            title="Highlight"
          >
            <span className="w-4 h-4 rounded bg-gradient-to-r from-yellow-300 via-green-300 to-blue-300" />
            <span className="hidden sm:inline">Highlight</span>
          </button>

          {/* Color picker and annotation dropdown */}
          {showHighlightColors && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px]">
              {/* Color options */}
              <div className="flex gap-1 mb-2">
                {highlightColors.map(({ color, bg, label }) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-6 h-6 rounded ${bg} transition-all ${
                      selectedColor === color ? 'ring-2 ring-gray-600 ring-offset-1' : 'hover:ring-2 hover:ring-gray-400'
                    }`}
                    title={label}
                  />
                ))}
              </div>

              {/* Annotation input */}
              {selectedColor && (
                <div className="space-y-2">
                  <input
                    ref={annotationInputRef}
                    type="text"
                    value={annotation}
                    onChange={(e) => setAnnotation(e.target.value)}
                    placeholder="Add a note (optional)"
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onHighlight(selectedColor, annotation || undefined);
                        setShowHighlightColors(false);
                        setSelectedColor(null);
                        setAnnotation('');
                      } else if (e.key === 'Escape') {
                        setShowHighlightColors(false);
                        setSelectedColor(null);
                        setAnnotation('');
                      }
                    }}
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        onHighlight(selectedColor, annotation || undefined);
                        setShowHighlightColors(false);
                        setSelectedColor(null);
                        setAnnotation('');
                      }}
                      className="flex-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        setShowHighlightColors(false);
                        setSelectedColor(null);
                        setAnnotation('');
                      }}
                      className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Quick apply hint when no color selected */}
              {!selectedColor && (
                <p className="text-[10px] text-gray-400 text-center">
                  Click a color to add a note
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      {onHighlight && <div className="w-px h-4 bg-gray-600 mx-1" />}

      {/* AI Actions */}
      {actions.map((action) => {
        const disabled = action.requiresAI && !isAIAvailable;
        return (
          <button
            key={action.id}
            onClick={() => !disabled && onAction(action.id)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors ${
              disabled
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-gray-200 hover:bg-gray-700'
            }`}
            title={disabled ? 'AI required' : action.label}
          >
            <span>{action.icon}</span>
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        );
      })}

      {/* Triangle pointer */}
      <div
        className="absolute w-3 h-3 bg-gray-900 transform rotate-45"
        style={{
          bottom: -6,
          left: '50%',
          marginLeft: -6,
        }}
      />
    </div>
  );
}

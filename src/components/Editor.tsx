import { useEffect, useRef, useCallback, useState } from 'react';
import { EditorView, keymap, highlightActiveLine, lineNumbers, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { EditorState, Compartment, StateField, StateEffect } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import type { Note, Highlight } from '../types/note';
import { parseWikiLinks, getWikiLinkDisplayText, type ParsedWikiLink } from '../utils/linkParser';
import { LinkPreviewCard } from './LinkPreviewCard';
import { useLinkSuggestions, type LinkSuggestion } from '../hooks/useLinkSuggestions';
import { LinkSuggestionToast } from './LinkSuggestionToast';
import { AudioPlaybackButton } from './AudioPlaybackButton';

interface EditorProps {
  note: Note | null;
  onSave: (id: string, content: string) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void;
  onWikiLinkClick?: (targetTitle: string) => void;
  allNotes?: Note[];
  onShare?: () => void;
  isSyncEnabled?: boolean;
}

// Line height for text alignment with dot grid
const LINE_HEIGHT = 24;

// Custom theme for PatchPad
const patchPadTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    height: '100%',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-content': {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '16px',
    minHeight: '100%',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  },
  '.cm-line': {
    lineHeight: `${LINE_HEIGHT}px`,
    wordBreak: 'break-word',
  },
  '.cm-gutters': {
    backgroundColor: '#f9fafb',
    borderRight: '1px solid #e5e7eb',
    color: '#9ca3af',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#f3f4f6',
  },
  '.cm-activeLine': {
    backgroundColor: '#f8fafc',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#dbeafe',
  },
  '.cm-cursor': {
    borderLeftColor: '#3b82f6',
  },
  '.cm-placeholder': {
    color: '#9ca3af',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  // Markdown syntax highlighting
  '.cm-header-1': {
    fontSize: '1.5em',
    fontWeight: 'bold',
    color: '#1e293b',
  },
  '.cm-header-2': {
    fontSize: '1.3em',
    fontWeight: 'bold',
    color: '#334155',
  },
  '.cm-header-3': {
    fontSize: '1.1em',
    fontWeight: 'bold',
    color: '#475569',
  },
  '.cm-strong': {
    fontWeight: 'bold',
  },
  '.cm-emphasis': {
    fontStyle: 'italic',
  },
  '.cm-strikethrough': {
    textDecoration: 'line-through',
  },
  '.cm-link': {
    color: '#2563eb',
    textDecoration: 'underline',
  },
  '.cm-url': {
    color: '#7c3aed',
  },
  '.cm-code': {
    backgroundColor: '#f1f5f9',
    borderRadius: '3px',
    padding: '1px 4px',
    fontFamily: 'ui-monospace, monospace',
  },
});

// Dark theme variant
const patchPadDarkTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    height: '100%',
    backgroundColor: '#1e1e1e',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-content': {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '16px',
    minHeight: '100%',
    caretColor: '#fff',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  },
  '.cm-line': {
    lineHeight: `${LINE_HEIGHT}px`,
    wordBreak: 'break-word',
  },
  '.cm-gutters': {
    backgroundColor: '#252526',
    borderRight: '1px solid #3c3c3c',
    color: '#858585',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#2a2d2e',
  },
  '.cm-activeLine': {
    backgroundColor: '#2a2d2e',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#515c6a',
  },
  '.cm-cursor': {
    borderLeftColor: '#fff',
  },
  '.cm-placeholder': {
    color: '#6b7280',
  },
  '&.cm-focused': {
    outline: 'none',
  },
}, { dark: true });

const themeCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const highlightsCompartment = new Compartment();

// Highlight color classes
const highlightColors: Record<string, string> = {
  yellow: 'bg-yellow-200',
  green: 'bg-green-200',
  blue: 'bg-blue-200',
  pink: 'bg-pink-200',
  orange: 'bg-orange-200',
};

// StateEffect to update highlights
const setHighlightsEffect = StateEffect.define<Highlight[]>();

// StateEffect to update wiki links
const setWikiLinksEffect = StateEffect.define<{ links: ParsedWikiLink[]; allNotes: Note[] }>();

// Create wiki link decorations
function createWikiLinkDecorations(links: ParsedWikiLink[], allNotes: Note[]): DecorationSet {
  const decorations = links
    .filter(link => link.from >= 0 && link.to > link.from)
    .sort((a, b) => a.from - b.from)
    .map(link => {
      const displayText = getWikiLinkDisplayText(link);
      // Check if linked note exists
      const noteExists = allNotes.some(
        n => n.title.toLowerCase().trim() === link.targetTitle.toLowerCase().trim()
      );

      return Decoration.mark({
        class: noteExists
          ? 'wiki-link wiki-link-valid cursor-pointer text-blue-600 hover:text-blue-800 hover:bg-blue-50 underline decoration-blue-400 decoration-1 underline-offset-2'
          : 'wiki-link wiki-link-broken cursor-pointer text-red-500 hover:text-red-700 hover:bg-red-50 underline decoration-red-300 decoration-dashed decoration-1 underline-offset-2',
        attributes: {
          'data-wiki-link': link.targetTitle,
          'data-link-exists': noteExists ? 'true' : 'false',
          title: noteExists ? `Go to: ${link.targetTitle}` : `Create note: ${link.targetTitle}`,
        },
      }).range(link.from, link.to);
    });

  return Decoration.set(decorations, true);
}

// StateField to manage wiki link decorations
const wikiLinksField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setWikiLinksEffect)) {
        return createWikiLinkDecorations(effect.value.links, effect.value.allNotes);
      }
    }
    // Map decorations through document changes
    return decorations.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f),
});

// Create highlight decorations from stored highlights
function createHighlightDecorations(highlights: Highlight[]): DecorationSet {
  const decorations = highlights
    .filter(h => h.from >= 0 && h.to >= h.from)
    .sort((a, b) => a.from - b.from)
    .map(h => {
      const bgColor = highlightColors[h.color] || 'bg-yellow-200';
      const hasNote = h.note && h.note.trim().length > 0;
      return Decoration.mark({
        class: `${bgColor} rounded-sm ${hasNote ? 'cursor-help border-b-2 border-dashed border-gray-400' : ''}`,
        attributes: {
          'data-highlight-id': h.id,
          ...(hasNote ? { title: h.note } : {}),
        },
      }).range(h.from, h.to);
    });

  return Decoration.set(decorations, true);
}

// StateField to manage highlight decorations
const highlightsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHighlightsEffect)) {
        return createHighlightDecorations(effect.value);
      }
    }
    // Map decorations through document changes
    return decorations.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f),
});

export function Editor({ note, onSave, showPreview, onTogglePreview, onSelectionChange, onWikiLinkClick, allNotes = [], onShare, isSyncEnabled = false, editorContainerRef }: EditorProps & { editorContainerRef?: React.RefObject<HTMLDivElement> }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteIdRef = useRef<string | null>(null);

  // Link preview state
  const [hoveredLink, setHoveredLink] = useState<{ title: string; element: HTMLElement } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track current content for link suggestions
  const [currentContent, setCurrentContent] = useState<string>(note?.content || '');

  // Link suggestions hook
  const {
    suggestions: linkSuggestions,
    dismissSuggestion,
    acceptSuggestion,
    resetDismissed,
    reportActivity: reportLinkActivity,
  } = useLinkSuggestions({
    content: currentContent,
    notes: allNotes.filter(n => n.id !== note?.id), // Exclude current note
    enabled: !!note,
    idleTimeout: 500,
  });

  // Update word/char count
  const updateStats = useCallback((content: string) => {
    setCharCount(content.length);
    const words = content.trim().split(/\s+/).filter(w => w.length > 0);
    setWordCount(words.length);
    setCurrentContent(content);
  }, []);

  // Reset dismissed suggestions when switching notes
  useEffect(() => {
    if (note?.id) {
      resetDismissed();
      setCurrentContent(note.content || '');
    }
  }, [note?.id, resetDismissed]);

  // Handle accepting a link suggestion - wrap the term with [[...]]
  const handleAcceptLinkSuggestion = useCallback((suggestion: LinkSuggestion) => {
    if (!viewRef.current) return;

    const content = viewRef.current.state.doc.toString();
    const term = suggestion.term;
    const position = suggestion.position;

    // Verify the term is still at the expected position
    const foundTerm = content.substring(position, position + term.length);
    if (foundTerm.toLowerCase() !== term.toLowerCase()) {
      // Term has moved, try to find it again
      const termLower = term.toLowerCase();
      const contentLower = content.toLowerCase();
      const newPos = contentLower.indexOf(termLower);
      if (newPos === -1) {
        acceptSuggestion(term);
        return;
      }
      // Use new position
      const wikiLink = `[[${suggestion.noteTitle}]]`;
      viewRef.current.dispatch({
        changes: { from: newPos, to: newPos + term.length, insert: wikiLink },
      });
    } else {
      // Replace at original position
      const wikiLink = `[[${suggestion.noteTitle}]]`;
      viewRef.current.dispatch({
        changes: { from: position, to: position + term.length, insert: wikiLink },
      });
    }

    acceptSuggestion(term);
  }, [acceptSuggestion]);

  // Handle dismissing a link suggestion
  const handleDismissLinkSuggestion = useCallback((suggestion: LinkSuggestion) => {
    dismissSuggestion(suggestion.term);
  }, [dismissSuggestion]);

  // Debounced save function
  const debouncedSave = useCallback((id: string, content: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      onSave(id, content);
    }, 500);
  }, [onSave]);

  // Create editor when note changes
  useEffect(() => {
    if (!editorRef.current || !note) return;

    // If switching notes, destroy old editor
    if (viewRef.current && noteIdRef.current !== note.id) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    noteIdRef.current = note.id;

    // If editor exists for this note, just update content if needed
    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== note.content) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentContent.length, insert: note.content }
        });
      }
      return;
    }

    // Create new editor
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        updateStats(content);
        if (note) {
          debouncedSave(note.id, content);
        }

        // Update wiki links when content changes
        const links = parseWikiLinks(content);
        update.view.dispatch({
          effects: setWikiLinksEffect.of({ links, allNotes })
        });
      }

      // Handle selection changes
      if (update.selectionSet && onSelectionChange) {
        const selection = update.state.selection.main;
        if (selection.from !== selection.to) {
          const text = update.state.doc.sliceString(selection.from, selection.to);
          onSelectionChange({ from: selection.from, to: selection.to, text });
        } else {
          onSelectionChange(null);
        }
      }
    });

    const state = EditorState.create({
      doc: note.content,
      extensions: [
        // Core features
        lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),

        // Keymaps
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),

        // Markdown language
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(defaultHighlightStyle),

        // Theme
        themeCompartment.of(darkMode ? patchPadDarkTheme : patchPadTheme),

        // Highlights
        highlightsField,

        // Wiki links
        wikiLinksField,

        // Event handlers for wiki links (click and hover)
        EditorView.domEventHandlers({
          click: (event, view) => {
            const target = event.target as HTMLElement;
            const wikiLinkElement = target.closest('[data-wiki-link]');
            if (wikiLinkElement && onWikiLinkClick) {
              const targetTitle = wikiLinkElement.getAttribute('data-wiki-link');
              if (targetTitle) {
                event.preventDefault();
                setHoveredLink(null); // Close preview on click
                onWikiLinkClick(targetTitle);
                return true;
              }
            }
            return false;
          },
          mouseover: (event, view) => {
            const target = event.target as HTMLElement;
            const wikiLinkElement = target.closest('[data-wiki-link]') as HTMLElement;
            if (wikiLinkElement) {
              const targetTitle = wikiLinkElement.getAttribute('data-wiki-link');
              if (targetTitle) {
                // Delay showing preview
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                }
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredLink({ title: targetTitle, element: wikiLinkElement });
                }, 400);
              }
            }
            return false;
          },
          mouseout: (event, view) => {
            const target = event.target as HTMLElement;
            const relatedTarget = event.relatedTarget as HTMLElement;

            // Don't close if moving to the preview card
            if (relatedTarget?.closest('.link-preview-card')) {
              return false;
            }

            const wikiLinkElement = target.closest('[data-wiki-link]');
            if (wikiLinkElement) {
              if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
              }
              // Delay hiding to allow moving to preview card
              hoverTimeoutRef.current = setTimeout(() => {
                setHoveredLink(null);
              }, 300);
            }
            return false;
          },
        }),

        // Placeholder
        EditorView.contentAttributes.of({ 'aria-label': 'Note editor' }),

        // Update listener
        updateListener,
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    // Apply initial highlights
    if (note.highlights && note.highlights.length > 0) {
      viewRef.current.dispatch({
        effects: setHighlightsEffect.of(note.highlights)
      });
    }

    // Apply initial wiki links
    const initialLinks = parseWikiLinks(note.content);
    if (initialLinks.length > 0) {
      viewRef.current.dispatch({
        effects: setWikiLinksEffect.of({ links: initialLinks, allNotes })
      });
    }

    updateStats(note.content);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [note?.id]);

  // Update theme when darkMode changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: themeCompartment.reconfigure(darkMode ? patchPadDarkTheme : patchPadTheme)
      });
    }
  }, [darkMode]);

  // Update line numbers when toggled
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: lineNumbersCompartment.reconfigure(showLineNumbers ? lineNumbers() : [])
      });
    }
  }, [showLineNumbers]);

  // Update highlights when note highlights change
  useEffect(() => {
    if (viewRef.current && note?.highlights) {
      viewRef.current.dispatch({
        effects: setHighlightsEffect.of(note.highlights)
      });
    }
  }, [note?.highlights]);

  // Update wiki links when allNotes changes (to update link validity)
  useEffect(() => {
    if (viewRef.current && note) {
      const content = viewRef.current.state.doc.toString();
      const links = parseWikiLinks(content);
      viewRef.current.dispatch({
        effects: setWikiLinksEffect.of({ links, allNotes })
      });
    }
  }, [allNotes, note?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, []);

  // Focus editor method (for external use)
  const focusEditor = useCallback(() => {
    viewRef.current?.focus();
  }, []);

  // Insert text at cursor
  const insertText = useCallback((text: string) => {
    if (!viewRef.current) return;
    const { from } = viewRef.current.state.selection.main;
    viewRef.current.dispatch({
      changes: { from, insert: text },
      selection: { anchor: from + text.length }
    });
  }, []);

  if (!note) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-lg font-medium">No note selected</p>
          <p className="text-sm mt-1">Select a note or press <kbd className="px-2 py-0.5 bg-gray-200 rounded text-xs font-mono">Ctrl+N</kbd> to create one</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
      {/* Header toolbar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${darkMode ? 'border-gray-700 bg-[#252526]' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center gap-3">
          <h2 className={`text-sm font-medium truncate max-w-[200px] ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            {note.title}
          </h2>
          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {wordCount} words · {charCount} chars
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Focus mode toggle */}
          <button
            onClick={() => setFocusMode(!focusMode)}
            className={`p-1.5 rounded text-xs transition-all ${
              focusMode
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/25'
                : darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Focus mode - dim distractions"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>

          {/* Line numbers toggle */}
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className={`p-1.5 rounded text-xs transition-colors ${
              showLineNumbers
                ? darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                : darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Toggle line numbers"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-1.5 rounded text-xs transition-colors ${
              darkMode
                ? 'bg-yellow-900/50 text-yellow-300 hover:bg-yellow-900/70'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Toggle dark mode"
          >
            {darkMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Share button - only visible when sync is enabled */}
          {isSyncEnabled && onShare && (
            <button
              onClick={onShare}
              className={`p-1.5 rounded text-xs transition-colors ${
                darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="Share note"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          )}

          {/* Preview toggle */}
          <button
            onClick={onTogglePreview}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              showPreview
                ? 'bg-blue-600 text-white'
                : darkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Audio Playback for voice notes */}
      {note.audioId && (
        <div className={`px-4 py-2 border-b ${darkMode ? 'border-gray-700 bg-[#252526]' : 'border-gray-200 bg-gray-50'}`}>
          <AudioPlaybackButton noteId={note.id} />
        </div>
      )}

      {/* Editor area */}
      <div ref={(el) => {
        (editorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (editorContainerRef) {
          (editorContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }
      }} className={`flex-1 overflow-auto relative ${darkMode ? 'graph-paper-dark' : 'graph-paper'} ${focusMode ? 'focus-mode' : ''}`} />

      {/* Link Preview Card */}
      {hoveredLink && onWikiLinkClick && (
        <LinkPreviewCard
          targetTitle={hoveredLink.title}
          allNotes={allNotes}
          anchorElement={hoveredLink.element}
          onNavigate={(title) => {
            setHoveredLink(null);
            onWikiLinkClick(title);
          }}
          onClose={() => setHoveredLink(null)}
        />
      )}

      {/* Link Suggestion Toast */}
      {linkSuggestions.length > 0 && (
        <LinkSuggestionToast
          suggestions={linkSuggestions}
          onAccept={handleAcceptLinkSuggestion}
          onDismiss={handleDismissLinkSuggestion}
        />
      )}
    </div>
  );
}

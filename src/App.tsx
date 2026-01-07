import { useState, useEffect, useRef, useCallback } from 'react';
import { NotesList } from './components/NotesList';
import { Editor } from './components/Editor';
import { MarkdownPreview } from './components/MarkdownPreview';
import { StitchPreview } from './components/StitchPreview';
import { CommandPalette, type Command } from './components/CommandPalette';
import { ToastContainer } from './components/Toast';
import { SelectionToolbar } from './components/SelectionToolbar';
import { AskAIDialog } from './components/AskAIDialog';
import { AskNotesDialog } from './components/AskNotesDialog';
import { AudioRecorder } from './components/AudioRecorder';
import { QuickCaptureButton } from './components/QuickCaptureButton';
import { BrainDashboard } from './components/BrainDashboard';
import { BacklinksPanel } from './components/BacklinksPanel';
import { DailyDigestModal } from './components/DailyDigestModal';
import { ExportDialog } from './components/ExportDialog';
import { CanvasView } from './components/Canvas';
import { useNotes, type SortOption, type NotesFilter } from './hooks/useNotes';
import { saveNoteCanvasPosition, autoLayout } from './services/canvas';
import type { CanvasPosition } from './types/note';
import { useToast } from './hooks/useToast';
import { applyOps } from './utils/applyOps';
import { generateStitch, generatePatch } from './api/patch';
import { isAIAvailable, summarizeTranscription } from './services/ai';
import { isBrainAvailable } from './services/brain';
import { generateDailyDigest, shouldShowDigest, markDigestShown, toggleDigestEnabled, isDigestEnabled, type DailyDigest } from './services/digest';
import { findNoteByTitle } from './utils/linkParser';
import type { Note, HighlightColor } from './types/note';
import type { PatchAction } from './types/patch';
import type { TranscriptionResult } from './services/audio';

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [selection, setSelection] = useState<{ from: number; to: number; text: string } | null>(null);
  const [filter, setFilter] = useState<NotesFilter>({ type: 'all' });
  const [sortBy, setSortBy] = useState<SortOption>('updated');

  // Multi-select / Stitch mode
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stitchLoading, setStitchLoading] = useState(false);
  const [stitchPreview, setStitchPreview] = useState<{
    rationale: string;
    content: string;
  } | null>(null);

  const [editorContent, setEditorContent] = useState('');

  // Loading state for AI actions
  const [aiLoading, setAiLoading] = useState(false);

  // Ask AI dialog state
  const [askAIDialogOpen, setAskAIDialogOpen] = useState(false);

  // Ask Notes dialog state
  const [askNotesDialogOpen, setAskNotesDialogOpen] = useState(false);

  // Audio recorder dialog state
  const [audioRecorderOpen, setAudioRecorderOpen] = useState(false);

  // Brain dashboard state
  const [brainDashboardOpen, setBrainDashboardOpen] = useState(false);

  // Daily digest state
  const [dailyDigest, setDailyDigest] = useState<DailyDigest | null>(null);
  const [digestChecked, setDigestChecked] = useState(false);

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Main view state: 'notes' | 'canvas' | 'graph'
  const [mainView, setMainView] = useState<'notes' | 'canvas' | 'graph'>('notes');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const { toasts, dismissToast, success, error, info, warning } = useToast();

  const {
    notes,
    folders,
    allTags,
    createNote,
    updateNote,
    deleteNote,
    getNote,
    toggleFavorite,
    addHighlight,
    toggleNoteCollapsed,
    setNotesParent,
  } = useNotes(searchQuery, filter, sortBy);

  // Check and show daily digest on mount
  useEffect(() => {
    if (!digestChecked && notes.length > 0) {
      setDigestChecked(true);
      if (shouldShowDigest()) {
        const digest = generateDailyDigest(notes);
        setDailyDigest(digest);
      }
    }
  }, [notes, digestChecked]);

  // Handle closing the daily digest
  const handleCloseDigest = useCallback(() => {
    markDigestShown();
    setDailyDigest(null);
  }, []);

  // Toggle daily digest setting
  const handleToggleDigest = useCallback(() => {
    const newValue = toggleDigestEnabled();
    if (newValue) {
      success('Daily Digest enabled', 'You\'ll see your summary each day');
    } else {
      info('Daily Digest disabled', 'You won\'t see daily summaries');
    }
  }, [success, info]);

  // Load note content when selected
  useEffect(() => {
    if (selectedId) {
      getNote(selectedId).then((note) => {
        setCurrentNote(note ?? null);
        setEditorContent(note?.content ?? '');
      });
    } else {
      setCurrentNote(null);
      setEditorContent('');
    }
  }, [selectedId, getNote]);

  // Keep current note in sync with notes list updates
  useEffect(() => {
    if (selectedId && notes.length > 0) {
      const updatedNote = notes.find((n) => n.id === selectedId);
      if (updatedNote) {
        setCurrentNote(updatedNote);
      }
    }
  }, [notes, selectedId]);

  // Clear selection if selected note is deleted
  useEffect(() => {
    if (selectedId && notes.length > 0) {
      const exists = notes.some((n) => n.id === selectedId);
      if (!exists) {
        setSelectedId(notes[0]?.id ?? null);
      }
    }
  }, [notes, selectedId]);

  const handleNewNote = useCallback(async () => {
    const id = await createNote();
    setSelectedId(id);
    setSearchQuery('');
    setMultiSelectMode(false);
    setSelectedIds(new Set());
    success('Note created', 'Start typing to edit your new note');
  }, [createNote, success]);

  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote(id);
      if (selectedId === id) {
        const remaining = notes.filter((n) => n.id !== id);
        setSelectedId(remaining[0]?.id ?? null);
      }
      success('Note deleted');
    },
    [deleteNote, notes, selectedId, success]
  );

  const handleSave = useCallback(
    async (id: string, content: string) => {
      await updateNote(id, content);
      setEditorContent(content);
    },
    [updateNote]
  );

  // AI Action handler
  const handleAIAction = useCallback(
    async (action: PatchAction, customPrompt?: string, targetLanguage?: string) => {
      if (!currentNote) {
        warning('No note selected', 'Please select a note first');
        return;
      }

      setAiLoading(true);
      info('Processing...', `Running ${action.replace('-', ' ')}`);

      try {
        const result = await generatePatch({
          noteId: currentNote.id,
          content: editorContent,
          action,
          selection: selection ?? undefined,
          customPrompt,
          targetLanguage,
        });

        if (result.ops.length === 0) {
          warning('No changes', result.rationale);
        } else {
          const newContent = applyOps(editorContent, result.ops);
          await updateNote(currentNote.id, newContent);
          setEditorContent(newContent);
          success('Done!', result.rationale);
        }
      } catch (err) {
        error('Action failed', err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setAiLoading(false);
      }
    },
    [currentNote, editorContent, selection, updateNote, info, success, warning, error]
  );

  // Multi-select handlers
  const handleToggleMultiSelect = useCallback(() => {
    setMultiSelectMode((prev) => !prev);
    setSelectedIds(new Set());
    setStitchPreview(null);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleStitch = useCallback(async () => {
    if (selectedIds.size < 2) return;

    const selectedNotes = notes.filter((n) => selectedIds.has(n.id));
    setStitchLoading(true);

    try {
      const result = await generateStitch({ notes: selectedNotes });
      setStitchPreview(result);
    } catch (err) {
      error('Stitch failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setStitchLoading(false);
    }
  }, [notes, selectedIds, error]);

  const handleApplyStitch = useCallback(async () => {
    if (!stitchPreview) return;

    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const title = `Compiled - ${dateStr}`;

    // Create the new compiled note
    const id = await createNote(stitchPreview.content, title);

    // Set the original notes as children of the compiled note
    const originalNoteIds = Array.from(selectedIds);
    await setNotesParent(originalNoteIds, id);

    setSelectedId(id);
    setMultiSelectMode(false);
    setSelectedIds(new Set());
    setStitchPreview(null);
    setSearchQuery('');
    success('Document created', `Your compiled document is ready with ${originalNoteIds.length} source notes`);
  }, [stitchPreview, createNote, selectedIds, setNotesParent, success]);

  const handleRejectStitch = useCallback(() => {
    setStitchPreview(null);
  }, []);

  const handleSelectionChange = useCallback((sel: { from: number; to: number; text: string } | null) => {
    setSelection(sel);
  }, []);

  // Handle selection toolbar action
  const handleSelectionAction = useCallback((action: string) => {
    if (action === 'ask-ai') {
      setAskAIDialogOpen(true);
    } else {
      handleAIAction(action as PatchAction);
    }
  }, [handleAIAction]);

  // Handle Ask AI dialog submission
  const handleAskAISubmit = useCallback((prompt: string) => {
    handleAIAction('ask-ai', prompt);
  }, [handleAIAction]);

  // Handle highlight with optional annotation
  const handleHighlight = useCallback(async (color: HighlightColor, annotation?: string) => {
    if (!currentNote || !selection) return;

    await addHighlight(currentNote.id, selection.from, selection.to, color, annotation);
    success('Highlighted', annotation ? `Added ${color} highlight with note` : `Added ${color} highlight`);
    setSelection(null);
  }, [currentNote, selection, addHighlight, success]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    await toggleFavorite(id);
  }, [toggleFavorite]);

  const handleToggleCollapsed = useCallback(async (id: string) => {
    await toggleNoteCollapsed(id);
  }, [toggleNoteCollapsed]);

  // Handle wiki link click - navigate to linked note or create it
  const handleWikiLinkClick = useCallback(async (targetTitle: string) => {
    const matchedNote = findNoteByTitle(targetTitle, notes);

    if (matchedNote) {
      // Navigate to existing note
      setSelectedId(matchedNote.id);
      info('Navigated', `Opened "${matchedNote.title}"`);
    } else {
      // Create new note with the linked title
      const id = await createNote('', targetTitle);
      setSelectedId(id);
      success('Note created', `Created "${targetTitle}" from link`);
    }
  }, [notes, createNote, info, success]);

  // Handle audio transcription completion
  const handleTranscriptionComplete = useCallback(async (result: TranscriptionResult & { summary?: string }) => {
    setAudioRecorderOpen(false);

    // Try to summarize the transcription if AI is available
    let noteContent = result.text;
    if (isAIAvailable()) {
      info('Summarizing...', 'Creating structured notes from your recording');
      const summary = await summarizeTranscription(result.text);
      if (summary) {
        noteContent = summary;
      }
    }

    // Create a new note with the transcription
    const title = `Voice Note - ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const id = await createNote(noteContent, title);
    setSelectedId(id);
    success('Voice note created', `${Math.round(result.duration)}s of audio transcribed`);
  }, [createNote, info, success]);

  // Handle quick capture from floating button
  const handleQuickCapture = useCallback(async (result: TranscriptionResult) => {
    info('Processing...', 'Creating note from voice capture');

    // Try to summarize the transcription if AI is available
    let noteContent = result.text;
    if (isAIAvailable()) {
      const summary = await summarizeTranscription(result.text);
      if (summary) {
        noteContent = summary;
      }
    }

    // Create a new note with the transcription
    const title = `Voice Note - ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const id = await createNote(noteContent, title);
    setSelectedId(id);
    setMainView('notes'); // Switch to notes view to see the new note
    success('Voice note created', `${Math.round(result.duration)}s of audio transcribed`);
  }, [createNote, info, success]);

  const handleQuickCaptureError = useCallback((errorMessage: string) => {
    error('Voice capture failed', errorMessage);
  }, [error]);

  // Canvas handlers
  const handleCanvasNoteClick = useCallback((id: string) => {
    setSelectedId(id);
    setMainView('notes'); // Switch to notes view to edit
  }, []);

  const handleCanvasCreateConnection = useCallback(async (fromId: string, toId: string) => {
    // Create a wiki link from the source note to the target note
    const fromNote = notes.find(n => n.id === fromId);
    const toNote = notes.find(n => n.id === toId);
    if (!fromNote || !toNote) return;

    // Add wiki link to the end of the source note
    const newContent = fromNote.content + `\n\n[[${toNote.title}]]`;
    await updateNote(fromId, newContent);
    success('Connection created', `Linked "${fromNote.title}" to "${toNote.title}"`);
  }, [notes, updateNote, success]);

  const handleCanvasPositionChange = useCallback(async (noteId: string, position: CanvasPosition) => {
    await saveNoteCanvasPosition(noteId, position);
  }, []);

  const handleCanvasAddNote = useCallback(async () => {
    const id = await createNote();
    setSelectedId(id);
    setMainView('notes'); // Switch to notes view to edit the new note
    success('Note created', 'Start typing to edit your new note');
  }, [createNote, success]);

  const handleCanvasAutoLayout = useCallback(async (algorithm: 'grid' | 'force') => {
    const positions = autoLayout(notes, algorithm);

    // Save all positions
    for (const [noteId, position] of positions) {
      await saveNoteCanvasPosition(noteId, position);
    }

    // Trigger re-render by updating any note (or we can use a state refresh)
    // For now, just show a success message - positions are saved and will load on next render
    success('Layout applied', `${algorithm === 'grid' ? 'Grid' : 'Force-directed'} layout applied to ${notes.length} notes`);

    // Force refresh of notes to pick up new positions
    // The canvas will re-read from notes on next render
  }, [notes, success]);

  // Build command list
  const commands: Command[] = [
    // Note commands
    {
      id: 'new-note',
      name: 'New Note',
      description: 'Create a new note',
      shortcut: 'Ctrl+N',
      category: 'note',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      action: handleNewNote,
    },
    {
      id: 'delete-note',
      name: 'Delete Note',
      description: 'Delete the current note',
      category: 'note',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
      action: () => currentNote && handleDeleteNote(currentNote.id),
      disabled: !currentNote,
    },
    {
      id: 'toggle-favorite',
      name: currentNote?.favorite ? 'Remove from Favorites' : 'Add to Favorites',
      description: 'Toggle favorite status',
      category: 'note',
      icon: <svg className="w-4 h-4" fill={currentNote?.favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
      action: () => currentNote && handleToggleFavorite(currentNote.id),
      disabled: !currentNote,
    },
    {
      id: 'search',
      name: 'Search Notes',
      description: 'Focus the search input',
      shortcut: 'Ctrl+F',
      category: 'navigate',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
      action: () => searchInputRef.current?.focus(),
    },

    // View commands
    {
      id: 'toggle-preview',
      name: showPreview ? 'Hide Preview' : 'Show Preview',
      description: 'Toggle markdown preview',
      category: 'view',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
      action: () => setShowPreview(!showPreview),
    },
    {
      id: 'toggle-multi-select',
      name: multiSelectMode ? 'Exit Multi-Select' : 'Multi-Select Mode',
      description: 'Select multiple notes to combine',
      category: 'view',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
      action: handleToggleMultiSelect,
    },
    {
      id: 'show-favorites',
      name: 'Show Favorites',
      description: 'Filter to show only favorites',
      category: 'view',
      icon: <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
      action: () => setFilter({ type: 'favorites' }),
    },
    {
      id: 'show-all',
      name: 'Show All Notes',
      description: 'Clear filters',
      category: 'view',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
      action: () => setFilter({ type: 'all' }),
    },
    {
      id: 'view-notes',
      name: 'Notes View',
      description: 'Show notes list and editor',
      category: 'view',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      action: () => setMainView('notes'),
    },
    {
      id: 'view-canvas',
      name: 'Canvas View',
      description: 'Show notes as draggable cards on canvas',
      category: 'view',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
      action: () => setMainView('canvas'),
    },
    {
      id: 'view-graph',
      name: 'Knowledge Graph',
      description: 'Show knowledge graph visualization',
      category: 'view',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      action: () => setBrainDashboardOpen(true),
    },

    // AI commands - basic
    {
      id: 'ai-summarize',
      name: 'Summarize',
      description: 'Generate a summary of the note',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      action: () => handleAIAction('summarize'),
      disabled: !currentNote,
    },
    {
      id: 'ai-extract-tasks',
      name: 'Extract Tasks',
      description: 'Find and list action items',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
      action: () => handleAIAction('extract-tasks'),
      disabled: !currentNote,
    },
    {
      id: 'ai-rewrite',
      name: 'Improve Writing',
      description: 'Enhance formatting and clarity',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
      action: () => handleAIAction('rewrite'),
      disabled: !currentNote,
    },
    {
      id: 'ai-title-tags',
      name: 'Add Title & Tags',
      description: 'Generate title and tags',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
      action: () => handleAIAction('title-tags'),
      disabled: !currentNote,
    },

    // AI commands - advanced (require AI)
    {
      id: 'ai-continue',
      name: 'Continue Writing',
      description: 'AI continues from where you left off',
      shortcut: 'Ctrl+J',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>,
      action: () => handleAIAction('continue'),
      disabled: !currentNote || !isAIAvailable(),
    },
    {
      id: 'ai-expand',
      name: 'Expand Content',
      description: 'Add more detail and explanation',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>,
      action: () => handleAIAction('expand'),
      disabled: !currentNote || !isAIAvailable(),
    },
    {
      id: 'ai-simplify',
      name: 'Simplify',
      description: 'Make text easier to understand',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      action: () => handleAIAction('simplify'),
      disabled: !currentNote || !isAIAvailable(),
    },
    {
      id: 'ai-fix-grammar',
      name: 'Fix Grammar',
      description: 'Correct spelling and grammar',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      action: () => handleAIAction('fix-grammar'),
      disabled: !currentNote,
    },
    {
      id: 'ai-explain',
      name: 'Explain Selection',
      description: 'Get an explanation of selected text',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      action: () => handleAIAction('explain'),
      disabled: !currentNote || !selection || !isAIAvailable(),
    },

    // Ask AI custom prompt
    {
      id: 'ai-ask',
      name: 'Ask AI',
      description: 'Ask a custom question about your note',
      shortcut: 'Ctrl+Shift+A',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
      action: () => setAskAIDialogOpen(true),
      disabled: !currentNote || !isAIAvailable(),
    },

    // Ask Notes - search across all notes
    {
      id: 'ask-notes',
      name: 'Ask Your Notes',
      description: 'Search and ask questions across all notes',
      shortcut: 'Ctrl+Shift+N',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      action: () => setAskNotesDialogOpen(true),
      disabled: notes.length === 0 || !isAIAvailable(),
    },

    // Smart outline
    {
      id: 'ai-outline',
      name: 'Create Outline',
      description: 'Reorganize content into structured outline',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
      action: () => handleAIAction('outline'),
      disabled: !currentNote || !isAIAvailable(),
    },

    // Translation
    {
      id: 'ai-translate-spanish',
      name: 'Translate to Spanish',
      description: 'Translate note to Spanish',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>,
      action: () => handleAIAction('translate', undefined, 'Spanish'),
      disabled: !currentNote || !isAIAvailable(),
    },
    {
      id: 'ai-translate-french',
      name: 'Translate to French',
      description: 'Translate note to French',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>,
      action: () => handleAIAction('translate', undefined, 'French'),
      disabled: !currentNote || !isAIAvailable(),
    },
    {
      id: 'ai-translate-german',
      name: 'Translate to German',
      description: 'Translate note to German',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>,
      action: () => handleAIAction('translate', undefined, 'German'),
      disabled: !currentNote || !isAIAvailable(),
    },

    // Voice recording
    {
      id: 'voice-recording',
      name: 'Voice Recording',
      description: 'Record audio and transcribe to note',
      shortcut: 'Ctrl+Shift+R',
      category: 'note',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
      action: () => setAudioRecorderOpen(true),
    },

    // Knowledge Brain
    {
      id: 'knowledge-brain',
      name: 'Knowledge Brain',
      description: 'Visualize concepts and connections across notes',
      shortcut: 'Ctrl+Shift+B',
      category: 'ai',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      action: () => setBrainDashboardOpen(true),
      disabled: notes.length === 0 || !isBrainAvailable(),
    },

    // Daily Digest toggle
    {
      id: 'toggle-digest',
      name: isDigestEnabled() ? 'Disable Daily Digest' : 'Enable Daily Digest',
      description: 'Toggle the daily activity summary',
      category: 'view',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      action: handleToggleDigest,
    },

    // Export notes
    {
      id: 'export-notes',
      name: 'Export Notes',
      description: 'Export notes as a ZIP file with markdown',
      shortcut: 'Ctrl+Shift+E',
      category: 'note',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
      action: () => setExportDialogOpen(true),
      disabled: notes.length === 0,
    },
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Command palette
      if (isMod && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (isMod && e.key === 'n') {
        e.preventDefault();
        handleNewNote();
      }

      if (isMod && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      // Escape to exit modes
      if (e.key === 'Escape') {
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (multiSelectMode) {
          setMultiSelectMode(false);
          setSelectedIds(new Set());
          setStitchPreview(null);
        }
      }

      // AI shortcuts
      if (isMod && e.key === 'j' && currentNote) {
        e.preventDefault();
        handleAIAction('continue');
      }

      // Ask AI shortcut (Ctrl+Shift+A)
      if (isMod && e.shiftKey && e.key === 'A' && currentNote && isAIAvailable()) {
        e.preventDefault();
        setAskAIDialogOpen(true);
      }

      // Ask Notes shortcut (Ctrl+Shift+N)
      if (isMod && e.shiftKey && e.key === 'N' && notes.length > 0 && isAIAvailable()) {
        e.preventDefault();
        setAskNotesDialogOpen(true);
      }

      // Voice recording shortcut (Ctrl+Shift+R)
      if (isMod && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setAudioRecorderOpen(true);
      }

      // Knowledge Brain shortcut (Ctrl+Shift+B)
      if (isMod && e.shiftKey && e.key === 'B' && notes.length > 0) {
        e.preventDefault();
        setBrainDashboardOpen(true);
      }

      // Export shortcut (Ctrl+Shift+E)
      if (isMod && e.shiftKey && e.key === 'E' && notes.length > 0) {
        e.preventDefault();
        setExportDialogOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewNote, multiSelectMode, commandPaletteOpen, currentNote, handleAIAction, notes.length]);

  return (
    <div className="h-full flex bg-gray-100">
      {/* Notes Sidebar */}
      <div className="w-64 flex-shrink-0">
        <NotesList
          ref={searchInputRef}
          notes={notes}
          folders={folders}
          allTags={allTags}
          selectedId={selectedId}
          selectedIds={selectedIds}
          multiSelectMode={multiSelectMode}
          searchQuery={searchQuery}
          filter={filter}
          sortBy={sortBy}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilter}
          onSortChange={setSortBy}
          onSelect={setSelectedId}
          onToggleSelect={handleToggleSelect}
          onDelete={handleDeleteNote}
          onNew={handleNewNote}
          onToggleMultiSelect={handleToggleMultiSelect}
          onStitch={handleStitch}
          onToggleFavorite={handleToggleFavorite}
          onToggleCollapsed={handleToggleCollapsed}
          stitchLoading={stitchLoading}
        />
      </div>

      {/* Main Content Area with Tab Bar */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Tab Bar */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white">
          <div className="flex gap-1 px-4 pt-2">
            <button
              onClick={() => setMainView('notes')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                mainView === 'notes'
                  ? 'bg-gray-100 text-gray-900 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Notes
              </span>
            </button>
            <button
              onClick={() => setMainView('canvas')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                mainView === 'canvas'
                  ? 'bg-gray-100 text-gray-900 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Canvas
              </span>
            </button>
            <button
              onClick={() => setBrainDashboardOpen(true)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                mainView === 'graph'
                  ? 'bg-gray-100 text-gray-900 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Graph
              </span>
            </button>
          </div>
        </div>

        {/* Content based on selected view */}
        <div className="flex-1 min-h-0">
          {mainView === 'canvas' ? (
            <CanvasView
              notes={notes}
              onNoteClick={handleCanvasNoteClick}
              onCreateConnection={handleCanvasCreateConnection}
              onPositionChange={handleCanvasPositionChange}
              onAddNote={handleCanvasAddNote}
              onAutoLayout={handleCanvasAutoLayout}
              selectedNoteIds={currentNote ? [currentNote.id] : Array.from(selectedIds)}
            />
          ) : stitchPreview ? (
            <StitchPreview
              rationale={stitchPreview.rationale}
              content={stitchPreview.content}
              onApply={handleApplyStitch}
              onReject={handleRejectStitch}
            />
          ) : (
            <div className="relative h-full flex flex-col">
              <div className="flex-1 min-h-0 relative">
                <Editor
                  note={currentNote}
                  onSave={handleSave}
                  showPreview={showPreview}
                  onTogglePreview={() => setShowPreview(!showPreview)}
                  onSelectionChange={handleSelectionChange}
                  onWikiLinkClick={handleWikiLinkClick}
                  allNotes={notes}
                  editorContainerRef={editorContainerRef}
                />
                <SelectionToolbar
                  selection={selection}
                  editorElement={editorContainerRef.current}
                  onAction={handleSelectionAction}
                  onHighlight={handleHighlight}
                  isAIAvailable={isAIAvailable()}
                />
              </div>
              <BacklinksPanel
                note={currentNote}
                allNotes={notes}
                onNavigate={(noteId) => setSelectedId(noteId)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Markdown Preview - only show in notes view */}
      {showPreview && !stitchPreview && mainView === 'notes' && (
        <div className="w-1/3 border-l border-gray-200">
          <MarkdownPreview content={currentNote?.content ?? ''} />
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Ask AI Dialog */}
      <AskAIDialog
        isOpen={askAIDialogOpen}
        onClose={() => setAskAIDialogOpen(false)}
        onSubmit={handleAskAISubmit}
        selection={selection?.text}
      />

      {/* Ask Notes Dialog */}
      <AskNotesDialog
        isOpen={askNotesDialogOpen}
        onClose={() => setAskNotesDialogOpen(false)}
        notes={notes}
        onSelectNote={(id) => {
          setSelectedId(id);
          setAskNotesDialogOpen(false);
        }}
      />

      {/* Audio Recorder */}
      {audioRecorderOpen && (
        <AudioRecorder
          onTranscriptionComplete={handleTranscriptionComplete}
          onClose={() => setAudioRecorderOpen(false)}
        />
      )}

      {/* Brain Dashboard */}
      {brainDashboardOpen && (
        <BrainDashboard
          notes={notes}
          onSelectNote={(id) => {
            setSelectedId(id);
            setBrainDashboardOpen(false);
          }}
          onClose={() => setBrainDashboardOpen(false)}
        />
      )}

      {/* Daily Digest Modal */}
      {dailyDigest && (
        <DailyDigestModal
          digest={dailyDigest}
          onClose={handleCloseDigest}
          onNavigateToNote={(id) => {
            setSelectedId(id);
            handleCloseDigest();
          }}
        />
      )}

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportDialogOpen}
        notes={notes}
        selectedIds={currentNote ? [currentNote.id] : Array.from(selectedIds)}
        onClose={() => setExportDialogOpen(false)}
      />

      {/* Loading overlay for AI actions - Glass morphism with glow */}
      {aiLoading && (
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-40">
          <div className="glass-card rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-4 ai-glow animate-spring-in">
            {/* Animated gradient orb */}
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full animated-gradient opacity-80" />
              <div className="absolute inset-2 rounded-full bg-white/90 flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold gradient-text">AI is thinking...</p>
              <p className="text-xs text-gray-500 mt-1">Analyzing your content</p>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard hint */}
      <div className="fixed bottom-4 left-4 text-xs text-gray-400">
        Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Ctrl+K</kbd> to open command palette
      </div>

      {/* Quick Capture FAB */}
      <QuickCaptureButton
        onCapture={handleQuickCapture}
        onError={handleQuickCaptureError}
      />
    </div>
  );
}

import { useState } from 'react';
import { PatchCard } from './PatchCard';
import { SuggestionCard } from './SuggestionCard';
import { AIStatusBadge } from './AIStatusBadge';
import { generatePatch } from '../api/patch';
import { usePatchHistory } from '../hooks/usePatchHistory';
import type { Patch, Suggestion } from '../types/patch';

interface PatchesPanelProps {
  noteId: string | null;
  noteContent: string;
  suggestions: Suggestion[];
  onApplyPatch: (patch: Patch) => void;
  onApplySuggestion: (suggestion: Suggestion) => void;
  onDismissSuggestion: (suggestionId: string) => void;
}

type ActionType = Patch['action'];

const primaryActions: { type: ActionType; label: string; icon: string }[] = [
  { type: 'summarize', label: 'Summarize', icon: '📝' },
  { type: 'extract-tasks', label: 'Tasks', icon: '✓' },
  { type: 'rewrite', label: 'Rewrite', icon: '✏️' },
  { type: 'title-tags', label: 'Title + Tags', icon: '#' },
];

const secondaryActions: { type: ActionType; label: string; icon: string }[] = [
  { type: 'continue', label: 'Continue', icon: '→' },
  { type: 'expand', label: 'Expand', icon: '↔' },
  { type: 'simplify', label: 'Simplify', icon: '⚡' },
  { type: 'fix-grammar', label: 'Grammar', icon: '✔' },
];

export function PatchesPanel({
  noteId,
  noteContent,
  suggestions,
  onApplyPatch,
  onApplySuggestion,
  onDismissSuggestion,
}: PatchesPanelProps) {
  const [loading, setLoading] = useState<ActionType | null>(null);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'history'>('suggestions');
  const { patches, addPatch, updatePatchStatus } = usePatchHistory(noteId);

  const handleAction = async (action: ActionType) => {
    if (!noteId || loading) return;

    setLoading(action);
    try {
      const response = await generatePatch({
        noteId,
        content: noteContent,
        action,
      });

      await addPatch(action, response.rationale, response.ops);
      setActiveTab('history');
    } catch (error) {
      console.error('Failed to generate patch:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleApply = async (patch: Patch) => {
    await updatePatchStatus(patch.id, 'applied');
    onApplyPatch(patch);
  };

  const handleReject = async (patch: Patch) => {
    await updatePatchStatus(patch.id, 'rejected');
  };

  const pendingPatches = patches.filter((p) => p.status === 'pending');
  const historyPatches = patches.filter((p) => p.status !== 'pending');

  if (!noteId) {
    return (
      <div className="h-full bg-neutral-50 border-l border-neutral-200 flex items-center justify-center">
        <p className="text-sm text-neutral-400">Select a note to use AI patches</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-neutral-50 border-l border-neutral-200 flex flex-col">
      {/* Header with badge */}
      <div className="p-3 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-700">AI Patches</h2>
          <AIStatusBadge />
        </div>
        {suggestions.length > 0 && (
          <div className="mb-3 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-md">
            <span className="text-xs font-medium text-blue-700 animate-pulse">
              {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} available
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'suggestions'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-gray-200'
            }`}
          >
            Smart
            {suggestions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full">
                {suggestions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-gray-200'
            }`}
          >
            Manual
            {pendingPatches.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-yellow-200 text-yellow-800 rounded-full">
                {pendingPatches.length}
              </span>
            )}
          </button>
        </div>

        {/* Action buttons - only show in history tab */}
        {activeTab === 'history' && (
          <div className="space-y-2">
            {/* Primary actions */}
            <div className="grid grid-cols-2 gap-2">
              {primaryActions.map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => handleAction(type)}
                  disabled={loading !== null}
                  className={`px-2 py-2 text-xs font-medium rounded-md border focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
                    loading === type
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="mr-1">{icon}</span>
                  {loading === type ? '...' : label}
                </button>
              ))}
            </div>

            {/* Secondary actions */}
            <div className="grid grid-cols-4 gap-1">
              {secondaryActions.map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => handleAction(type)}
                  disabled={loading !== null}
                  title={label}
                  className={`p-1.5 text-xs font-medium rounded-md border focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
                    loading === type
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === type ? '...' : icon}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'suggestions' ? (
          suggestions.length === 0 ? (
            <div className="text-center mt-8">
              <div className="text-2xl mb-2">✨</div>
              <p className="text-xs text-neutral-400">
                Keep writing! Suggestions will appear when we detect opportunities to help.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions
                .sort((a, b) => {
                  const priority = { high: 0, medium: 1, low: 2 };
                  return priority[a.priority] - priority[b.priority];
                })
                .map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={() => onApplySuggestion(suggestion)}
                    onDismiss={() => onDismissSuggestion(suggestion.id)}
                  />
                ))}
            </div>
          )
        ) : (
          <>
            {pendingPatches.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-neutral-500 mb-2">Pending</p>
                <div className="space-y-3">
                  {pendingPatches.map((patch) => (
                    <PatchCard
                      key={patch.id}
                      patch={patch}
                      onApply={handleApply}
                      onReject={handleReject}
                    />
                  ))}
                </div>
              </div>
            )}

            {historyPatches.length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-2">History</p>
                <div className="space-y-3">
                  {historyPatches.map((patch) => (
                    <PatchCard
                      key={patch.id}
                      patch={patch}
                      onApply={handleApply}
                      onReject={handleReject}
                    />
                  ))}
                </div>
              </div>
            )}

            {patches.length === 0 && (
              <p className="text-xs text-neutral-400 text-center mt-4">
                Use the buttons above to generate patches manually.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

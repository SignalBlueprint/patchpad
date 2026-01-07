/**
 * AI Knowledge Dashboard
 *
 * Shows what the AI "knows" about the user's notes - extracted facts,
 * topics, and allows editing/removing incorrect information.
 */

import { useState, useEffect } from 'react';
import type { Note } from '../../types/note';
import {
  type AIKnowledge,
  type KeyFact,
  getStoredKnowledge,
  buildAIKnowledge,
  removeKnowledgeFact,
  updateKnowledgeFact,
  isResearchPartnerAvailable,
} from '../../services/researchPartner';

interface AIKnowledgeDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (id: string) => void;
}

export function AIKnowledgeDashboard({ isOpen, onClose, notes, onSelectNote }: AIKnowledgeDashboardProps) {
  const [knowledge, setKnowledge] = useState<AIKnowledge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingFact, setEditingFact] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const isAvailable = isResearchPartnerAvailable();

  useEffect(() => {
    if (isOpen) {
      // Load stored knowledge
      const stored = getStoredKnowledge();
      setKnowledge(stored);
    }
  }, [isOpen]);

  const handleRefresh = async () => {
    if (!isAvailable) return;

    setLoading(true);
    setError(null);

    try {
      const newKnowledge = await buildAIKnowledge(notes);
      setKnowledge(newKnowledge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build knowledge');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFact = (factId: string) => {
    removeKnowledgeFact(factId);
    setKnowledge(prev => prev ? {
      ...prev,
      facts: prev.facts.filter(f => f.id !== factId),
    } : null);
  };

  const handleEditFact = (fact: KeyFact) => {
    setEditingFact(fact.id);
    setEditValue(fact.fact);
  };

  const handleSaveEdit = () => {
    if (editingFact && editValue.trim()) {
      updateKnowledgeFact(editingFact, editValue.trim());
      setKnowledge(prev => prev ? {
        ...prev,
        facts: prev.facts.map(f =>
          f.id === editingFact ? { ...f, fact: editValue.trim() } : f
        ),
      } : null);
    }
    setEditingFact(null);
    setEditValue('');
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'person':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'project':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        );
      case 'date':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'decision':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'theme':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'person': return 'text-blue-600 bg-blue-50';
      case 'project': return 'text-purple-600 bg-purple-50';
      case 'date': return 'text-orange-600 bg-orange-50';
      case 'decision': return 'text-green-600 bg-green-50';
      case 'theme': return 'text-indigo-600 bg-indigo-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const categories = knowledge?.facts
    ? [...new Set(knowledge.facts.map(f => f.category))]
    : [];

  const filteredFacts = knowledge?.facts.filter(f =>
    !selectedCategory || f.category === selectedCategory
  ) || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">AI Knowledge</h2>
                <p className="text-sm text-gray-500">
                  {knowledge ? `${knowledge.facts.length} facts extracted from ${notes.length} notes` : 'What the AI knows about your notes'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading || !isAvailable}
                className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Not available warning */}
        {!isAvailable && (
          <div className="mx-6 mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">OpenAI API key required</span>
            </div>
            <p className="mt-1 text-sm text-yellow-600">
              Add your OpenAI API key in settings to use AI Knowledge.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!knowledge ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No knowledge extracted yet</h3>
              <p className="text-sm text-gray-500 mb-4">
                Click "Refresh" to analyze your notes and extract key facts.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Topics overview */}
              {knowledge.topics.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Topics in your notes</h3>
                  <div className="flex flex-wrap gap-2">
                    {knowledge.topics.map(topic => (
                      <span
                        key={topic.name}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-full flex items-center gap-1.5"
                      >
                        {topic.name}
                        <span className="text-xs text-gray-500">({topic.noteCount})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Category filter */}
              {categories.length > 1 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Filter by category</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        !selectedCategory
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All ({knowledge.facts.length})
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                          selectedCategory === cat
                            ? getCategoryColor(cat)
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {getCategoryIcon(cat)}
                        {cat} ({knowledge.facts.filter(f => f.category === cat).length})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Facts list */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Key facts {selectedCategory && `(${selectedCategory})`}
                </h3>
                <div className="space-y-2">
                  {filteredFacts.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No facts in this category</p>
                  ) : (
                    filteredFacts.map(fact => (
                      <div
                        key={fact.id}
                        className="group p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {editingFact === fact.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                            <button
                              onClick={handleSaveEdit}
                              className="px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingFact(null)}
                              className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded ${getCategoryColor(fact.category)}`}>
                              {getCategoryIcon(fact.category)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900">{fact.fact}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">
                                  Confidence: {Math.round(fact.confidence * 100)}%
                                </span>
                                {fact.sourceNoteIds.length > 0 && (
                                  <span className="text-xs text-gray-500">
                                    • {fact.sourceNoteIds.length} source{fact.sourceNoteIds.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditFact(fact)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                                title="Edit fact"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleRemoveFact(fact.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                                title="Remove fact"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Last updated */}
              <div className="pt-4 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500">
                  Last updated: {knowledge.lastUpdated.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

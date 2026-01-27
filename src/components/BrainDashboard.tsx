import { useState, useEffect, useCallback } from 'react';
import { KnowledgeGraph } from './KnowledgeGraph';
import { PublishGraphDialog } from './PublishGraphDialog';
import {
  buildKnowledgeGraph,
  generateInsights,
  isBrainAvailable,
  type KnowledgeGraph as KnowledgeGraphType,
  type BrainInsight,
  type Concept,
} from '../services/brain';
import type { Note } from '../types/note';

interface BrainDashboardProps {
  notes: Note[];
  onSelectNote: (noteId: string) => void;
  onClose: () => void;
}

type Tab = 'graph' | 'insights' | 'concepts';

const INSIGHT_ICONS = {
  pattern: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  gap: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  connection: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  trend: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

const PRIORITY_COLORS = {
  high: 'bg-error-100 text-error-700 border-error-100',
  medium: 'bg-warning-100 text-warning-700 border-warning-100',
  low: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

export function BrainDashboard({ notes, onSelectNote, onClose }: BrainDashboardProps) {
  const [tab, setTab] = useState<Tab>('graph');
  const [graph, setGraph] = useState<KnowledgeGraphType | null>(null);
  const [insights, setInsights] = useState<BrainInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [conceptFilter, setConceptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  // Build knowledge graph on mount
  useEffect(() => {
    async function build() {
      if (notes.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const knowledgeGraph = await buildKnowledgeGraph(notes);
        setGraph(knowledgeGraph);

        const brainInsights = await generateInsights(knowledgeGraph, notes);
        setInsights(brainInsights);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to build knowledge graph');
      } finally {
        setLoading(false);
      }
    }

    build();
  }, [notes]);

  const handleConceptClick = useCallback((concept: Concept) => {
    setSelectedConcept(concept);
    setTab('concepts');
  }, []);

  const filteredConcepts = graph?.concepts.filter(c => {
    const matchesText = c.name.toLowerCase().includes(conceptFilter.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesText && matchesType;
  }) || [];

  const conceptTypes = [...new Set(graph?.concepts.map(c => c.type) || [])];

  if (!isBrainAvailable()) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
          <div className="text-center py-8">
            <svg className="w-16 h-16 mx-auto text-accent-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">AI Required</h3>
            <p className="text-neutral-600 mb-6">
              The Knowledge Brain requires an AI provider to extract concepts and generate insights.
              Please configure an OpenAI or Anthropic API key in settings.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Knowledge Brain</h2>
              <p className="text-sm text-neutral-500">
                {graph ? `${graph.concepts.length} concepts from ${notes.length} notes` : 'Building...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Publish Graph button */}
            <button
              onClick={() => setPublishDialogOpen(true)}
              disabled={!graph || graph.concepts.length === 0}
              className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="Export graph as HTML file"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Publish
            </button>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2 border-b border-neutral-200 flex gap-1">
          {[
            { id: 'graph', label: 'Knowledge Graph', count: undefined },
            { id: 'insights', label: 'Insights', count: insights.length },
            { id: 'concepts', label: 'Concepts', count: graph?.concepts.length },
          ].map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                tab === id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {label}
              {count !== undefined && (
                <span className="text-xs bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto text-primary-500 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-neutral-600">Building knowledge graph...</p>
                <p className="text-sm text-neutral-400 mt-1">Analyzing {notes.length} notes</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-error-600">
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>{error}</p>
              </div>
            </div>
          ) : tab === 'graph' && graph ? (
            <KnowledgeGraph
              graph={graph}
              onConceptClick={handleConceptClick}
              onNoteClick={onSelectNote}
              selectedConceptId={selectedConcept?.id}
            />
          ) : tab === 'insights' ? (
            <div className="h-full overflow-y-auto p-6">
              {insights.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p>No insights generated yet</p>
                  <p className="text-sm text-neutral-400 mt-1">Add more notes to discover patterns</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {insights.map(insight => (
                    <div
                      key={insight.id}
                      className={`p-4 rounded-lg border ${PRIORITY_COLORS[insight.priority]}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 ${
                          insight.type === 'pattern' ? 'text-primary-500' :
                          insight.type === 'gap' ? 'text-accent-500' :
                          insight.type === 'connection' ? 'text-green-500' :
                          'text-primary-500'
                        }`}>
                          {INSIGHT_ICONS[insight.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-neutral-900">{insight.title}</h4>
                            <span className="text-xs px-1.5 py-0.5 bg-white/50 rounded capitalize">
                              {insight.type}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-700">{insight.description}</p>
                          {insight.relatedNotes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {insight.relatedNotes.slice(0, 3).map(noteId => {
                                const note = notes.find(n => n.id === noteId);
                                return note ? (
                                  <button
                                    key={noteId}
                                    onClick={() => {
                                      onSelectNote(noteId);
                                      onClose();
                                    }}
                                    className="text-xs px-2 py-0.5 bg-white/70 rounded hover:bg-white transition-colors"
                                  >
                                    {note.title}
                                  </button>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : tab === 'concepts' && graph ? (
            <div className="h-full flex">
              {/* Concept list */}
              <div className="w-1/2 border-r border-neutral-200 flex flex-col">
                {/* Filters */}
                <div className="p-3 border-b border-neutral-200 space-y-2">
                  <input
                    type="text"
                    value={conceptFilter}
                    onChange={e => setConceptFilter(e.target.value)}
                    placeholder="Search concepts..."
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => setTypeFilter('all')}
                      className={`text-xs px-2 py-1 rounded-full ${
                        typeFilter === 'all' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      All
                    </button>
                    {conceptTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        className={`text-xs px-2 py-1 rounded-full capitalize ${
                          typeFilter === type ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Concept list */}
                <div className="flex-1 overflow-y-auto">
                  {filteredConcepts.length === 0 ? (
                    <div className="p-6 text-center text-neutral-500 text-sm">
                      No concepts match your filter
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {filteredConcepts
                        .sort((a, b) => b.mentions.length - a.mentions.length)
                        .map(concept => (
                          <li key={concept.id}>
                            <button
                              onClick={() => setSelectedConcept(concept)}
                              className={`w-full px-4 py-3 text-left hover:bg-neutral-50 transition-colors ${
                                selectedConcept?.id === concept.id ? 'bg-primary-50' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-neutral-900">{concept.name}</span>
                                <span className="text-xs text-neutral-400">
                                  {concept.mentions.length}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-neutral-500 capitalize">{concept.type}</span>
                                {concept.relatedConcepts.length > 0 && (
                                  <span className="text-xs text-neutral-400">
                                    {concept.relatedConcepts.length} connections
                                  </span>
                                )}
                              </div>
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Concept detail */}
              <div className="w-1/2 p-6 overflow-y-auto">
                {selectedConcept ? (
                  <div>
                    <h3 className="text-xl font-semibold text-neutral-900 mb-1">
                      {selectedConcept.name}
                    </h3>
                    <p className="text-sm text-neutral-500 capitalize mb-4">{selectedConcept.type}</p>

                    <div className="space-y-4">
                      {/* Mentions */}
                      <div>
                        <h4 className="text-sm font-medium text-neutral-700 mb-2">
                          Mentioned in {selectedConcept.mentions.length} notes
                        </h4>
                        <ul className="space-y-2">
                          {selectedConcept.mentions.map((mention, i) => (
                            <li key={i}>
                              <button
                                onClick={() => {
                                  onSelectNote(mention.noteId);
                                  onClose();
                                }}
                                className="w-full text-left p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                              >
                                <div className="font-medium text-sm text-neutral-900">
                                  {mention.noteTitle}
                                </div>
                                {mention.context && (
                                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                                    ...{mention.context}...
                                  </p>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Related concepts */}
                      {selectedConcept.relatedConcepts.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-neutral-700 mb-2">
                            Related concepts
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedConcept.relatedConcepts.map(relatedId => {
                              const related = graph.concepts.find(c => c.id === relatedId);
                              return related ? (
                                <button
                                  key={relatedId}
                                  onClick={() => setSelectedConcept(related)}
                                  className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm hover:bg-purple-100 transition-colors"
                                >
                                  {related.name}
                                </button>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
                    Select a concept to see details
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Publish Graph Dialog */}
      <PublishGraphDialog
        notes={notes}
        isOpen={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
      />
    </div>
  );
}

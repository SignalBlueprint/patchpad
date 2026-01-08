/**
 * Agent Dashboard Component
 *
 * UI for managing and interacting with knowledge agents.
 * Shows agent status, suggestions, and allows running tasks.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Note } from '../types/note';
import type { Agent, AgentSuggestion, AgentTaskStatus } from '../types/agent';
import {
  getAgents,
  updateAgent,
  getSuggestions,
  applySuggestion,
  dismissSuggestion,
  runAgent,
  getAgentConfig,
} from '../services/agentFramework';

interface AgentDashboardProps {
  notes: Note[];
  onCreateNote: (title: string, content: string, tags?: string[]) => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onClose: () => void;
}

export function AgentDashboard({
  notes,
  onCreateNote,
  onUpdateNote,
  onClose,
}: AgentDashboardProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [runningTasks, setRunningTasks] = useState<Map<string, AgentTaskStatus>>(new Map());
  const [activeTab, setActiveTab] = useState<'suggestions' | 'agents' | 'history'>('suggestions');
  const config = getAgentConfig();

  // Load agents and suggestions
  useEffect(() => {
    setAgents(getAgents());
    setSuggestions(getSuggestions());
  }, []);

  const handleToggleAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      updateAgent(agentId, { enabled: !agent.enabled });
      setAgents(getAgents());
    }
  };

  const handleToggleCapability = (agentId: string, capabilityId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      const capabilities = agent.capabilities.map((c) =>
        c.id === capabilityId ? { ...c, enabled: !c.enabled } : c
      );
      updateAgent(agentId, { capabilities });
      setAgents(getAgents());
    }
  };

  const handleRunAgent = useCallback(
    async (agentId: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent || !agent.enabled) return;

      setRunningTasks((prev) => new Map(prev).set(agentId, 'running'));

      try {
        const result = await runAgent(agentId, notes);
        if (result.suggestions) {
          setSuggestions((prev) => [...result.suggestions!, ...prev]);
        }
        setRunningTasks((prev) => new Map(prev).set(agentId, 'completed'));
      } catch (error) {
        console.error(`Agent ${agentId} failed:`, error);
        setRunningTasks((prev) => new Map(prev).set(agentId, 'failed'));
      }

      // Clear status after 3 seconds
      setTimeout(() => {
        setRunningTasks((prev) => {
          const next = new Map(prev);
          next.delete(agentId);
          return next;
        });
      }, 3000);
    },
    [agents, notes]
  );

  const handleApplySuggestion = async (suggestion: AgentSuggestion) => {
    try {
      const result = await applySuggestion(suggestion.id);
      if (result) {
        // Handle based on suggestion type
        switch (suggestion.type) {
          case 'create_note':
            onCreateNote(
              suggestion.data.title || 'New Note',
              suggestion.data.content || '',
              suggestion.data.tags
            );
            break;
          case 'add_tags':
            if (suggestion.data.noteId) {
              onUpdateNote(suggestion.data.noteId, {
                tags: suggestion.data.tags,
              });
            }
            break;
          case 'connect_notes':
            if (suggestion.data.sourceNoteId && suggestion.data.targetNoteId) {
              const sourceNote = notes.find((n) => n.id === suggestion.data.sourceNoteId);
              if (sourceNote) {
                const targetNote = notes.find((n) => n.id === suggestion.data.targetNoteId);
                if (targetNote) {
                  onUpdateNote(sourceNote.id, {
                    content: sourceNote.content + `\n\n[[${targetNote.title}]]`,
                  });
                }
              }
            }
            break;
        }
      }
      setSuggestions(getSuggestions());
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    }
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    dismissSuggestion(suggestionId);
    setSuggestions(getSuggestions());
  };

  const getAgentIcon = (agentId: string) => {
    switch (agentId) {
      case 'archivist':
        return '📚';
      case 'researcher':
        return '🔬';
      case 'writer':
        return '✍️';
      default:
        return '🤖';
    }
  };

  const getSuggestionIcon = (type: AgentSuggestion['type']) => {
    switch (type) {
      case 'connect_notes':
        return '🔗';
      case 'merge_notes':
        return '🔀';
      case 'create_note':
        return '📝';
      case 'add_tags':
        return '🏷️';
      case 'remove_duplicate':
        return '♻️';
      case 'knowledge_gap':
        return '❓';
      case 'contradiction':
        return '⚠️';
      case 'briefing':
        return '📋';
      case 'research_update':
        return '📰';
      default:
        return '💡';
    }
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Knowledge Agents
            </h2>
            <p className="text-sm text-gray-500">
              {pendingSuggestions.length} pending suggestions •{' '}
              {config.dailyBudget - config.usedToday} API calls remaining today
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-100">
          <div className="flex gap-4">
            {(['suggestions', 'agents', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'suggestions' && pendingSuggestions.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {pendingSuggestions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'suggestions' && (
            <div className="space-y-4">
              {pendingSuggestions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <span className="text-4xl mb-4 block">💭</span>
                  <p>No pending suggestions</p>
                  <p className="text-sm mt-1">
                    Run an agent to generate suggestions
                  </p>
                </div>
              ) : (
                pendingSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">
                          {getSuggestionIcon(suggestion.type)}
                        </span>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {suggestion.title}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {suggestion.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-400">
                              from {getAgentIcon(suggestion.agentId)}{' '}
                              {suggestion.agentId}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-400">
                              priority {suggestion.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApplySuggestion(suggestion)}
                          className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => handleDismissSuggestion(suggestion.id)}
                          className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded-lg"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-6">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    agent.enabled
                      ? 'border-gray-200 bg-white'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getAgentIcon(agent.id)}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {agent.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {agent.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRunAgent(agent.id)}
                        disabled={!agent.enabled || runningTasks.has(agent.id)}
                        className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
                          agent.enabled && !runningTasks.has(agent.id)
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {runningTasks.get(agent.id) === 'running' ? (
                          <>
                            <span className="animate-spin">⚙️</span>
                            Running...
                          </>
                        ) : runningTasks.get(agent.id) === 'completed' ? (
                          <>
                            <span>✓</span>
                            Done
                          </>
                        ) : runningTasks.get(agent.id) === 'failed' ? (
                          <>
                            <span>✗</span>
                            Failed
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Run
                          </>
                        )}
                      </button>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agent.enabled}
                          onChange={() => handleToggleAgent(agent.id)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                    </div>
                  </div>

                  {/* Capabilities */}
                  {selectedAgent === agent.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        Capabilities
                      </h4>
                      <div className="space-y-2">
                        {agent.capabilities.map((cap) => (
                          <div
                            key={cap.id}
                            className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {cap.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {cap.description}
                              </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cap.enabled}
                                onChange={() =>
                                  handleToggleCapability(agent.id, cap.id)
                                }
                                disabled={!agent.enabled}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500 peer-disabled:opacity-50"></div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setSelectedAgent(
                        selectedAgent === agent.id ? null : agent.id
                      )
                    }
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                  >
                    {selectedAgent === agent.id
                      ? 'Hide capabilities'
                      : 'Show capabilities'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {suggestions
                .filter((s) => s.status !== 'pending')
                .slice(0, 20)
                .map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`p-3 rounded-lg border ${
                      suggestion.status === 'applied'
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getSuggestionIcon(suggestion.type)}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {suggestion.title}
                        </span>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          suggestion.status === 'applied'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {suggestion.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(suggestion.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              {suggestions.filter((s) => s.status !== 'pending').length ===
                0 && (
                <div className="text-center py-12 text-gray-400">
                  <p>No suggestion history yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Agents help organize, research, and write in your second brain
          </p>
          <button
            onClick={() => {
              // Run all enabled agents
              agents.filter((a) => a.enabled).forEach((a) => handleRunAgent(a.id));
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm rounded-lg hover:from-blue-600 hover:to-purple-600 flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Run All Agents
          </button>
        </div>
      </div>
    </div>
  );
}

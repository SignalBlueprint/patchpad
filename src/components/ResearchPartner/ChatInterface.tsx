/**
 * Research Partner Chat Interface
 *
 * A full-screen conversational interface for the AI Research Partner.
 * Allows users to ask questions about their notes and have ongoing conversations.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Note } from '../../types/note';
import {
  type Message,
  type Conversation,
  type Citation,
  type ExtractedTask,
  createConversation,
  getConversation,
  getAllConversations,
  deleteConversation,
  sendMessage,
  getAIFollowUpSuggestions,
  extractTasksFromConversation,
  generateMeetingBrief,
  generateResearchBrief,
  briefToNoteContent,
  isResearchPartnerAvailable,
} from '../../services/researchPartner';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (id: string) => void;
  onCreateNote?: (title: string, content: string, tags: string[]) => void;
}

export function ChatInterface({ isOpen, onClose, notes, onSelectNote, onCreateNote }: ChatInterfaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [briefTopic, setBriefTopic] = useState('');
  const [showBriefDialog, setShowBriefDialog] = useState(false);
  const [briefType, setBriefType] = useState<'research' | 'meeting'>('research');
  const [briefParticipants, setBriefParticipants] = useState('');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAvailable = isResearchPartnerAvailable();

  // Load conversations on mount
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  // Get AI-powered follow-up suggestions after AI response
  useEffect(() => {
    if (currentConversation && currentConversation.messages.length > 0) {
      getAIFollowUpSuggestions(currentConversation.id, notes).then(setSuggestions);
    }
  }, [currentConversation?.messages.length, notes]);

  // Extract tasks from conversation after exchanges
  useEffect(() => {
    if (currentConversation && currentConversation.messages.length >= 2) {
      extractTasksFromConversation(currentConversation.id, notes)
        .then(setExtractedTasks)
        .catch(() => setExtractedTasks([]));
    }
  }, [currentConversation?.messages.length, notes]);

  const loadConversations = async () => {
    const convos = await getAllConversations();
    setConversations(convos);
  };

  const handleNewConversation = async () => {
    const convo = await createConversation();
    setConversations(prev => [convo, ...prev]);
    setCurrentConversation(convo);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleSelectConversation = async (id: string) => {
    const convo = await getConversation(id);
    if (convo) {
      setCurrentConversation(convo);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading || !currentConversation) return;

    const userInput = input.trim();
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const { response, citations } = await sendMessage(
        currentConversation.id,
        userInput,
        notes
      );

      // Refresh conversation
      const updated = await getConversation(currentConversation.id);
      if (updated) {
        setCurrentConversation(updated);
        // Update in list
        setConversations(prev =>
          prev.map(c => c.id === updated.id ? updated : c)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleCitationClick = (citation: Citation) => {
    onSelectNote(citation.noteId);
    onClose();
  };

  const handleGenerateBrief = async () => {
    if (!briefTopic.trim()) return;

    setShowBriefDialog(false);
    setLoading(true);
    setError(null);

    try {
      let brief: string;
      let citations: Citation[];

      if (briefType === 'meeting') {
        const participants = briefParticipants.split(',').map(p => p.trim()).filter(Boolean);
        const result = await generateMeetingBrief(briefTopic, participants, notes);
        brief = result.brief;
        citations = result.citations;
      } else {
        const result = await generateResearchBrief(briefTopic, notes);
        brief = result.brief;
        citations = result.citations;
      }

      // Create a note with the brief if handler available
      if (onCreateNote) {
        const noteContent = briefToNoteContent(briefTopic, brief, citations);
        onCreateNote(noteContent.title, noteContent.content, noteContent.tags);
      }

      // Also show in conversation
      if (currentConversation) {
        const systemMsg: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: `📋 **${briefType === 'meeting' ? 'Meeting' : 'Research'} Brief: ${briefTopic}**\n\n${brief}`,
          citations,
          timestamp: new Date(),
        };
        currentConversation.messages.push(systemMsg);
        const updated = await getConversation(currentConversation.id);
        if (updated) setCurrentConversation(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate brief');
    } finally {
      setLoading(false);
      setBriefTopic('');
      setBriefParticipants('');
    }
  };

  const handleAddTaskToNote = (task: ExtractedTask) => {
    if (onCreateNote) {
      const content = `# Task\n\n- [ ] ${task.task}\n\nPriority: ${task.priority}`;
      onCreateNote(`Task: ${task.task.slice(0, 30)}...`, content, ['task', `priority-${task.priority}`]);
      setExtractedTasks(prev => prev.filter(t => t.id !== task.id));
    }
  };

  const formatMessage = (content: string) => {
    // Convert [Note: Title] citations to clickable links
    return content.replace(/\[Note: ([^\]]+)\]/g, (match, title) => {
      return `<span class="citation" data-title="${title}">[${title}]</span>`;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-white">
      {/* Sidebar with conversation list */}
      {showSidebar && (
        <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={handleNewConversation}
              className="w-full py-2 px-4 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No conversations yet
              </div>
            ) : (
              conversations.map(convo => (
                <div
                  key={convo.id}
                  className={`group flex items-center gap-2 p-3 cursor-pointer border-b border-gray-100 hover:bg-gray-100 transition-colors ${
                    currentConversation?.id === convo.id ? 'bg-indigo-50' : ''
                  }`}
                  onClick={() => handleSelectConversation(convo.id)}
                >
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{convo.title}</p>
                    <p className="text-xs text-gray-500">
                      {convo.messages.length} messages
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(convo.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Research Partner</h2>
                <p className="text-xs text-gray-500">Ask questions about your notes</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tools menu */}
            <div className="relative">
              <button
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="Tools"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
              {showToolsMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={() => { setShowToolsMenu(false); setBriefType('research'); setShowBriefDialog(true); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate Research Brief
                  </button>
                  <button
                    onClick={() => { setShowToolsMenu(false); setBriefType('meeting'); setShowBriefDialog(true); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Prepare for Meeting
                  </button>
                </div>
              )}
            </div>
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

        {/* Brief generation dialog */}
        {showBriefDialog && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {briefType === 'meeting' ? 'Prepare for Meeting' : 'Generate Research Brief'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {briefType === 'meeting' ? 'Meeting Topic' : 'Research Topic'}
                  </label>
                  <input
                    type="text"
                    value={briefTopic}
                    onChange={(e) => setBriefTopic(e.target.value)}
                    placeholder={briefType === 'meeting' ? 'e.g., Q1 Planning, Product Review' : 'e.g., Marketing Strategy, Project Phoenix'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
                {briefType === 'meeting' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Participants (optional, comma-separated)
                    </label>
                    <input
                      type="text"
                      value={briefParticipants}
                      onChange={(e) => setBriefParticipants(e.target.value)}
                      placeholder="e.g., John, Sarah, Marketing Team"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowBriefDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateBrief}
                  disabled={!briefTopic.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Not available warning */}
        {!isAvailable && (
          <div className="mx-4 mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">OpenAI API key required</span>
            </div>
            <p className="mt-1 text-sm text-yellow-600">
              Add your OpenAI API key in settings to use Research Partner.
            </p>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!currentConversation ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a conversation</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Ask questions about your notes and I'll help you find answers.
                </p>
                <button
                  onClick={handleNewConversation}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  New Conversation
                </button>
              </div>
            </div>
          ) : currentConversation.messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <p className="text-gray-500 mb-4">
                  Ask me anything about your notes. I can help you:
                </p>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {[
                    'What do I know about project X?',
                    'Summarize my notes on marketing',
                    'Find connections between topics',
                    'Prepare me for a meeting about...',
                  ].map((example, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(example)}
                      className="px-3 py-2 text-left text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {currentConversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: formatMessage(msg.content)
                          .replace(/\n/g, '<br>')
                          .replace(/<span class="citation"/g, '<span class="text-indigo-600 font-medium cursor-pointer hover:underline"')
                      }}
                    />

                    {/* Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200/50">
                        <p className="text-xs text-gray-500 mb-2">Sources:</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map((cite, i) => (
                            <button
                              key={i}
                              onClick={() => handleCitationClick(cite)}
                              className="text-xs px-2 py-1 bg-white text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-50 transition-colors"
                            >
                              {cite.noteTitle}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Extracted tasks */}
        {extractedTasks.length > 0 && currentConversation && !loading && onCreateNote && (
          <div className="mx-4 mb-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="text-sm font-medium text-purple-700">Tasks detected</span>
            </div>
            <div className="space-y-1">
              {extractedTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-gray-700 flex-1">{task.task}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    task.priority === 'high' ? 'bg-red-100 text-red-700' :
                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {task.priority}
                  </span>
                  <button
                    onClick={() => handleAddTaskToNote(task)}
                    className="px-2 py-1 text-xs text-purple-600 hover:bg-purple-100 rounded transition-colors"
                  >
                    Add as note
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && currentConversation && !loading && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        {currentConversation && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your notes..."
                disabled={!isAvailable || loading}
                rows={1}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || !isAvailable || loading}
                className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

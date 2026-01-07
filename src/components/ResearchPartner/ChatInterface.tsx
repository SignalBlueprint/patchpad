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
  createConversation,
  getConversation,
  getAllConversations,
  deleteConversation,
  sendMessage,
  getFollowUpSuggestions,
  isResearchPartnerAvailable,
} from '../../services/researchPartner';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (id: string) => void;
}

export function ChatInterface({ isOpen, onClose, notes, onSelectNote }: ChatInterfaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);

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

  // Get follow-up suggestions after AI response
  useEffect(() => {
    if (currentConversation && currentConversation.messages.length > 0) {
      getFollowUpSuggestions(currentConversation.id).then(setSuggestions);
    }
  }, [currentConversation?.messages.length]);

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
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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

import { useState, useRef, useEffect } from 'react';
import type { Note } from '../types/note';
import { askNotes, type AskNotesResult } from '../services/ai';

interface AskNotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (id: string) => void;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  citedNotes?: string[];
}

export function AskNotesDialog({ isOpen, onClose, notes, onSelectNote }: AskNotesDialogProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userQuestion = question.trim();
    setQuestion('');
    setConversation(prev => [...prev, { role: 'user', content: userQuestion }]);
    setLoading(true);

    try {
      const result = await askNotes(userQuestion, notes);
      setConversation(prev => [...prev, {
        role: 'assistant',
        content: result.answer,
        citedNotes: result.citedNotes,
      }]);
    } catch (error) {
      setConversation(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const getNoteTitle = (noteId: string) => {
    return notes.find(n => n.id === noteId)?.title || 'Unknown Note';
  };

  const clearConversation = () => {
    setConversation([]);
    setQuestion('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in slide-in-from-top-4"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">Ask Your Notes</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{notes.length} notes available</span>
            {conversation.length > 0 && (
              <button
                onClick={clearConversation}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="Clear conversation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversation area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
          {conversation.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-gray-500 font-medium mb-2">Ask anything about your notes</p>
              <p className="text-sm text-gray-400">Try questions like:</p>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['What did I write about last week?', 'Find my meeting notes', 'Summarize my project ideas'].map(example => (
                  <button
                    key={example}
                    onClick={() => setQuestion(example)}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            conversation.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  {msg.citedNotes && msg.citedNotes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Referenced notes:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.citedNotes.map(noteId => (
                          <button
                            key={noteId}
                            onClick={() => {
                              onSelectNote(noteId);
                              onClose();
                            }}
                            className="text-xs px-2 py-0.5 bg-white text-blue-600 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                          >
                            {getNoteTitle(noteId)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-gray-500">Searching your notes...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask a question about your notes..."
              className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!question.trim() || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

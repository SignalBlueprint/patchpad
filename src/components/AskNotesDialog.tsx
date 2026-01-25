import { useState, useRef, useEffect, useCallback } from 'react';
import type { Note } from '../types/note';
import { askNotes, type AskNotesResult } from '../services/ai';
import { audioRecorder, isTranscriptionAvailable, type RecordingState } from '../services/audio';
import { speak, stop as stopSpeech, isTTSAvailable, isSpeaking } from '../services/textToSpeech';

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
  });
  const [transcribing, setTranscribing] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const canUseVoice = isTranscriptionAvailable();
  const canUseTTS = isTTSAvailable();

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

  // Voice recording handlers
  const startRecording = useCallback(async () => {
    if (!audioRecorder.isSupported()) {
      return;
    }

    try {
      const hasPermission = await audioRecorder.requestPermission();
      if (!hasPermission) {
        return;
      }

      await audioRecorder.startRecording(setRecordingState);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    try {
      setTranscribing(true);
      const blob = await audioRecorder.stopRecording();
      const result = await audioRecorder.transcribe(blob);
      setQuestion(result.text);
      // Auto-focus the input after transcription
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to transcribe:', err);
    } finally {
      setIsRecording(false);
      setTranscribing(false);
      setRecordingState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioLevel: 0,
      });
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    audioRecorder.cancelRecording();
    setIsRecording(false);
    setRecordingState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioLevel: 0,
    });
  }, []);

  // Cleanup recording on close
  useEffect(() => {
    if (!isOpen && isRecording) {
      cancelRecording();
    }
  }, [isOpen, isRecording, cancelRecording]);

  // Stop speech when dialog closes
  useEffect(() => {
    if (!isOpen) {
      stopSpeech();
      setSpeakingIndex(null);
    }
  }, [isOpen]);

  // Handle speak/stop for assistant messages
  const handleSpeak = useCallback((text: string, index: number) => {
    if (speakingIndex === index) {
      // Stop current speech
      stopSpeech();
      setSpeakingIndex(null);
    } else {
      // Stop any current speech and start new
      stopSpeech();
      setSpeakingIndex(index);
      speak(text, {
        rate: 1,
        onEnd: () => setSpeakingIndex(null),
        onError: () => setSpeakingIndex(null),
      });
    }
  }, [speakingIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in slide-in-from-top-4"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <h2 className="text-lg font-semibold text-neutral-900">Ask Your Notes</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">{notes.length} notes available</span>
            {conversation.length > 0 && (
              <button
                onClick={clearConversation}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded transition-colors"
                title="Clear conversation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded transition-colors"
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
              <p className="text-neutral-500 font-medium mb-2">Ask anything about your notes</p>
              <p className="text-sm text-neutral-400">Try questions like:</p>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['What did I write about last week?', 'Find my meeting notes', 'Summarize my project ideas'].map(example => (
                  <button
                    key={example}
                    onClick={() => setQuestion(example)}
                    className="text-xs px-3 py-1.5 bg-neutral-100 text-neutral-600 rounded-full hover:bg-gray-200 transition-colors"
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
                      ? 'bg-primary-600 text-white'
                      : 'bg-neutral-100 text-gray-800'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  {msg.citedNotes && msg.citedNotes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-neutral-200">
                      <p className="text-xs text-neutral-500 mb-1">Referenced notes:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.citedNotes.map(noteId => (
                          <button
                            key={noteId}
                            onClick={() => {
                              onSelectNote(noteId);
                              onClose();
                            }}
                            className="text-xs px-2 py-0.5 bg-white text-primary-600 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                          >
                            {getNoteTitle(noteId)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Read aloud button for assistant messages */}
                  {msg.role === 'assistant' && canUseTTS && (
                    <div className="mt-2 pt-2 border-t border-neutral-200">
                      <button
                        onClick={() => handleSpeak(msg.content, i)}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
                          speakingIndex === i
                            ? 'bg-purple-100 text-purple-700'
                            : 'text-neutral-500 hover:bg-gray-200 hover:text-neutral-700'
                        }`}
                        title={speakingIndex === i ? 'Stop reading' : 'Read aloud'}
                      >
                        {speakingIndex === i ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            <span>Read aloud</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-neutral-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin text-neutral-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-neutral-500">Searching your notes...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-neutral-200">
          {/* Recording indicator */}
          {(isRecording || transcribing) && (
            <div className="mb-2 flex items-center justify-center gap-2 text-sm">
              {isRecording && (
                <>
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-error-600 font-medium">
                    Recording... {Math.floor(recordingState.duration / 60)}:{String(recordingState.duration % 60).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="text-xs text-neutral-500 hover:text-neutral-700 underline"
                  >
                    Cancel
                  </button>
                </>
              )}
              {transcribing && (
                <>
                  <svg className="w-4 h-4 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-secondary-600">Transcribing...</span>
                </>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={isRecording ? 'Recording your question...' : 'Ask a question about your notes...'}
              className="flex-1 px-4 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={loading || isRecording || transcribing}
            />
            {/* Microphone button */}
            {canUseVoice && (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading || transcribing}
                className={`px-3 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  isRecording
                    ? 'bg-error-600 text-white hover:bg-error-700 focus:ring-red-500'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-gray-200 focus:ring-gray-500'
                }`}
                title={isRecording ? 'Stop recording' : 'Ask with voice'}
              >
                {isRecording ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="submit"
              disabled={!question.trim() || loading || isRecording || transcribing}
              className="px-4 py-2 text-sm font-medium text-white bg-secondary-600 rounded-lg hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

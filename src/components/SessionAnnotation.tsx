/**
 * Session Annotation Component
 *
 * UI for adding annotations during session recording or playback.
 * Supports text notes, highlights, and voice memos.
 */

import { useState, useRef, useCallback } from 'react';
import type { SessionAnnotation as AnnotationType } from '../types/session';

interface SessionAnnotationProps {
  /** Current timestamp in session (ms since start) */
  currentTime: number;
  /** Callback when annotation is created */
  onAddAnnotation: (
    type: 'note' | 'highlight' | 'voice',
    content: string,
    canvasPosition?: { x: number; y: number }
  ) => void;
  /** Current canvas position (for spatial annotations) */
  canvasPosition?: { x: number; y: number };
  /** Whether recording is paused */
  isPaused: boolean;
  /** Callback to pause recording */
  onPause: () => void;
  /** Callback to resume recording */
  onResume: () => void;
  /** Existing annotations to display */
  annotations: AnnotationType[];
  /** Session duration */
  sessionDuration: number;
}

export function SessionAnnotation({
  currentTime,
  onAddAnnotation,
  canvasPosition,
  isPaused,
  onPause,
  onResume,
  annotations,
  sessionDuration,
}: SessionAnnotationProps) {
  const [mode, setMode] = useState<'collapsed' | 'note' | 'highlight' | 'voice'>('collapsed');
  const [noteText, setNoteText] = useState('');
  const [highlightColor, setHighlightColor] = useState<'yellow' | 'green' | 'blue' | 'pink'>('yellow');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExpand = useCallback((newMode: 'note' | 'highlight' | 'voice') => {
    setMode(newMode);
    if (!isPaused) {
      onPause();
    }
  }, [isPaused, onPause]);

  const handleCollapse = useCallback(() => {
    setMode('collapsed');
    setNoteText('');
    setVoiceTranscript('');
  }, []);

  const handleAddNote = useCallback(() => {
    if (noteText.trim()) {
      onAddAnnotation('note', noteText.trim(), canvasPosition);
      setNoteText('');
      handleCollapse();
    }
  }, [noteText, canvasPosition, onAddAnnotation, handleCollapse]);

  const handleAddHighlight = useCallback((comment?: string) => {
    const content = comment
      ? `[${highlightColor}] ${comment}`
      : `[${highlightColor}] Highlighted at ${formatTime(currentTime)}`;
    onAddAnnotation('highlight', content, canvasPosition);
    handleCollapse();
  }, [highlightColor, currentTime, canvasPosition, onAddAnnotation, handleCollapse]);

  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up MediaRecorder for audio capture
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);

      // Set up Speech Recognition for transcription
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setVoiceTranscript(transcript);
        };

        recognition.start();
      }
    } catch (error) {
      console.error('Failed to start voice recording:', error);
    }
  }, []);

  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecordingVoice(false);
  }, []);

  const handleSaveVoiceAnnotation = useCallback(() => {
    if (voiceTranscript.trim()) {
      onAddAnnotation('voice', voiceTranscript.trim(), canvasPosition);
    }
    stopVoiceRecording();
    setVoiceTranscript('');
    handleCollapse();
  }, [voiceTranscript, canvasPosition, onAddAnnotation, stopVoiceRecording, handleCollapse]);

  const highlightColors = [
    { name: 'yellow', class: 'bg-yellow-400', border: 'border-yellow-500' },
    { name: 'green', class: 'bg-green-400', border: 'border-green-500' },
    { name: 'blue', class: 'bg-blue-400', border: 'border-blue-500' },
    { name: 'pink', class: 'bg-pink-400', border: 'border-pink-500' },
  ] as const;

  // Collapsed state - show quick action buttons
  if (mode === 'collapsed') {
    return (
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg border border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 mr-2">{formatTime(currentTime)}</span>

          {/* Add Note button */}
          <button
            onClick={() => handleExpand('note')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            title="Add text note"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Note
          </button>

          {/* Highlight button */}
          <button
            onClick={() => handleExpand('highlight')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors"
            title="Add highlight"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Highlight
          </button>

          {/* Voice memo button */}
          <button
            onClick={() => handleExpand('voice')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
            title="Record voice memo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Voice
          </button>

          {/* Annotation count badge */}
          {annotations.length > 0 && (
            <span className="ml-auto px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Expanded state for adding note
  if (mode === 'note') {
    return (
      <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-blue-200 p-4 w-80">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Add Note
          </h3>
          <span className="text-xs text-gray-400">{formatTime(currentTime)}</span>
        </div>

        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="What are you thinking at this moment?"
          className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
          autoFocus
        />

        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            onClick={handleCollapse}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleAddNote}
            disabled={!noteText.trim()}
            className={`px-4 py-1.5 text-sm rounded-lg ${
              noteText.trim()
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Add Note
          </button>
        </div>
      </div>
    );
  }

  // Expanded state for highlight
  if (mode === 'highlight') {
    return (
      <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-yellow-200 p-4 w-72">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Mark Moment
          </h3>
          <span className="text-xs text-gray-400">{formatTime(currentTime)}</span>
        </div>

        {/* Color selector */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500">Color:</span>
          {highlightColors.map((color) => (
            <button
              key={color.name}
              onClick={() => setHighlightColor(color.name as typeof highlightColor)}
              className={`w-6 h-6 rounded-full ${color.class} ${
                highlightColor === color.name ? `ring-2 ring-offset-1 ${color.border}` : ''
              }`}
            />
          ))}
        </div>

        {/* Optional comment */}
        <input
          type="text"
          placeholder="Add a comment (optional)"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-200"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddHighlight((e.target as HTMLInputElement).value);
            }
          }}
        />

        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            onClick={handleCollapse}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => handleAddHighlight()}
            className="px-4 py-1.5 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
          >
            Mark
          </button>
        </div>
      </div>
    );
  }

  // Expanded state for voice memo
  if (mode === 'voice') {
    return (
      <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-purple-200 p-4 w-80">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Voice Memo
          </h3>
          <span className="text-xs text-gray-400">{formatTime(currentTime)}</span>
        </div>

        {/* Recording indicator */}
        {isRecordingVoice ? (
          <div className="flex items-center gap-2 mb-3 p-3 bg-red-50 rounded-lg">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-red-700">Recording...</span>
          </div>
        ) : (
          <button
            onClick={startVoiceRecording}
            className="w-full flex items-center justify-center gap-2 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Start Recording
          </button>
        )}

        {/* Transcript preview */}
        {voiceTranscript && (
          <div className="mt-3 p-2 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">{voiceTranscript}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            onClick={() => {
              if (isRecordingVoice) stopVoiceRecording();
              handleCollapse();
            }}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          {isRecordingVoice && (
            <button
              onClick={handleSaveVoiceAnnotation}
              className="px-4 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600"
            >
              Save Memo
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Annotation List Component
 *
 * Displays a list of session annotations with timeline positioning.
 */
interface AnnotationListProps {
  annotations: AnnotationType[];
  sessionDuration: number;
  currentTime: number;
  onSeekTo: (timestamp: number) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
}

export function AnnotationList({
  annotations,
  sessionDuration,
  currentTime,
  onSeekTo,
  onDeleteAnnotation,
}: AnnotationListProps) {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getAnnotationIcon = (type: AnnotationType['type']) => {
    switch (type) {
      case 'note':
        return '📝';
      case 'highlight':
        return '✨';
      case 'voice':
        return '🎤';
    }
  };

  const getAnnotationColor = (type: AnnotationType['type']) => {
    switch (type) {
      case 'note':
        return 'bg-blue-50 border-blue-200';
      case 'highlight':
        return 'bg-yellow-50 border-yellow-200';
      case 'voice':
        return 'bg-purple-50 border-purple-200';
    }
  };

  if (annotations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <p className="text-sm">No annotations yet</p>
        <p className="text-xs mt-1">Add notes, highlights, or voice memos during playback</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {annotations
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((annotation) => {
          const isActive = Math.abs(annotation.timestamp - currentTime) < 1000;
          return (
            <div
              key={annotation.id}
              onClick={() => onSeekTo(annotation.timestamp)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${getAnnotationColor(annotation.type)} ${
                isActive ? 'ring-2 ring-offset-1 ring-blue-400' : 'hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{getAnnotationIcon(annotation.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{formatTime(annotation.timestamp)}</span>
                    {onDeleteAnnotation && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAnnotation(annotation.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-1 line-clamp-2">{annotation.content}</p>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

import { useState, useCallback, useEffect, useRef } from 'react';
import { createSilenceDetector, SilenceDetector } from '../services/silenceDetection';

interface DictationModeProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (content: string) => void;
}

type DictationState = 'idle' | 'listening' | 'paused';

/**
 * Check if Web Speech API is available
 */
function isSpeechRecognitionAvailable(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

/**
 * Get SpeechRecognition constructor
 */
function getSpeechRecognition(): typeof SpeechRecognition | null {
  if ('SpeechRecognition' in window) {
    return (window as unknown as { SpeechRecognition: typeof SpeechRecognition }).SpeechRecognition;
  }
  if ('webkitSpeechRecognition' in window) {
    return (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;
  }
  return null;
}

export function DictationMode({ isOpen, onClose, onComplete }: DictationModeProps) {
  const [state, setState] = useState<DictationState>('idle');
  const [content, setContent] = useState('');
  const [interimResult, setInterimResult] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceDetectorRef = useRef<SilenceDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAvailable = isSpeechRecognitionAvailable();

  // Cleanup function
  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (silenceDetectorRef.current) {
      silenceDetectorRef.current.stop();
      silenceDetectorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setState('idle');
      setInterimResult('');
      setAudioLevel(0);
      setError(null);
    }
  }, [isOpen, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Start dictation
  const startDictation = useCallback(async () => {
    if (!isAvailable) {
      setError('Speech recognition is not available in this browser. Try Chrome or Edge.');
      return;
    }

    setError(null);

    try {
      // Get microphone access for audio level monitoring
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up silence detector
      silenceDetectorRef.current = createSilenceDetector({
        silenceThreshold: 0.02,
        shortPauseDuration: 500,
        longPauseDuration: 2000,
        onAudioLevel: setAudioLevel,
        onShortPause: () => {
          // Add a space on short pause (end of sentence)
        },
        onLongPause: () => {
          // Add paragraph break on long pause
          setContent(prev => prev.trim() ? prev + '\n\n' : prev);
        },
      });
      await silenceDetectorRef.current.start(stream);

      // Set up speech recognition
      const SpeechRecognitionClass = getSpeechRecognition();
      if (!SpeechRecognitionClass) {
        throw new Error('Speech recognition not available');
      }

      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (final) {
          setContent(prev => {
            // Add space before if content exists and doesn't end with newline
            const needsSpace = prev.length > 0 && !prev.endsWith('\n') && !prev.endsWith(' ');
            return prev + (needsSpace ? ' ' : '') + final;
          });
          setInterimResult('');
        } else {
          setInterimResult(interim);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
          // Ignore no-speech errors, just keep listening
          return;
        }
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
      };

      recognition.onend = () => {
        // Restart recognition if still in listening state (continuous mode)
        if (state === 'listening' && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Ignore errors on restart
          }
        }
      };

      recognition.start();
      setState('listening');
    } catch (err) {
      console.error('Failed to start dictation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start dictation');
      cleanup();
    }
  }, [isAvailable, cleanup, state]);

  // Pause dictation
  const pauseDictation = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (silenceDetectorRef.current) {
      silenceDetectorRef.current.stop();
    }
    setState('paused');
    setInterimResult('');
    setAudioLevel(0);
  }, []);

  // Resume dictation
  const resumeDictation = useCallback(async () => {
    if (!isAvailable) return;

    try {
      // Restart microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Restart silence detector
      if (silenceDetectorRef.current) {
        await silenceDetectorRef.current.start(stream);
      }

      // Restart recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      setState('listening');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume dictation');
    }
  }, [isAvailable]);

  // Handle complete
  const handleComplete = useCallback(() => {
    cleanup();
    onComplete(content.trim());
    setContent('');
    onClose();
  }, [cleanup, onComplete, content, onClose]);

  // Handle content change (manual editing)
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    cleanup();
    setContent('');
    onClose();
  }, [cleanup, onClose]);

  // Render audio level indicator
  const renderAudioLevel = () => {
    const bars = 12;
    const activeCount = Math.round(audioLevel * bars * 2); // Amplify for visibility

    return (
      <div className="flex items-center justify-center gap-0.5 h-6">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              i < activeCount
                ? i < bars * 0.5 ? 'bg-green-500' : i < bars * 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                : 'bg-gray-300'
            }`}
            style={{ height: `${40 + i * 4}%` }}
          />
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-top-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              state === 'listening' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
            }`} />
            <h2 className="text-lg font-semibold text-gray-900">
              {state === 'idle' && 'Dictation Mode'}
              {state === 'listening' && 'Listening...'}
              {state === 'paused' && 'Paused'}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Not available warning */}
        {!isAvailable && (
          <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            <strong>Note:</strong> Speech recognition is not available in this browser.
            Please use Chrome, Edge, or Safari for dictation mode.
          </div>
        )}

        {/* Audio level indicator */}
        {state === 'listening' && (
          <div className="px-4 py-2 border-b border-gray-100">
            {renderAudioLevel()}
          </div>
        )}

        {/* Text area for content */}
        <div className="flex-1 p-4 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={content + (interimResult ? (content ? ' ' : '') + interimResult : '')}
            onChange={handleContentChange}
            placeholder={state === 'idle' ? 'Click "Start" to begin dictating...' : 'Speak now... Long pauses (2+ seconds) create new paragraphs.'}
            className="w-full h-full min-h-[300px] p-4 text-gray-800 bg-gray-50 rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            style={{ whiteSpace: 'pre-wrap' }}
          />
          {interimResult && (
            <div className="absolute bottom-20 left-4 right-4 text-sm text-gray-500 italic">
              Interim: {interimResult}
            </div>
          )}
        </div>

        {/* Footer with controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {content.split(/\s+/).filter(Boolean).length} words
            {state === 'listening' && ' · Long pause = new paragraph'}
          </div>

          <div className="flex items-center gap-2">
            {state === 'idle' && (
              <button
                onClick={startDictation}
                disabled={!isAvailable}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Start Dictation
                </span>
              </button>
            )}

            {state === 'listening' && (
              <button
                onClick={pauseDictation}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                  Pause
                </span>
              </button>
            )}

            {state === 'paused' && (
              <button
                onClick={resumeDictation}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Resume
                </span>
              </button>
            )}

            {(state === 'paused' || content.trim()) && (
              <button
                onClick={handleComplete}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create Note
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

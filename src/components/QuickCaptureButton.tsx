import { useState, useCallback, useEffect, useRef } from 'react';
import { audioRecorder, formatDuration, isTranscriptionAvailable, type RecordingState, type TranscriptionResult } from '../services/audio';

interface QuickCaptureButtonProps {
  onCapture: (result: TranscriptionResult) => void;
  onError?: (error: string) => void;
}

type CaptureState = 'idle' | 'recording' | 'processing';

export function QuickCaptureButton({ onCapture, onError }: QuickCaptureButtonProps) {
  const [state, setState] = useState<CaptureState>('idle');
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
  });
  const longPressTimerRef = useRef<number | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRecorder.cancelRecording();
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!isTranscriptionAvailable()) {
      onError?.('Transcription requires an OpenAI API key');
      return;
    }

    if (!audioRecorder.isSupported()) {
      onError?.('Audio recording is not supported in this browser');
      return;
    }

    try {
      const hasPermission = await audioRecorder.requestPermission();
      if (!hasPermission) {
        onError?.('Microphone permission denied');
        return;
      }

      await audioRecorder.startRecording(setRecordingState);
      setState('recording');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [onError]);

  const handleStopRecording = useCallback(async () => {
    if (state !== 'recording') return;

    try {
      setState('processing');
      const blob = await audioRecorder.stopRecording();
      const result = await audioRecorder.transcribe(blob);
      onCapture(result);
      setState('idle');
      setRecordingState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioLevel: 0,
      });
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to process recording');
      setState('idle');
    }
  }, [state, onCapture, onError]);

  const handleCancelRecording = useCallback(() => {
    audioRecorder.cancelRecording();
    setState('idle');
    setRecordingState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioLevel: 0,
    });
    setIsLongPress(false);
  }, []);

  const handleClick = useCallback(() => {
    if (isLongPress) {
      setIsLongPress(false);
      return;
    }

    if (state === 'idle') {
      handleStartRecording();
    } else if (state === 'recording') {
      handleStopRecording();
    }
  }, [state, isLongPress, handleStartRecording, handleStopRecording]);

  const handlePointerDown = useCallback(() => {
    if (state === 'recording') {
      // Start long-press timer to cancel
      longPressTimerRef.current = window.setTimeout(() => {
        setIsLongPress(true);
        handleCancelRecording();
      }, 500);
    }
  }, [state, handleCancelRecording]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Render audio level bars
  const renderAudioBars = () => {
    const bars = 8;
    const activeCount = Math.round(recordingState.audioLevel * bars);

    return (
      <div className="absolute inset-0 flex items-center justify-center gap-0.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              i < activeCount ? 'bg-white' : 'bg-white/30'
            }`}
            style={{
              height: `${30 + Math.random() * 40}%`,
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed bottom-20 right-6 z-40 flex flex-col items-center gap-2">
      {/* Duration display when recording */}
      {state === 'recording' && (
        <div className="px-3 py-1.5 bg-red-600 text-white text-sm font-mono rounded-full shadow-lg animate-pulse">
          {formatDuration(recordingState.duration)}
        </div>
      )}

      {/* Processing indicator */}
      {state === 'processing' && (
        <div className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-full shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Transcribing...
        </div>
      )}

      {/* Main button */}
      <button
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        disabled={state === 'processing'}
        className={`relative w-14 h-14 rounded-full shadow-lg transition-all duration-200 ${
          state === 'recording'
            ? 'bg-red-600 hover:bg-red-700 scale-110'
            : state === 'processing'
            ? 'bg-blue-600 cursor-wait'
            : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
        }`}
        title={
          state === 'idle'
            ? 'Start voice capture'
            : state === 'recording'
            ? 'Tap to stop (long press to cancel)'
            : 'Processing...'
        }
      >
        {/* Pulsing ring when recording */}
        {state === 'recording' && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
            <span className="absolute inset-[-4px] rounded-full border-2 border-red-400 animate-pulse" />
          </>
        )}

        {/* Icon or audio visualization */}
        {state === 'recording' ? (
          renderAudioBars()
        ) : state === 'processing' ? (
          <svg className="w-7 h-7 mx-auto text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-7 h-7 mx-auto text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* Hint text */}
      {state === 'idle' && (
        <span className="text-xs text-gray-500 bg-white/80 px-2 py-0.5 rounded-full shadow-sm">
          Voice capture
        </span>
      )}
      {state === 'recording' && (
        <span className="text-xs text-red-600 bg-white/80 px-2 py-0.5 rounded-full shadow-sm">
          Hold to cancel
        </span>
      )}
    </div>
  );
}

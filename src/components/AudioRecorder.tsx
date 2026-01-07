import { useState, useCallback, useEffect } from 'react';
import { audioRecorder, formatDuration, isTranscriptionAvailable, type RecordingState, type TranscriptionResult } from '../services/audio';

interface AudioRecorderProps {
  onTranscriptionComplete: (result: TranscriptionResult & { summary?: string }) => void;
  onClose: () => void;
  /** Quick capture mode: simplified UI, auto-start, no review step */
  quickCapture?: boolean;
}

type RecorderStep = 'idle' | 'recording' | 'processing' | 'review';

export function AudioRecorder({ onTranscriptionComplete, onClose, quickCapture = false }: AudioRecorderProps) {
  const [step, setStep] = useState<RecorderStep>(quickCapture ? 'recording' : 'idle');
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Check for transcription support
  const transcriptionAvailable = isTranscriptionAvailable();

  // Auto-start recording in quick capture mode
  useEffect(() => {
    if (quickCapture) {
      const startQuickCapture = async () => {
        if (!audioRecorder.isSupported()) {
          setError('Audio recording is not supported in this browser');
          return;
        }

        try {
          const hasPermission = await audioRecorder.requestPermission();
          if (!hasPermission) {
            setError('Microphone permission denied');
            return;
          }

          await audioRecorder.startRecording(setRecordingState);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to start recording');
        }
      };

      startQuickCapture();
    }
  }, [quickCapture]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      audioRecorder.cancelRecording();
    };
  }, []);

  const handleStartRecording = useCallback(async () => {
    try {
      setError(null);

      if (!audioRecorder.isSupported()) {
        setError('Audio recording is not supported in this browser');
        return;
      }

      const hasPermission = await audioRecorder.requestPermission();
      if (!hasPermission) {
        setError('Microphone permission denied');
        return;
      }

      await audioRecorder.startRecording(setRecordingState);
      setStep('recording');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, []);

  const handlePauseResume = useCallback(() => {
    if (recordingState.isPaused) {
      audioRecorder.resumeRecording();
    } else {
      audioRecorder.pauseRecording();
    }
  }, [recordingState.isPaused]);

  const handleStopRecording = useCallback(async () => {
    try {
      setStep('processing');
      const blob = await audioRecorder.stopRecording();
      setAudioBlob(blob);

      // Transcribe the audio
      const result = await audioRecorder.transcribe(blob);
      setTranscription(result);

      // In quick capture mode, skip review and directly complete
      if (quickCapture) {
        onTranscriptionComplete(result);
      } else {
        setStep('review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process recording');
      setStep(quickCapture ? 'recording' : 'idle');
    }
  }, [quickCapture, onTranscriptionComplete]);

  const handleCancelRecording = useCallback(() => {
    audioRecorder.cancelRecording();
    setStep('idle');
    setRecordingState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioLevel: 0,
    });
  }, []);

  const handleAcceptTranscription = useCallback(() => {
    if (transcription) {
      onTranscriptionComplete(transcription);
    }
  }, [transcription, onTranscriptionComplete]);

  const handleRetry = useCallback(() => {
    setTranscription(null);
    setAudioBlob(null);
    setStep('idle');
    setError(null);
  }, []);

  // Render audio level visualization
  const renderAudioLevel = () => {
    const bars = 20;
    const activeCount = Math.round(recordingState.audioLevel * bars);

    return (
      <div className="flex items-center gap-0.5 h-8">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-all duration-75 ${
              i < activeCount
                ? i < bars * 0.3 ? 'bg-green-500'
                : i < bars * 0.7 ? 'bg-yellow-500'
                : 'bg-red-500'
                : 'bg-gray-200'
            }`}
            style={{
              height: `${20 + (i * 2)}%`,
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 'idle' && 'Voice Recording'}
            {step === 'recording' && 'Recording...'}
            {step === 'processing' && 'Processing...'}
            {step === 'review' && 'Review Transcription'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Transcription not available warning */}
        {!transcriptionAvailable && step === 'idle' && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            <strong>Note:</strong> Transcription requires an OpenAI API key. You can still record, but transcription won't be available.
          </div>
        )}

        {/* Content based on step */}
        {step === 'idle' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-6">
              Click the button below to start recording. Your audio will be transcribed automatically.
            </p>
            <button
              onClick={handleStartRecording}
              className="px-6 py-3 bg-red-500 text-white rounded-full font-medium hover:bg-red-600 transition-colors shadow-lg hover:shadow-xl"
            >
              Start Recording
            </button>
          </div>
        )}

        {step === 'recording' && (
          <div className="text-center py-6">
            {/* Pulsing indicator */}
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className={`absolute inset-0 bg-red-500 rounded-full ${recordingState.isPaused ? '' : 'animate-ping opacity-25'}`} />
              <div className="absolute inset-2 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>

            {/* Duration */}
            <div className="text-3xl font-mono font-bold text-gray-900 mb-2">
              {formatDuration(recordingState.duration)}
            </div>

            {/* Audio level visualization */}
            <div className="flex justify-center mb-6">
              {renderAudioLevel()}
            </div>

            {/* Status */}
            <p className="text-sm text-gray-500 mb-6">
              {recordingState.isPaused ? 'Paused' : 'Recording in progress...'}
            </p>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleCancelRecording}
                className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Cancel"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <button
                onClick={handlePauseResume}
                className="p-4 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition-colors shadow-lg"
                title={recordingState.isPaused ? 'Resume' : 'Pause'}
              >
                {recordingState.isPaused ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                )}
              </button>

              <button
                onClick={handleStopRecording}
                className="p-4 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors shadow-lg"
                title="Stop and transcribe"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4">
              <svg className="w-full h-full text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="text-gray-600">Transcribing your audio...</p>
            <p className="text-sm text-gray-400 mt-2">This may take a moment</p>
          </div>
        )}

        {step === 'review' && transcription && (
          <div>
            {/* Transcription info */}
            <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDuration(Math.round(transcription.duration))}
              </span>
              {transcription.language && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10" />
                  </svg>
                  {transcription.language.toUpperCase()}
                </span>
              )}
            </div>

            {/* Transcribed text */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 max-h-64 overflow-y-auto">
              <p className="text-gray-800 whitespace-pre-wrap">{transcription.text}</p>
            </div>

            {/* Word count */}
            <p className="text-sm text-gray-500 mb-6">
              {transcription.text.split(/\s+/).filter(Boolean).length} words transcribed
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Record Again
              </button>
              <button
                onClick={handleAcceptTranscription}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Add to Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

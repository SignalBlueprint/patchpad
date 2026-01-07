/**
 * Transcription Service
 * Provides abstraction over multiple transcription providers
 */

import { getAPIKey, getAIProvider } from './ai';

export interface TranscriptionResult {
  text: string;
  duration: number;
  language?: string;
  provider: 'openai' | 'webspeech' | 'mock';
}

export interface TranscriptionProvider {
  name: string;
  isAvailable(): boolean;
  transcribe(audio: Blob): Promise<TranscriptionResult>;
}

// Storage key for transcription preferences
const TRANSCRIPTION_PREFS_KEY = 'patchpad_transcription_prefs';
const TRANSCRIPTION_QUALITY_KEY = 'patchpad_transcription_quality';

export type QualityPreference = 'speed' | 'balanced' | 'quality';

export interface TranscriptionPreferences {
  preferLocalTranscription: boolean;
  language: string;
  qualityPreference: QualityPreference;
}

function getPreferences(): TranscriptionPreferences {
  try {
    const saved = localStorage.getItem(TRANSCRIPTION_PREFS_KEY);
    const quality = localStorage.getItem(TRANSCRIPTION_QUALITY_KEY) as QualityPreference;
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        qualityPreference: quality || 'balanced',
      };
    }
  } catch {
    // Ignore parse errors
  }
  return {
    preferLocalTranscription: false,
    language: 'en-US',
    qualityPreference: 'balanced',
  };
}

export function savePreferences(prefs: Partial<TranscriptionPreferences>): void {
  const current = getPreferences();
  const { qualityPreference, ...rest } = { ...current, ...prefs };
  localStorage.setItem(TRANSCRIPTION_PREFS_KEY, JSON.stringify(rest));
  if (prefs.qualityPreference) {
    localStorage.setItem(TRANSCRIPTION_QUALITY_KEY, prefs.qualityPreference);
  }
}

export function getTranscriptionPreferences(): TranscriptionPreferences {
  return getPreferences();
}

export function getQualityPreference(): QualityPreference {
  return getPreferences().qualityPreference;
}

/**
 * OpenAI Whisper transcription provider
 */
class OpenAIProvider implements TranscriptionProvider {
  name = 'OpenAI Whisper';

  isAvailable(): boolean {
    return getAIProvider() === 'openai' && !!getAPIKey();
  }

  async transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
    const apiKey = getAPIKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type });

    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || 'Transcription failed');
    }

    const result = await response.json();

    return {
      text: result.text,
      duration: result.duration || 0,
      language: result.language,
      provider: 'openai',
    };
  }
}

/**
 * Web Speech API transcription provider (browser built-in, free)
 * Note: This requires continuous speech recognition and works differently
 * from file-based transcription. It's best for real-time dictation.
 */
class WebSpeechProvider implements TranscriptionProvider {
  name = 'Web Speech API (Local)';

  isAvailable(): boolean {
    return typeof window !== 'undefined' &&
           ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  async transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
    // Web Speech API doesn't support transcribing audio blobs directly
    // It only works with live microphone input
    // We'll return an error suggesting to use real-time transcription instead
    throw new Error(
      'Web Speech API does not support transcribing recorded audio. ' +
      'Use real-time dictation mode instead, or configure an OpenAI API key for Whisper transcription.'
    );
  }
}

/**
 * Real-time Web Speech recognition for dictation mode
 */
export class RealtimeSpeechRecognition {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private transcript = '';
  private onResult: ((text: string, isFinal: boolean) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = getPreferences().language;

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.transcript += finalTranscript + ' ';
        this.onResult?.(this.transcript.trim(), true);
      } else if (interimTranscript) {
        this.onResult?.(this.transcript + interimTranscript, false);
      }
    };

    this.recognition.onerror = (event) => {
      this.onError?.(event.error);
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        // Auto-restart if we're still supposed to be listening
        this.recognition?.start();
      }
    };
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  start(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: string) => void
  ): void {
    if (!this.recognition) {
      onError?.('Speech recognition not supported');
      return;
    }

    this.transcript = '';
    this.onResult = onResult;
    this.onError = onError || null;
    this.isListening = true;

    try {
      this.recognition.start();
    } catch (e) {
      // May already be started
      console.warn('Speech recognition start error:', e);
    }
  }

  stop(): string {
    this.isListening = false;
    this.recognition?.stop();
    return this.transcript.trim();
  }

  setLanguage(lang: string): void {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }
}

// Provider instances
const openAIProvider = new OpenAIProvider();
const webSpeechProvider = new WebSpeechProvider();

/**
 * Get available transcription providers
 */
export function getAvailableProviders(): TranscriptionProvider[] {
  return [openAIProvider, webSpeechProvider].filter(p => p.isAvailable());
}

/**
 * Get the best available transcription provider
 */
export function getBestProvider(): TranscriptionProvider | null {
  const prefs = getPreferences();

  // If user prefers local transcription and Web Speech is available
  // (but Web Speech doesn't support blob transcription, only real-time)
  // So we always prefer OpenAI for blob transcription

  if (openAIProvider.isAvailable()) {
    return openAIProvider;
  }

  // Web Speech doesn't support blob transcription
  return null;
}

/**
 * Transcribe audio using the best available provider
 */
export async function transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
  const provider = getBestProvider();

  if (!provider) {
    throw new Error(
      'No transcription provider available. Please configure an OpenAI API key for Whisper transcription.'
    );
  }

  return provider.transcribe(audioBlob);
}

/**
 * Check if any transcription provider is available
 */
export function isTranscriptionAvailable(): boolean {
  return openAIProvider.isAvailable();
}

/**
 * Check if real-time speech recognition is available
 */
export function isRealtimeSpeechAvailable(): boolean {
  return typeof window !== 'undefined' &&
         ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

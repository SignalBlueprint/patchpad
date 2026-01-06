/**
 * Audio Recording and Transcription Service
 * Handles recording audio and converting to text using OpenAI Whisper
 */

import { getAPIKey, getAIProvider } from './ai';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
}

export interface TranscriptionResult {
  text: string;
  duration: number;
  language?: string;
}

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
}

class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;

  private onStateChange: ((state: RecordingState) => void) | null = null;
  private animationFrameId: number | null = null;

  /**
   * Check if audio recording is supported
   */
  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Request microphone permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(onStateChange?: (state: RecordingState) => void): Promise<void> {
    if (this.mediaRecorder?.state === 'recording') {
      throw new Error('Already recording');
    }

    this.onStateChange = onStateChange || null;
    this.audioChunks = [];
    this.pausedDuration = 0;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Set up audio analysis for level monitoring
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Create MediaRecorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.startTime = Date.now();

      // Start monitoring audio levels
      this.startLevelMonitoring();

      this.notifyStateChange();
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause();
      this.pauseStartTime = Date.now();
      this.notifyStateChange();
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.mediaRecorder?.state === 'paused') {
      this.pausedDuration += Date.now() - this.pauseStartTime;
      this.mediaRecorder.resume();
      this.notifyStateChange();
    }
  }

  /**
   * Stop recording and return the audio blob
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('Not recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.getSupportedMimeType();
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel recording without saving
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  /**
   * Get current recording duration in seconds
   */
  getDuration(): number {
    if (!this.startTime) return 0;
    const now = this.mediaRecorder?.state === 'paused' ? this.pauseStartTime : Date.now();
    return Math.floor((now - this.startTime - this.pausedDuration) / 1000);
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return {
      isRecording: this.mediaRecorder?.state === 'recording',
      isPaused: this.mediaRecorder?.state === 'paused',
      duration: this.getDuration(),
      audioLevel: this.getAudioLevel(),
    };
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
    const apiKey = getAPIKey();
    const provider = getAIProvider();

    if (!apiKey) {
      throw new Error('No API key configured');
    }

    // Only OpenAI supports Whisper
    if (provider !== 'openai') {
      throw new Error('Transcription requires OpenAI API key');
    }

    // Convert blob to file for upload
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
    };
  }

  /**
   * Get supported MIME type for recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm';
  }

  /**
   * Get current audio level (0-1)
   */
  private getAudioLevel(): number {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average level
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    return average / 255;
  }

  /**
   * Start monitoring audio levels
   */
  private startLevelMonitoring(): void {
    const monitor = () => {
      if (this.mediaRecorder?.state === 'recording') {
        this.notifyStateChange();
      }
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.animationFrameId = requestAnimationFrame(monitor);
      }
    };
    monitor();
  }

  /**
   * Notify state change listener
   */
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.startTime = 0;
    this.pausedDuration = 0;
    this.onStateChange = null;
  }
}

// Singleton instance
export const audioRecorder = new AudioRecorderService();

/**
 * Format duration in MM:SS format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if transcription is available (OpenAI API key configured)
 */
export function isTranscriptionAvailable(): boolean {
  return getAIProvider() === 'openai' && !!getAPIKey();
}

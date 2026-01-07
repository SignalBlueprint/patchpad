/**
 * Silence Detection Service
 * Monitors audio input levels and detects silence for auto-paragraph splitting
 */

export interface SilenceDetectionOptions {
  /** Threshold below which audio is considered silence (0-1, default 0.01) */
  silenceThreshold?: number;
  /** Duration in ms of silence to trigger short pause (default 500ms) */
  shortPauseDuration?: number;
  /** Duration in ms of silence to trigger paragraph break (default 2000ms) */
  longPauseDuration?: number;
  /** Callback when a short pause is detected */
  onShortPause?: () => void;
  /** Callback when a long pause (paragraph break) is detected */
  onLongPause?: () => void;
  /** Callback with current audio level (0-1) */
  onAudioLevel?: (level: number) => void;
}

export class SilenceDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private silenceStartTime: number | null = null;
  private hasTriggeredShortPause = false;
  private hasTriggeredLongPause = false;
  private options: Required<SilenceDetectionOptions>;
  private isRunning = false;

  constructor(options: SilenceDetectionOptions = {}) {
    this.options = {
      silenceThreshold: options.silenceThreshold ?? 0.02,
      shortPauseDuration: options.shortPauseDuration ?? 500,
      longPauseDuration: options.longPauseDuration ?? 2000,
      onShortPause: options.onShortPause ?? (() => {}),
      onLongPause: options.onLongPause ?? (() => {}),
      onAudioLevel: options.onAudioLevel ?? (() => {}),
    };
  }

  /**
   * Start monitoring an audio stream for silence
   */
  async start(stream: MediaStream): Promise<void> {
    if (this.isRunning) {
      this.stop();
    }

    this.stream = stream;
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.3;
    source.connect(this.analyser);

    this.isRunning = true;
    this.silenceStartTime = null;
    this.hasTriggeredShortPause = false;
    this.hasTriggeredLongPause = false;

    this.monitorLoop();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.stream = null;
  }

  /**
   * Update options dynamically
   */
  updateOptions(options: Partial<SilenceDetectionOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current audio level (0-1)
   */
  private getAudioLevel(): number {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS (root mean square) for more accurate level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 255;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / dataArray.length);
  }

  /**
   * Main monitoring loop
   */
  private monitorLoop = (): void => {
    if (!this.isRunning) return;

    const level = this.getAudioLevel();
    this.options.onAudioLevel(level);

    const now = Date.now();
    const isSilent = level < this.options.silenceThreshold;

    if (isSilent) {
      // Start tracking silence if not already
      if (this.silenceStartTime === null) {
        this.silenceStartTime = now;
        this.hasTriggeredShortPause = false;
        this.hasTriggeredLongPause = false;
      }

      const silenceDuration = now - this.silenceStartTime;

      // Check for long pause first
      if (silenceDuration >= this.options.longPauseDuration && !this.hasTriggeredLongPause) {
        this.options.onLongPause();
        this.hasTriggeredLongPause = true;
        this.hasTriggeredShortPause = true; // Also mark short pause as triggered
      }
      // Check for short pause
      else if (silenceDuration >= this.options.shortPauseDuration && !this.hasTriggeredShortPause) {
        this.options.onShortPause();
        this.hasTriggeredShortPause = true;
      }
    } else {
      // Reset silence tracking when sound is detected
      this.silenceStartTime = null;
      this.hasTriggeredShortPause = false;
      this.hasTriggeredLongPause = false;
    }

    this.animationFrameId = requestAnimationFrame(this.monitorLoop);
  };
}

/**
 * Create a simple silence detector
 */
export function createSilenceDetector(options: SilenceDetectionOptions): SilenceDetector {
  return new SilenceDetector(options);
}

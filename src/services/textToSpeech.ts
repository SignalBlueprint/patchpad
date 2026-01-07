/**
 * Text-to-Speech Service using Web Speech Synthesis API
 */

let currentUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Check if text-to-speech is available
 */
export function isTTSAvailable(): boolean {
  return 'speechSynthesis' in window;
}

/**
 * Get available voices
 */
export function getVoices(): SpeechSynthesisVoice[] {
  if (!isTTSAvailable()) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Get the preferred voice (English, natural sounding)
 */
export function getPreferredVoice(): SpeechSynthesisVoice | null {
  const voices = getVoices();

  // Prefer Google or Microsoft voices, then any English voice
  const preferred = voices.find(v =>
    v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))
  );

  if (preferred) return preferred;

  // Fall back to any English voice
  const english = voices.find(v => v.lang.startsWith('en'));
  if (english) return english;

  // Fall back to first available voice
  return voices[0] || null;
}

/**
 * Speak text using Web Speech Synthesis
 */
export function speak(
  text: string,
  options?: {
    rate?: number; // 0.1 to 10, default 1
    pitch?: number; // 0 to 2, default 1
    voice?: SpeechSynthesisVoice;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
  }
): void {
  if (!isTTSAvailable()) {
    options?.onError?.('Text-to-speech is not available in this browser');
    return;
  }

  // Stop any current speech
  stop();

  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;

  // Apply options
  utterance.rate = options?.rate ?? 1;
  utterance.pitch = options?.pitch ?? 1;

  // Set voice
  const voice = options?.voice ?? getPreferredVoice();
  if (voice) {
    utterance.voice = voice;
  }

  // Event handlers
  utterance.onstart = () => {
    options?.onStart?.();
  };

  utterance.onend = () => {
    currentUtterance = null;
    options?.onEnd?.();
  };

  utterance.onerror = (event) => {
    currentUtterance = null;
    options?.onError?.(event.error);
  };

  // Start speaking
  window.speechSynthesis.speak(utterance);
}

/**
 * Stop current speech
 */
export function stop(): void {
  if (!isTTSAvailable()) return;
  window.speechSynthesis.cancel();
  currentUtterance = null;
}

/**
 * Check if currently speaking
 */
export function isSpeaking(): boolean {
  if (!isTTSAvailable()) return false;
  return window.speechSynthesis.speaking;
}

/**
 * Pause current speech
 */
export function pause(): void {
  if (!isTTSAvailable()) return;
  window.speechSynthesis.pause();
}

/**
 * Resume paused speech
 */
export function resume(): void {
  if (!isTTSAvailable()) return;
  window.speechSynthesis.resume();
}

import { useState, useEffect } from 'react';
import { getTranscriptionPreferences, savePreferences, type QualityPreference } from '../services/transcription';

interface TranscriptionSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Common languages for speech recognition
const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'en-AU', name: 'English (Australia)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'fr-FR', name: 'French (France)' },
  { code: 'fr-CA', name: 'French (Canada)' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'nl-NL', name: 'Dutch' },
  { code: 'pl-PL', name: 'Polish' },
  { code: 'sv-SE', name: 'Swedish' },
  { code: 'da-DK', name: 'Danish' },
  { code: 'no-NO', name: 'Norwegian' },
  { code: 'fi-FI', name: 'Finnish' },
];

export function TranscriptionSettingsDialog({ isOpen, onClose }: TranscriptionSettingsDialogProps) {
  const [language, setLanguage] = useState('en-US');
  const [preferLocalTranscription, setPreferLocalTranscription] = useState(false);
  const [qualityPreference, setQualityPreference] = useState<QualityPreference>('balanced');
  const [storeOriginalAudio, setStoreOriginalAudio] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load current preferences on mount
  useEffect(() => {
    if (isOpen) {
      const prefs = getTranscriptionPreferences();
      setLanguage(prefs.language);
      setPreferLocalTranscription(prefs.preferLocalTranscription);
      setQualityPreference(prefs.qualityPreference);
      setStoreOriginalAudio(prefs.storeOriginalAudio);
      setHasChanges(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = () => {
    savePreferences({ language, preferLocalTranscription, qualityPreference, storeOriginalAudio });
    setHasChanges(false);
    onClose();
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    setHasChanges(true);
  };

  const handleLocalTranscriptionChange = (value: boolean) => {
    setPreferLocalTranscription(value);
    setHasChanges(true);
  };

  const handleQualityChange = (value: QualityPreference) => {
    setQualityPreference(value);
    setHasChanges(true);
  };

  const handleStoreAudioChange = (value: boolean) => {
    setStoreOriginalAudio(value);
    setHasChanges(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Transcription Settings
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure voice recording and transcription preferences
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Language Selection */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
              Transcription Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select the language you'll be speaking in for voice notes
            </p>
          </div>

          {/* Local Transcription Toggle */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="localTranscription" className="block text-sm font-medium text-gray-700">
                  Use Local Transcription
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Keep audio data on your device (browser-based, less accurate)
                </p>
              </div>
              <button
                id="localTranscription"
                type="button"
                onClick={() => handleLocalTranscriptionChange(!preferLocalTranscription)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  preferLocalTranscription ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={preferLocalTranscription}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    preferLocalTranscription ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {preferLocalTranscription && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  <strong>Note:</strong> Browser-based transcription only works for real-time dictation,
                  not recorded audio. For voice notes, OpenAI Whisper will still be used if available.
                </p>
              </div>
            )}
          </div>

          {/* Quality vs Speed Preference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcription Quality
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="quality"
                  value="speed"
                  checked={qualityPreference === 'speed'}
                  onChange={() => handleQualityChange('speed')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Fast</div>
                  <div className="text-xs text-gray-500">Quick transcription, may miss some words</div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="quality"
                  value="balanced"
                  checked={qualityPreference === 'balanced'}
                  onChange={() => handleQualityChange('balanced')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Balanced (Recommended)</div>
                  <div className="text-xs text-gray-500">Good accuracy with reasonable speed</div>
                </div>
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="quality"
                  value="quality"
                  checked={qualityPreference === 'quality'}
                  onChange={() => handleQualityChange('quality')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">High Quality</div>
                  <div className="text-xs text-gray-500">Best accuracy, slower processing</div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </label>
            </div>
          </div>

          {/* Store Original Audio Toggle */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="storeAudio" className="block text-sm font-medium text-gray-700">
                  Store Original Audio
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Save recordings for playback in voice notes
                </p>
              </div>
              <button
                id="storeAudio"
                type="button"
                onClick={() => handleStoreAudioChange(!storeOriginalAudio)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  storeOriginalAudio ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={storeOriginalAudio}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    storeOriginalAudio ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {storeOriginalAudio && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  Audio files will be stored locally. This uses more storage but allows you to
                  replay your original recordings from voice notes.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAudioForNote, type AudioRecord } from '../services/audioStorage';
import { formatDuration } from '../services/audio';

interface AudioPlaybackButtonProps {
  noteId: string;
}

export function AudioPlaybackButton({ noteId }: AudioPlaybackButtonProps) {
  const [audioRecord, setAudioRecord] = useState<AudioRecord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Load audio record for this note
  useEffect(() => {
    let mounted = true;

    const loadAudio = async () => {
      setIsLoading(true);
      try {
        const record = await getAudioForNote(noteId);
        if (mounted) {
          setAudioRecord(record || null);
        }
      } catch (err) {
        console.error('Failed to load audio:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadAudio();

    return () => {
      mounted = false;
      // Cleanup audio URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [noteId]);

  // Setup audio element when record changes
  useEffect(() => {
    if (!audioRecord) return;

    // Cleanup previous URL
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }

    // Create new URL
    audioUrlRef.current = URL.createObjectURL(audioRecord.blob);

    // Create audio element
    const audio = new Audio(audioUrlRef.current);
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    audio.addEventListener('pause', () => {
      setIsPlaying(false);
    });

    audio.addEventListener('play', () => {
      setIsPlaying(true);
    });

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioRecord]);

  const handleTogglePlayback = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  // Don't render if no audio
  if (isLoading || !audioRecord) {
    return null;
  }

  const duration = audioRecord.duration;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
      {/* Play/Pause button */}
      <button
        onClick={handleTogglePlayback}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-full hover:bg-secondary-600 transition-colors"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-secondary-600 font-mono w-10">
          {formatDuration(Math.floor(currentTime))}
        </span>
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          style={{
            background: `linear-gradient(to right, rgb(99 102 241) ${progress}%, rgb(199 210 254) ${progress}%)`
          }}
        />
        <span className="text-xs text-secondary-600 font-mono w-10 text-right">
          {formatDuration(Math.floor(duration))}
        </span>
      </div>

      {/* Audio icon */}
      <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    </div>
  );
}

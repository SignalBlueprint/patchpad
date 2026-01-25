/**
 * Session Player Component
 *
 * UI for playing back recorded thinking sessions.
 * Features playback controls, timeline scrubber, and event visualization.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ThinkingSession, ThinkingEvent } from '../types/session';
import {
  SessionPlayer as Player,
  PlaybackState,
  PlaybackPosition,
  formatDuration,
  getEventDensity,
} from '../services/sessionPlayback';
import { CanvasReplayRenderer } from './Canvas/CanvasReplayRenderer';

interface SessionPlayerProps {
  session: ThinkingSession;
  onClose: () => void;
  onNoteMove?: (noteId: string, x: number, y: number) => void;
  onNoteCreate?: (noteId: string, title: string, x: number, y: number) => void;
  onNoteDelete?: (noteId: string) => void;
  onViewportChange?: (x: number, y: number, zoom: number) => void;
}

export function SessionPlayer({
  session,
  onClose,
  onNoteMove,
  onNoteCreate,
  onNoteDelete,
  onViewportChange,
}: SessionPlayerProps) {
  const [state, setState] = useState<PlaybackState>('stopped');
  const [position, setPosition] = useState<PlaybackPosition>({
    currentTime: 0,
    totalTime: session.durationMs,
    eventIndex: 0,
    totalEvents: session.events.length,
    progress: 0,
  });
  const [speed, setSpeed] = useState(1);
  const [currentEvent, setCurrentEvent] = useState<ThinkingEvent | null>(null);
  const [annotation, setAnnotation] = useState<string | null>(null);
  const [showEventLog, setShowEventLog] = useState(false);
  const [eventLog, setEventLog] = useState<ThinkingEvent[]>([]);

  const playerRef = useRef<Player | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Initialize player
  useEffect(() => {
    playerRef.current = new Player(session, {
      onStateChange: setState,
      onPositionChange: setPosition,
      onEvent: (event) => {
        setCurrentEvent(event);
        setEventLog((log) => [...log.slice(-49), event]);
      },
      onNoteMove,
      onNoteCreate,
      onNoteDelete,
      onViewportChange,
      onAnnotation: (_, content) => {
        setAnnotation(content);
        setTimeout(() => setAnnotation(null), 3000);
      },
    });

    return () => {
      playerRef.current?.destroy();
    };
  }, [session, onNoteMove, onNoteCreate, onNoteDelete, onViewportChange]);

  // Event density for timeline visualization
  const density = getEventDensity(session, 100);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    if (state === 'playing') {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  }, [state]);

  const handleStop = useCallback(() => {
    playerRef.current?.stop();
    setEventLog([]);
    setCurrentEvent(null);
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    playerRef.current?.setSpeed(newSpeed);
  }, []);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || !playerRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const progress = (e.clientX - rect.left) / rect.width;
      playerRef.current.seekToProgress(Math.max(0, Math.min(1, progress)));
    },
    []
  );

  const handlePrevEvent = useCallback(() => {
    playerRef.current?.previousEvent();
  }, []);

  const handleNextEvent = useCallback(() => {
    playerRef.current?.nextEvent();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevEvent();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextEvent();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handlePrevEvent, handleNextEvent, onClose]);

  const getEventIcon = (type: ThinkingEvent['type']) => {
    switch (type) {
      case 'note-move':
        return '↔️';
      case 'note-create':
        return '📝';
      case 'note-edit':
        return '✏️';
      case 'note-delete':
        return '🗑️';
      case 'note-connect':
        return '🔗';
      case 'viewport-change':
        return '🔍';
      case 'ai-query':
        return '🤖';
      case 'ai-response':
        return '💬';
      case 'selection-change':
        return '📋';
      default:
        return '•';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[800px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Session Playback
            </h2>
            <p className="text-sm text-gray-500">
              {session.title || 'Untitled Session'} •{' '}
              {new Date(session.startTime).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Timeline */}
        <div className="px-6 py-4 border-b border-gray-100">
          {/* Time display */}
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>{formatDuration(position.currentTime)}</span>
            <span>
              Event {position.eventIndex}/{position.totalEvents}
            </span>
            <span>{formatDuration(position.totalTime)}</span>
          </div>

          {/* Timeline bar */}
          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            className="relative h-8 bg-gray-100 rounded-lg cursor-pointer overflow-hidden"
          >
            {/* Event density visualization */}
            <div className="absolute inset-0 flex items-end">
              {density.map((d, i) => (
                <div
                  key={i}
                  className="flex-1 bg-blue-200"
                  style={{ height: `${d * 100}%` }}
                />
              ))}
            </div>

            {/* Progress bar */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-blue-500/30"
              style={{ width: `${position.progress * 100}%` }}
            />

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-600"
              style={{ left: `${position.progress * 100}%` }}
            />

            {/* Annotation markers */}
            {session.annotations.map((ann, i) => (
              <div
                key={i}
                className="absolute top-0 w-1 h-2 bg-yellow-500"
                style={{
                  left: `${(ann.timestamp / session.durationMs) * 100}%`,
                }}
                title={ann.content}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-center gap-4">
            {/* Previous event */}
            <button
              onClick={handlePrevEvent}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Previous event (←)"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Stop */}
            <button
              onClick={handleStop}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Stop"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-lg"
              title={state === 'playing' ? 'Pause (Space)' : 'Play (Space)'}
            >
              {state === 'playing' ? (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Next event */}
            <button
              onClick={handleNextEvent}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Next event (→)"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Speed selector */}
            <div className="flex items-center gap-1 ml-4">
              {[0.5, 1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-2 py-1 text-sm rounded ${
                    speed === s
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Toggle event log */}
            <button
              onClick={() => setShowEventLog(!showEventLog)}
              className={`p-2 rounded-lg ml-4 ${
                showEventLog
                  ? 'bg-gray-200 text-gray-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Toggle event log"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Current event display */}
        <div className="px-6 py-4 flex-1 overflow-hidden flex flex-col">
          {/* Canvas Replay Renderer */}
          <div className="mb-4">
            <CanvasReplayRenderer
              session={session}
              currentEvent={currentEvent}
              currentTime={position.currentTime}
              progress={position.progress}
            />
          </div>

          {/* Annotation overlay */}
          {annotation && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
              📝 {annotation}
            </div>
          )}

          {/* Current event */}
          {currentEvent && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{getEventIcon(currentEvent.type)}</span>
                <span className="font-medium text-blue-900">
                  {currentEvent.type.replace('-', ' ')}
                </span>
                <span className="text-sm text-blue-600">
                  {formatDuration(currentEvent.timestamp)}
                </span>
              </div>
              <pre className="text-sm text-blue-800 whitespace-pre-wrap">
                {JSON.stringify(currentEvent.payload, null, 2)}
              </pre>
            </div>
          )}

          {/* Event log */}
          {showEventLog && (
            <div className="flex-1 overflow-auto">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Event Log
              </h4>
              <div className="space-y-1">
                {eventLog.map((event, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded"
                  >
                    <span>{getEventIcon(event.type)}</span>
                    <span className="text-gray-600">
                      {formatDuration(event.timestamp)}
                    </span>
                    <span className="text-gray-900">{event.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session stats */}
          {!showEventLog && (
            <div className="flex-1 flex items-center justify-center">
              <div className="grid grid-cols-3 gap-8 text-center">
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {session.stats.notesCreated}
                  </p>
                  <p className="text-sm text-gray-500">Notes Created</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {session.stats.notesEdited}
                  </p>
                  <p className="text-sm text-gray-500">Notes Edited</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {session.stats.aiQueries}
                  </p>
                  <p className="text-sm text-gray-500">AI Queries</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl text-center text-sm text-gray-500">
          Press Space to play/pause • Arrow keys to step through events • Esc to
          close
        </div>
      </div>
    </div>
  );
}

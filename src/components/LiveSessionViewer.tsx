/**
 * Live Session Viewer
 *
 * Component for watching live thinking session broadcasts.
 * Shows canvas visualization, viewer list, and chat sidebar.
 */

import { useState, useEffect, useRef } from 'react';
import {
  type BroadcastState,
  type BroadcastViewer,
  type BroadcastMessage,
  joinBroadcast,
  leaveBroadcast,
  sendChatMessage,
  on,
} from '../services/liveBroadcast';
import type { ThinkingEvent, CanvasSnapshot } from '../types/session';

interface LiveSessionViewerProps {
  sessionId: string;
  onClose: () => void;
}

export function LiveSessionViewer({ sessionId, onClose }: LiveSessionViewerProps) {
  const [broadcast, setBroadcast] = useState<BroadcastState | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [viewers, setViewers] = useState<BroadcastViewer[]>([]);
  const [snapshot, setSnapshot] = useState<CanvasSnapshot | null>(null);
  const [events, setEvents] = useState<ThinkingEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Subscribe to broadcast events
  useEffect(() => {
    if (!hasJoined) return;

    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      on('session-event', (event) => {
        setEvents(prev => [...prev, event as ThinkingEvent]);
      })
    );

    unsubscribers.push(
      on('snapshot-update', (newSnapshot) => {
        setSnapshot(newSnapshot as CanvasSnapshot);
      })
    );

    unsubscribers.push(
      on('chat-message', (message) => {
        setMessages(prev => [...prev, message as BroadcastMessage]);
      })
    );

    unsubscribers.push(
      on('viewer-join', (viewer) => {
        setViewers(prev => [...prev, viewer as BroadcastViewer]);
      })
    );

    unsubscribers.push(
      on('viewer-leave', ({ viewerId: leftId }) => {
        setViewers(prev => prev.filter(v => v.id !== leftId));
      })
    );

    unsubscribers.push(
      on('broadcast-end', () => {
        setError('The broadcast has ended');
      })
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [hasJoined]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle join
  async function handleJoin() {
    if (!viewerName.trim()) return;

    setIsJoining(true);
    setError(null);

    try {
      const state = await joinBroadcast(sessionId, viewerName.trim());
      if (state) {
        setBroadcast(state);
        setSnapshot(state.currentSnapshot);
        setMessages(state.messages);
        setViewers(state.viewers);
        setViewerId(state.hostId); // Will be replaced by actual viewer ID
        setHasJoined(true);
      } else {
        setError('Failed to join broadcast. It may have ended or is not available.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join broadcast');
    }

    setIsJoining(false);
  }

  // Handle leave
  function handleLeave() {
    if (viewerId) {
      leaveBroadcast(viewerId);
    }
    onClose();
  }

  // Handle send message
  function handleSendMessage() {
    if (!chatInput.trim() || !viewerId) return;

    sendChatMessage(chatInput.trim(), viewerId, viewerName);
    setChatInput('');
  }

  // Render canvas visualization
  function renderCanvas() {
    if (!snapshot) {
      return (
        <div className="flex items-center justify-center h-full text-neutral-400">
          Waiting for canvas data...
        </div>
      );
    }

    return (
      <div className="relative w-full h-full bg-gray-900 overflow-hidden">
        {/* Notes on canvas */}
        {snapshot.notes?.map((note, index) => {
          const position = snapshot.positions[note.id] || { x: index * 50, y: index * 50 };
          return (
            <div
              key={note.id}
              className="absolute p-3 bg-yellow-100 rounded-lg shadow-lg border border-yellow-200 max-w-xs"
              style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <h4 className="font-medium text-sm text-gray-800 truncate">
                {note.title || 'Untitled'}
              </h4>
              <p className="text-xs text-neutral-600 mt-1 line-clamp-3">
                {note.content.slice(0, 150)}
              </p>
            </div>
          );
        })}

        {/* Connection lines */}
        <svg className="absolute inset-0 pointer-events-none">
          {snapshot.connections?.map((conn, i) => {
            const sourcePos = snapshot.positions[conn.sourceId];
            const targetPos = snapshot.positions[conn.targetId];
            if (!sourcePos || !targetPos) return null;

            return (
              <line
                key={i}
                x1={sourcePos.x}
                y1={sourcePos.y}
                x2={targetPos.x}
                y2={targetPos.y}
                stroke="rgba(99, 102, 241, 0.5)"
                strokeWidth={2}
              />
            );
          })}
        </svg>

        {/* Event indicator */}
        {events.length > 0 && (
          <div className="absolute bottom-4 left-4 px-3 py-1 bg-secondary-600 text-white text-xs rounded-full">
            {events.length} events
          </div>
        )}
      </div>
    );
  }

  // Join screen
  if (!hasJoined) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Join Live Session</h2>
            <p className="text-sm text-neutral-400 mt-1">Watch a thinking session in real-time</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={viewerName}
                onChange={(e) => setViewerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={isJoining || !viewerName.trim()}
                className="flex-1 px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isJoining ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Session'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main viewer UI
  return (
    <div className="fixed inset-0 z-50 flex bg-gray-900">
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-error-600 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span className="text-xs font-medium text-white">LIVE</span>
              </div>
              <div>
                <h1 className="text-sm font-semibold text-white">
                  {broadcast?.title || 'Thinking Session'}
                </h1>
                <p className="text-xs text-neutral-400">
                  Hosted by {broadcast?.hostName || 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {viewers.length} watching
              </div>
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`p-2 rounded-lg transition-colors ${
                  isChatOpen ? 'bg-secondary-600 text-white' : 'bg-gray-700 text-neutral-400 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
              <button
                onClick={handleLeave}
                className="px-3 py-1.5 bg-error-600 text-white text-sm rounded-lg hover:bg-error-700 transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </header>

        {/* Canvas area */}
        <div ref={canvasRef} className="flex-1 overflow-hidden">
          {renderCanvas()}
        </div>

        {/* Event log */}
        <div className="bg-gray-800 border-t border-gray-700 p-2 max-h-24 overflow-y-auto">
          <div className="flex flex-wrap gap-1">
            {events.slice(-10).map((event, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
              >
                {event.type}
              </span>
            ))}
            {events.length === 0 && (
              <span className="text-xs text-neutral-500">Waiting for events...</span>
            )}
          </div>
        </div>
      </div>

      {/* Chat sidebar */}
      {isChatOpen && (
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-white">Live Chat</h3>
          </div>

          {/* Viewers list */}
          <div className="px-4 py-2 border-b border-gray-700">
            <div className="text-xs text-neutral-400 mb-2">Viewers ({viewers.length})</div>
            <div className="flex flex-wrap gap-1">
              {viewers.slice(0, 10).map((viewer) => (
                <span
                  key={viewer.id}
                  className="px-2 py-0.5 text-xs rounded-full"
                  style={{ backgroundColor: viewer.color + '40', color: viewer.color }}
                >
                  {viewer.name}
                </span>
              ))}
              {viewers.length > 10 && (
                <span className="px-2 py-0.5 text-xs bg-gray-700 text-neutral-400 rounded-full">
                  +{viewers.length - 10}
                </span>
              )}
            </div>
          </div>

          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {messages.map((message) => (
              <div key={message.id} className="text-sm">
                <span
                  className="font-medium"
                  style={{ color: '#4ECDC4' }}
                >
                  {message.viewerName}
                </span>
                <span className="text-gray-300 ml-2">{message.content}</span>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-center text-neutral-500 text-sm py-8">
                No messages yet. Say hi!
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-900/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Broadcast Ended</h3>
            <p className="text-neutral-400 text-sm mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

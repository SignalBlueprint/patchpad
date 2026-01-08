/**
 * Collaboration Controls Component
 *
 * UI for starting, joining, and managing collaboration rooms.
 * Displays connection status and peer list.
 */

import { useState, useEffect } from 'react';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getCurrentRoomId,
  isInRoom,
  isRoomConnected,
  getRoomPeers,
  onRoomPeersChange,
  onRoomConnectionChange,
  type Peer,
} from '../services/collaboration';

interface CollaborationControlsProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
  onCollaborationStart: (roomId: string) => void;
  onCollaborationEnd: () => void;
}

export function CollaborationControls({
  isOpen,
  onClose,
  userId,
  userName,
  onCollaborationStart,
  onCollaborationEnd,
}: CollaborationControlsProps) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to collaboration events
  useEffect(() => {
    const unsubPeers = onRoomPeersChange(setPeers);
    const unsubConnection = onRoomConnectionChange(setIsConnected);

    // Check initial state
    setCurrentRoomId(getCurrentRoomId());
    setIsConnected(isRoomConnected());
    setPeers(getRoomPeers());

    return () => {
      unsubPeers();
      unsubConnection();
    };
  }, []);

  const handleStartCollaboration = () => {
    setError(null);
    try {
      const roomId = createRoom(userId, userName);
      setCurrentRoomId(roomId);
      onCollaborationStart(roomId);
    } catch (err) {
      setError('Failed to start collaboration. Please try again.');
      console.error('Failed to create room:', err);
    }
  };

  const handleJoinCollaboration = () => {
    if (!joinRoomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    setError(null);
    try {
      const success = joinRoom(joinRoomId.trim().toLowerCase(), userId, userName);
      if (success) {
        setCurrentRoomId(joinRoomId.trim().toLowerCase());
        onCollaborationStart(joinRoomId.trim().toLowerCase());
        setJoinRoomId('');
      } else {
        setError('Failed to join room. Please check the room ID.');
      }
    } catch (err) {
      setError('Failed to join room. Please try again.');
      console.error('Failed to join room:', err);
    }
  };

  const handleEndCollaboration = () => {
    leaveRoom();
    setCurrentRoomId(null);
    setPeers([]);
    setIsConnected(false);
    onCollaborationEnd();
  };

  const handleCopyLink = () => {
    if (currentRoomId) {
      const link = `${window.location.origin}/collab/${currentRoomId}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyRoomId = () => {
    if (currentRoomId) {
      navigator.clipboard.writeText(currentRoomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  const inActiveRoom = isInRoom() && currentRoomId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-500 to-purple-500">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Collaboration
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {inActiveRoom ? (
            // Active collaboration state
            <div className="space-y-6">
              {/* Connection status */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                <div>
                  <p className="font-medium text-gray-800">
                    {isConnected ? 'Connected' : 'Connecting...'}
                  </p>
                  <p className="text-sm text-gray-500">Room: {currentRoomId}</p>
                </div>
              </div>

              {/* Share link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Share this link with collaborators
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/collab/${currentRoomId}`}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-600"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Or share the room ID: <button onClick={handleCopyRoomId} className="font-mono text-indigo-600 hover:underline">{currentRoomId}</button>
                </p>
              </div>

              {/* Peers */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Collaborators ({peers.length + 1})
                </h3>
                <div className="space-y-2">
                  {/* Self */}
                  <div className="flex items-center gap-3 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: '#6366f1' }}
                    >
                      {(userName || 'You').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-800">
                      {userName || 'You'} <span className="text-gray-400">(you)</span>
                    </span>
                  </div>

                  {/* Other peers */}
                  {peers.map(peer => (
                    <div key={peer.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: peer.color }}
                      >
                        {peer.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-700">{peer.name}</span>
                    </div>
                  ))}

                  {peers.length === 0 && (
                    <p className="text-sm text-gray-500 italic">
                      Waiting for others to join...
                    </p>
                  )}
                </div>
              </div>

              {/* End collaboration button */}
              <button
                onClick={handleEndCollaboration}
                className="w-full py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                End Collaboration
              </button>
            </div>
          ) : (
            // Not in a room - show options to start or join
            <div className="space-y-6">
              {/* Start new collaboration */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Start New Session</h3>
                <button
                  onClick={handleStartCollaboration}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Start Collaboration
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Create a new room and invite others to join.
                </p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              {/* Join existing room */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Join Existing Room</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinCollaboration()}
                    placeholder="Enter room ID..."
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                  <button
                    onClick={handleJoinCollaboration}
                    disabled={!joinRoomId.trim()}
                    className="px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Join
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Enter the room ID shared by the host.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

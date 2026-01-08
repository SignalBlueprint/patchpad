/**
 * Follow Mode Indicator
 *
 * Shows when following another user's cursor position.
 * Auto-scrolls to their cursor location and disables on manual scroll.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Peer } from '../services/collaboration';

interface FollowModeIndicatorProps {
  /** The peer being followed (null if not following) */
  followingPeer: Peer | null;
  /** Callback when user wants to stop following */
  onStopFollowing: () => void;
  /** Callback to scroll editor to position */
  onScrollToPosition?: (line: number, ch: number) => void;
}

export function FollowModeIndicator({
  followingPeer,
  onStopFollowing,
  onScrollToPosition,
}: FollowModeIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const lastCursorRef = useRef<{ line: number; ch: number } | null>(null);

  // Show indicator when following
  useEffect(() => {
    if (followingPeer) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [followingPeer]);

  // Scroll to peer's cursor when it changes
  useEffect(() => {
    if (!followingPeer?.cursor || !onScrollToPosition) return;

    const { line, ch } = followingPeer.cursor;

    // Only scroll if cursor actually moved
    if (
      lastCursorRef.current?.line !== line ||
      lastCursorRef.current?.ch !== ch
    ) {
      lastCursorRef.current = { line, ch };
      onScrollToPosition(line, ch);
    }
  }, [followingPeer?.cursor, onScrollToPosition]);

  if (!isVisible || !followingPeer) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div
        className="flex items-center gap-3 px-4 py-2 rounded-full shadow-lg border"
        style={{
          backgroundColor: `${followingPeer.color}15`,
          borderColor: `${followingPeer.color}40`,
        }}
      >
        {/* Peer avatar */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
          style={{ backgroundColor: followingPeer.color }}
        >
          {followingPeer.name.charAt(0).toUpperCase()}
        </div>

        {/* Following text */}
        <span className="text-sm text-gray-700">
          Following <span className="font-medium">{followingPeer.name}</span>
        </span>

        {/* Stop button */}
        <button
          onClick={onStopFollowing}
          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-white/50 rounded transition-colors"
        >
          Stop
        </button>
      </div>
    </div>
  );
}

interface FollowMenuProps {
  /** List of peers that can be followed */
  peers: Peer[];
  /** Currently following peer (null if not following) */
  followingPeerId: string | null;
  /** Callback when selecting a peer to follow */
  onFollow: (peerId: string) => void;
  /** Callback to stop following */
  onStopFollowing: () => void;
}

/**
 * Dropdown menu for selecting a peer to follow
 */
export function FollowMenu({
  peers,
  followingPeerId,
  onFollow,
  onStopFollowing,
}: FollowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const followablePeers = peers.filter((p) => p.cursor); // Only peers with cursor positions

  if (followablePeers.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg transition-colors ${
          followingPeerId
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-500 hover:bg-gray-100'
        }`}
        title={followingPeerId ? 'Following' : 'Follow a collaborator'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase">
            Follow
          </div>
          {followablePeers.map((peer) => (
            <button
              key={peer.id}
              onClick={() => {
                if (followingPeerId === peer.id) {
                  onStopFollowing();
                } else {
                  onFollow(peer.id);
                }
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                followingPeerId === peer.id ? 'bg-blue-50' : ''
              }`}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: peer.color }}
              >
                {peer.name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-sm text-left text-gray-700">
                {peer.name}
              </span>
              {followingPeerId === peer.id && (
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
          {followingPeerId && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => {
                  onStopFollowing();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors"
              >
                Stop following
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage follow mode with scroll detection
 */
export function useFollowMode(peers: Peer[]) {
  const [followingPeerId, setFollowingPeerId] = useState<string | null>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const followingPeer = peers.find((p) => p.id === followingPeerId) || null;

  // Stop following on user scroll
  const handleUserScroll = useCallback(() => {
    if (followingPeerId && !userScrolled) {
      // Debounce to avoid stopping on programmatic scrolls
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setUserScrolled(true);
        setFollowingPeerId(null);
      }, 100);
    }
  }, [followingPeerId, userScrolled]);

  const startFollowing = useCallback((peerId: string) => {
    setFollowingPeerId(peerId);
    setUserScrolled(false);
  }, []);

  const stopFollowing = useCallback(() => {
    setFollowingPeerId(null);
    setUserScrolled(false);
  }, []);

  // Stop following if peer disconnects
  useEffect(() => {
    if (followingPeerId && !peers.find((p) => p.id === followingPeerId)) {
      stopFollowing();
    }
  }, [peers, followingPeerId, stopFollowing]);

  return {
    followingPeer,
    followingPeerId,
    startFollowing,
    stopFollowing,
    handleUserScroll,
  };
}

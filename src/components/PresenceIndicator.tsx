/**
 * Presence Indicator Component
 *
 * Shows avatars/initials of users currently editing a note.
 * Displays in the Editor header area.
 */

import type { Peer } from '../services/collaboration';

interface PresenceIndicatorProps {
  /** List of peers currently editing */
  peers: Peer[];
  /** Whether connected to the collaboration server */
  isConnected: boolean;
  /** Maximum avatars to show before "+N" */
  maxVisible?: number;
}

/**
 * Get initials from a name
 */
function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function PresenceIndicator({
  peers,
  isConnected,
  maxVisible = 4,
}: PresenceIndicatorProps) {
  if (!isConnected && peers.length === 0) {
    return null;
  }

  const visiblePeers = peers.slice(0, maxVisible);
  const hiddenCount = Math.max(0, peers.length - maxVisible);

  return (
    <div className="flex items-center gap-1">
      {/* Connection status dot */}
      <div
        className={`w-2 h-2 rounded-full mr-1 ${
          isConnected ? 'bg-green-400' : 'bg-amber-400 animate-pulse'
        }`}
        title={isConnected ? 'Connected' : 'Connecting...'}
      />

      {/* Peer avatars */}
      <div className="flex -space-x-2">
        {visiblePeers.map((peer) => (
          <div
            key={peer.id}
            className="relative group"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-white shadow-sm transition-transform hover:scale-110 hover:z-10"
              style={{ backgroundColor: peer.color }}
              title={peer.name}
            >
              {getInitials(peer.name)}
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {peer.name}
              {peer.cursor && (
                <span className="text-gray-400 ml-1">
                  (editing)
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Hidden count badge */}
        {hiddenCount > 0 && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 bg-gray-200 border-2 border-white"
            title={`${hiddenCount} more ${hiddenCount === 1 ? 'person' : 'people'}`}
          >
            +{hiddenCount}
          </div>
        )}
      </div>

      {/* Peer count label */}
      {peers.length > 0 && (
        <span className="ml-2 text-xs text-gray-500">
          {peers.length} {peers.length === 1 ? 'person' : 'people'} editing
        </span>
      )}
    </div>
  );
}

/**
 * Sync Status Indicator
 *
 * Shows the current sync status in the UI.
 * Displays online/offline state, sync progress, and pending changes.
 */

import { useSync } from '../hooks/useSync';
import { useAuth } from '../context/AuthContext';

interface SyncStatusIndicatorProps {
  onClick?: () => void;
}

export function SyncStatusIndicator({ onClick }: SyncStatusIndicatorProps) {
  const { user, isConfigured } = useAuth();
  const { isEnabled, isOnline, status, pendingCount, lastSyncTime } = useSync();

  // Don't show if not configured
  if (!isConfigured) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
        title="Set up cloud sync"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
        <span className="hidden sm:inline">Enable sync</span>
      </button>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
        title="Sign in to sync"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';

    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return lastSyncTime.toLocaleDateString();
  };

  // Determine icon and color based on status
  const getStatusDisplay = () => {
    if (!isOnline) {
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
          </svg>
        ),
        color: 'text-neutral-400',
        bgColor: 'bg-neutral-100',
        label: 'Offline',
      };
    }

    switch (status) {
      case 'syncing':
        return {
          icon: (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ),
          color: 'text-primary-600',
          bgColor: 'bg-blue-50',
          label: 'Syncing...',
        };

      case 'error':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-error-600',
          bgColor: 'bg-red-50',
          label: 'Sync error',
        };

      default:
        if (pendingCount > 0) {
          return {
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ),
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-50',
            label: `${pendingCount} pending`,
          };
        }

        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          color: 'text-success-600',
          bgColor: 'bg-green-50',
          label: 'Synced',
        };
    }
  };

  const { icon, color, bgColor, label } = getStatusDisplay();

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm ${color} ${bgColor} rounded-lg hover:opacity-80 transition-opacity`}
      title={`Last sync: ${formatLastSync()}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {pendingCount > 0 && status !== 'syncing' && (
        <span className="px-1.5 py-0.5 text-xs bg-yellow-200 text-yellow-800 rounded-full">
          {pendingCount}
        </span>
      )}
    </button>
  );
}

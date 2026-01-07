/**
 * Sync Settings Dialog
 *
 * Allows users to configure Supabase credentials and view sync status.
 */

import { useState, useCallback, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { configureSupabase, clearSupabaseConfig, isSupabaseConfigured, SETUP_SQL } from '../../config/supabase';

interface SyncSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
}

export function SyncSettingsDialog({ isOpen, onClose, onOpenLogin }: SyncSettingsDialogProps) {
  const { user, isConfigured, signOut } = useAuth();
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const handleSaveConfig = useCallback((e: FormEvent) => {
    e.preventDefault();

    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      return;
    }

    configureSupabase(supabaseUrl.trim(), supabaseKey.trim());
    setConfigSaved(true);
    setSupabaseUrl('');
    setSupabaseKey('');

    // Reload after a short delay to reinitialize
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }, [supabaseUrl, supabaseKey]);

  const handleClearConfig = useCallback(() => {
    if (confirm('This will remove your Supabase configuration and sign you out. Continue?')) {
      clearSupabaseConfig();
      window.location.reload();
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const handleCopySql = useCallback(() => {
    navigator.clipboard.writeText(SETUP_SQL);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Sync Settings</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current status */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Supabase configured:</span>
                <span className={isConfigured ? 'text-green-600 font-medium' : 'text-gray-400'}>
                  {isConfigured ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Signed in as:</span>
                <span className={user ? 'text-green-600 font-medium' : 'text-gray-400'}>
                  {user ? user.email : 'Not signed in'}
                </span>
              </div>
            </div>

            {/* Sign in / Sign out buttons */}
            <div className="mt-4 flex gap-2">
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Sign Out
                </button>
              ) : isConfigured ? (
                <button
                  onClick={() => { onClose(); onOpenLogin(); }}
                  className="px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Sign In
                </button>
              ) : null}

              {isConfigured && (
                <button
                  onClick={handleClearConfig}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear Configuration
                </button>
              )}
            </div>
          </div>

          {/* Configuration form (only show if not configured) */}
          {!isConfigured && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Configure Supabase</h3>
                <p className="text-sm text-gray-500 mb-4">
                  To enable cloud sync, you need a Supabase project.{' '}
                  <a
                    href="https://supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    Create one for free
                  </a>
                </p>

                {configSaved ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
                    Configuration saved! Reloading...
                  </div>
                ) : (
                  <form onSubmit={handleSaveConfig} className="space-y-3">
                    <div>
                      <label htmlFor="supabaseUrl" className="block text-sm text-gray-600 mb-1">
                        Supabase URL
                      </label>
                      <input
                        id="supabaseUrl"
                        type="url"
                        value={supabaseUrl}
                        onChange={(e) => setSupabaseUrl(e.target.value)}
                        placeholder="https://your-project.supabase.co"
                        required
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="supabaseKey" className="block text-sm text-gray-600 mb-1">
                        Anon Key
                      </label>
                      <input
                        id="supabaseKey"
                        type="password"
                        value={supabaseKey}
                        onChange={(e) => setSupabaseKey(e.target.value)}
                        placeholder="eyJ..."
                        required
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Find this in your Supabase dashboard under Settings &gt; API
                      </p>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Save Configuration
                    </button>
                  </form>
                )}
              </div>

              {/* Database setup SQL */}
              <div>
                <button
                  onClick={() => setShowSql(!showSql)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showSql ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Database Setup SQL
                </button>

                {showSql && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">
                        Run this in your Supabase SQL Editor to set up the database:
                      </p>
                      <button
                        onClick={handleCopySql}
                        className="text-xs text-indigo-600 hover:text-indigo-700"
                      >
                        Copy to clipboard
                      </button>
                    </div>
                    <pre className="p-3 text-xs bg-gray-900 text-green-400 rounded-lg overflow-x-auto max-h-60 overflow-y-auto">
                      {SETUP_SQL}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sync info when configured */}
          {isConfigured && user && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Sync Information</h3>
                <p className="text-sm text-gray-500">
                  Your notes are automatically synced to the cloud when you're online.
                  Changes made offline will sync when you reconnect.
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">Sync is active</span>
                </div>
                <p className="mt-2 text-sm text-blue-600">
                  Your notes are being synced across all your devices.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

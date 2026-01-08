/**
 * Share Note Dialog
 *
 * Allows users to generate and manage shareable links for their notes.
 * Shows sharing status, copy link button, and revoke option.
 */

import { useState, useEffect } from 'react';
import {
  isSharingAvailable,
  isNoteShared,
  generateShareLink,
  revokeShareLink,
  getShareUrl,
} from '../services/sharing';

interface ShareNoteDialogProps {
  noteId: string;
  noteTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareNoteDialog({ noteId, noteTitle, isOpen, onClose }: ShareNoteDialogProps) {
  const [isShared, setIsShared] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const available = isSharingAvailable();

  // Load sharing status on open
  useEffect(() => {
    if (isOpen && noteId) {
      loadSharingStatus();
    }
  }, [isOpen, noteId]);

  async function loadSharingStatus() {
    setLoading(true);
    setError(null);
    try {
      const status = await isNoteShared(noteId);
      setIsShared(status.shared);
      setViewCount(status.viewCount);
      if (status.shareToken) {
        setShareUrl(getShareUrl(status.shareToken));
      } else {
        setShareUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sharing status');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableSharing() {
    setLoading(true);
    setError(null);
    try {
      const url = await generateShareLink(noteId);
      setShareUrl(url);
      setIsShared(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable sharing');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevokeSharing() {
    setLoading(true);
    setError(null);
    try {
      await revokeShareLink(noteId);
      setShareUrl(null);
      setIsShared(false);
      setViewCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke sharing');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Share Note</h2>
              <p className="text-sm text-gray-500 truncate max-w-[200px]">{noteTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {!available ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">Sync Required</h3>
              <p className="text-sm text-gray-500">
                Enable cloud sync in settings to share notes with others.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="w-6 h-6 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              {isShared && shareUrl ? (
                <>
                  {/* Sharing enabled state */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-700">Sharing enabled</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Anyone with this link can view a read-only version of your note.
                    </p>
                  </div>

                  {/* Share URL */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Share Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none"
                      />
                      <button
                        onClick={handleCopyLink}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          copied
                            ? 'bg-green-100 text-green-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Analytics */}
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{viewCount} view{viewCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Revoke button */}
                  <button
                    onClick={handleRevokeSharing}
                    className="w-full py-2 px-4 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Revoke Share Link
                  </button>
                </>
              ) : (
                <>
                  {/* Not shared state */}
                  <div className="text-center py-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-2">This note is private</h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Create a shareable link to let anyone view this note.
                    </p>
                    <button
                      onClick={handleEnableSharing}
                      className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Create Share Link
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

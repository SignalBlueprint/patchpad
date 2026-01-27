import { useEffect, useState } from 'react';
import type { DailyDigest } from '../services/digest';
import { getGreeting } from '../services/digest';

interface DailyDigestModalProps {
  digest: DailyDigest;
  onClose: () => void;
  onNavigateToNote?: (id: string) => void;
}

export function DailyDigestModal({
  digest,
  onClose,
  onNavigateToNote,
}: DailyDigestModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const greeting = getGreeting();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible && !isClosing ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-lg border border-neutral-200 overflow-hidden transition-all duration-300 ${
          isVisible && !isClosing ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-primary-600" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="relative pt-8 px-6 pb-6">
          {/* Greeting */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-1">{greeting}!</h2>
            <p className="text-white/80 text-sm">Here's your activity summary</p>
          </div>

          {/* Stats cards */}
          <div className="mt-16 grid grid-cols-3 gap-3 mb-6">
            <StatCard
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              value={digest.notesCreated}
              label="Notes Created"
              color="primary"
            />
            <StatCard
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }
              value={digest.notesUpdated}
              label="Notes Updated"
              color="primary"
            />
            <StatCard
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              }
              value={digest.wordsWritten}
              label="Words Written"
              color="primary"
            />
          </div>

          {/* Tasks section */}
          {digest.tasksExtracted.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Open Tasks ({digest.tasksExtracted.length})
              </h3>
              <ul className="space-y-1.5">
                {digest.tasksExtracted.slice(0, 5).map((task, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-neutral-600 bg-neutral-50 rounded-lg px-3 py-2"
                  >
                    <span className="flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 border-neutral-300" />
                    <span className="line-clamp-1">{task}</span>
                  </li>
                ))}
                {digest.tasksExtracted.length > 5 && (
                  <li className="text-xs text-neutral-400 pl-6">
                    +{digest.tasksExtracted.length - 5} more tasks
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Top concepts */}
          {digest.topConcepts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Top Concepts
              </h3>
              <div className="flex flex-wrap gap-2">
                {digest.topConcepts.map((concept, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-primary-50 text-primary-700 border border-primary-100"
                  >
                    {concept.name}
                    <span className="text-xs text-primary-500">({concept.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggestion */}
          <div className="bg-accent-50 rounded-lg p-4 border border-accent-100">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-sm text-accent-800">{digest.suggestion}</p>
            </div>
          </div>

          {/* Start Writing button */}
          <button
            onClick={handleClose}
            className="w-full mt-6 py-3 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Start Writing
          </button>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: 'primary';
}

function StatCard({ icon, value, label, color }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
  };

  return (
    <div
      className={`p-3 rounded-xl ${colorClasses[color]} border text-center`}
    >
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}

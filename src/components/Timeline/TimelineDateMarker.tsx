import { formatDateHeader } from '../../services/thinkingSession';

interface TimelineDateMarkerProps {
  dateStr: string;
  isSticky?: boolean;
}

export function TimelineDateMarker({ dateStr, isSticky = false }: TimelineDateMarkerProps) {
  return (
    <div
      className={`
        flex items-center gap-3 py-3 px-4
        ${isSticky ? 'sticky top-0 z-10 bg-neutral-100/95 backdrop-blur-sm' : ''}
      `}
    >
      {/* Date line connector */}
      <div className="flex-shrink-0 w-3 h-3 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 shadow-sm" />

      {/* Date label */}
      <h3 className="text-sm font-semibold text-neutral-700">
        {formatDateHeader(dateStr)}
      </h3>

      {/* Horizontal line */}
      <div className="flex-grow h-px bg-gradient-to-r from-gray-200 to-transparent" />
    </div>
  );
}

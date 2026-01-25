import ReactMarkdown from 'react-markdown';

interface StitchPreviewProps {
  rationale: string;
  content: string;
  onApply: () => void;
  onReject: () => void;
}

export function StitchPreview({
  rationale,
  content,
  onApply,
  onReject,
}: StitchPreviewProps) {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 bg-purple-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-purple-800">
            Stitch Preview
          </h2>
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="px-4 py-1.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Reject
            </button>
            <button
              onClick={onApply}
              className="px-4 py-1.5 text-sm font-medium text-white bg-secondary-600 rounded-md hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              Create Note
            </button>
          </div>
        </div>
        <p className="text-sm text-purple-700">{rationale}</p>
      </div>

      {/* Content Preview */}
      <div className="flex-1 overflow-auto p-4">
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-neutral-200 bg-neutral-50">
        <p className="text-xs text-neutral-500">
          Review the compiled content above. Click "Create Note" to save as a new note, or "Reject" to cancel.
        </p>
      </div>
    </div>
  );
}

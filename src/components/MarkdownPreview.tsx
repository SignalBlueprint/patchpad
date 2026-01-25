import ReactMarkdown from 'react-markdown';

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="h-full overflow-auto bg-white border-l border-neutral-200">
      <div className="p-4 prose prose-sm max-w-none">
        {content ? (
          <ReactMarkdown>{content}</ReactMarkdown>
        ) : (
          <p className="text-neutral-400 italic">Nothing to preview</p>
        )}
      </div>
    </div>
  );
}

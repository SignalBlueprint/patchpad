import { useEffect, useState, useCallback } from 'react';
import { suggestTags } from '../services/ai';

interface TagSuggestionsProps {
  content: string;
  currentTags: string[];
  onAddTag: (tag: string) => void;
}

export function TagSuggestions({ content, currentTags, onAddTag }: TagSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastContentHash, setLastContentHash] = useState<string>('');

  // Simple hash for content comparison
  const hashContent = useCallback((text: string) => {
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 500); i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(36);
  }, []);

  useEffect(() => {
    if (content.length < 50) {
      setSuggestions([]);
      return;
    }

    const contentHash = hashContent(content);
    if (contentHash === lastContentHash) return;

    // Debounce tag suggestions
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const tags = await suggestTags(content);
        // Filter out tags that are already added
        const newSuggestions = tags.filter(t => !currentTags.includes(t.toLowerCase()));
        setSuggestions(newSuggestions);
        setLastContentHash(contentHash);
      } catch (error) {
        console.error('Failed to suggest tags:', error);
      } finally {
        setLoading(false);
      }
    }, 2000); // Wait 2 seconds after typing stops

    return () => clearTimeout(timeoutId);
  }, [content, currentTags, hashContent, lastContentHash]);

  if (suggestions.length === 0 && !loading) return null;

  return (
    <div className="flex items-center gap-2 py-2">
      <span className="text-xs text-neutral-500">
        {loading ? (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Suggesting tags...
          </span>
        ) : (
          'Suggested:'
        )}
      </span>
      <div className="flex flex-wrap gap-1">
        {suggestions.map(tag => (
          <button
            key={tag}
            onClick={() => {
              onAddTag(tag);
              setSuggestions(prev => prev.filter(t => t !== tag));
            }}
            className="text-xs px-2 py-0.5 bg-blue-50 text-primary-600 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1"
          >
            <span>#{tag}</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

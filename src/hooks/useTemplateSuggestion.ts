import { useState, useEffect, useCallback, useRef } from 'react';
import type { Template } from '../types/template';
import { getBestTemplateMatch, type TemplateSuggestion } from '../services/templateMatcher';

interface UseTemplateSuggestionOptions {
  /** Current note title */
  title: string;
  /** Current note content */
  content: string;
  /** Whether the feature is enabled */
  enabled?: boolean;
  /** Debounce time in ms before showing suggestion */
  debounceMs?: number;
}

interface UseTemplateSuggestionResult {
  /** Current template suggestion (null if none) */
  suggestion: TemplateSuggestion | null;
  /** Accept the suggestion and apply the template */
  acceptSuggestion: () => void;
  /** Dismiss the current suggestion */
  dismissSuggestion: () => void;
  /** List of dismissed template IDs for this session */
  dismissedTemplates: Set<string>;
}

/**
 * Hook that detects when a note title matches a template pattern
 * and provides suggestion management
 */
export function useTemplateSuggestion({
  title,
  content,
  enabled = true,
  debounceMs = 1000,
}: UseTemplateSuggestionOptions): UseTemplateSuggestionResult {
  const [suggestion, setSuggestion] = useState<TemplateSuggestion | null>(null);
  const [dismissedTemplates, setDismissedTemplates] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTitleRef = useRef<string>('');

  // Detect template matches when title changes
  useEffect(() => {
    if (!enabled) {
      setSuggestion(null);
      return;
    }

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Don't suggest if title is empty or hasn't changed
    if (!title || title === lastTitleRef.current) {
      return;
    }

    // Don't suggest if note already has significant content
    // (user probably doesn't want a template scaffolded over their work)
    const contentLength = content?.trim().length || 0;
    if (contentLength > 100) {
      setSuggestion(null);
      return;
    }

    // Debounce the check
    debounceRef.current = setTimeout(() => {
      lastTitleRef.current = title;

      const match = getBestTemplateMatch(title);
      if (match && !dismissedTemplates.has(match.template.id)) {
        setSuggestion(match);
      } else {
        setSuggestion(null);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [title, content, enabled, debounceMs, dismissedTemplates]);

  // Accept the current suggestion
  const acceptSuggestion = useCallback(() => {
    // Clear suggestion (the actual template application is handled by the parent)
    setSuggestion(null);
  }, []);

  // Dismiss the current suggestion
  const dismissSuggestion = useCallback(() => {
    if (suggestion) {
      setDismissedTemplates(prev => new Set([...prev, suggestion.template.id]));
    }
    setSuggestion(null);
  }, [suggestion]);

  return {
    suggestion,
    acceptSuggestion,
    dismissSuggestion,
    dismissedTemplates,
  };
}

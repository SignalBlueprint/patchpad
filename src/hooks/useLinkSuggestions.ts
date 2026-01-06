import { useState, useEffect, useCallback, useRef } from 'react';
import { useIdleDetection } from './useIdleDetection';
import type { Note } from '../types/note';
import type { Concept } from '../services/brain';
import { parseWikiLinks } from '../utils/linkParser';

export interface LinkSuggestion {
  term: string;
  noteId: string;
  noteTitle: string;
  position: number;
}

interface UseLinkSuggestionsOptions {
  content: string;
  notes: Note[];
  concepts?: Concept[];
  enabled?: boolean;
  idleTimeout?: number;
}

/**
 * Hook that suggests wiki-links to existing notes when users mention known concepts or note titles
 */
export function useLinkSuggestions({
  content,
  notes,
  concepts = [],
  enabled = true,
  idleTimeout = 500,
}: UseLinkSuggestionsOptions) {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [dismissedTerms, setDismissedTerms] = useState<Set<string>>(new Set());
  const lastContentRef = useRef<string>('');

  // Scan content for matching note titles and concepts
  const scanForMatches = useCallback(() => {
    if (!enabled || !content) {
      setSuggestions([]);
      return;
    }

    // Skip if content hasn't changed
    if (content === lastContentRef.current) {
      return;
    }
    lastContentRef.current = content;

    // Get existing wiki links to avoid suggesting them
    const existingLinks = parseWikiLinks(content);
    const linkedTitles = new Set(
      existingLinks.map(link => link.targetTitle.toLowerCase())
    );

    const newSuggestions: LinkSuggestion[] = [];
    const seenTerms = new Set<string>();

    // Scan for exact note title matches
    for (const note of notes) {
      const title = note.title.trim();
      if (!title || title.length < 2) continue;

      const titleLower = title.toLowerCase();

      // Skip if already linked
      if (linkedTitles.has(titleLower)) continue;

      // Skip if already dismissed
      if (dismissedTerms.has(titleLower)) continue;

      // Skip if already found
      if (seenTerms.has(titleLower)) continue;

      // Find case-insensitive match in content (not inside existing [[...]])
      const matches = findTermMatches(content, title, existingLinks);

      for (const position of matches) {
        seenTerms.add(titleLower);
        newSuggestions.push({
          term: title,
          noteId: note.id,
          noteTitle: note.title,
          position,
        });
        // Only suggest first occurrence of each title
        break;
      }
    }

    // Also scan for concept name matches
    for (const concept of concepts) {
      const name = concept.name.trim();
      if (!name || name.length < 2) continue;

      const nameLower = name.toLowerCase();

      // Skip if already linked or dismissed
      if (linkedTitles.has(nameLower)) continue;
      if (dismissedTerms.has(nameLower)) continue;
      if (seenTerms.has(nameLower)) continue;

      // Find matching note for this concept (by title)
      const matchingNote = notes.find(
        n => n.title.toLowerCase() === nameLower
      );
      if (!matchingNote) continue;

      const matches = findTermMatches(content, name, existingLinks);

      for (const position of matches) {
        seenTerms.add(nameLower);
        newSuggestions.push({
          term: name,
          noteId: matchingNote.id,
          noteTitle: matchingNote.title,
          position,
        });
        break;
      }
    }

    // Sort by position in document
    newSuggestions.sort((a, b) => a.position - b.position);

    setSuggestions(newSuggestions);
  }, [content, notes, concepts, enabled, dismissedTerms]);

  // Use idle detection to trigger scanning
  const { isIdle, reportActivity } = useIdleDetection({
    idleTimeout,
    onIdle: scanForMatches,
    enabled,
  });

  // Report activity when content changes
  useEffect(() => {
    reportActivity();
  }, [content, reportActivity]);

  // Dismiss a suggestion
  const dismissSuggestion = useCallback((term: string) => {
    setDismissedTerms(prev => {
      const next = new Set(prev);
      next.add(term.toLowerCase());
      return next;
    });
    setSuggestions(prev => prev.filter(s => s.term.toLowerCase() !== term.toLowerCase()));
  }, []);

  // Accept a suggestion (just removes it from the list - caller handles the actual linking)
  const acceptSuggestion = useCallback((term: string) => {
    setSuggestions(prev => prev.filter(s => s.term.toLowerCase() !== term.toLowerCase()));
  }, []);

  // Clear all suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  // Reset dismissed terms (e.g., when switching notes)
  const resetDismissed = useCallback(() => {
    setDismissedTerms(new Set());
  }, []);

  return {
    suggestions,
    isIdle,
    dismissSuggestion,
    acceptSuggestion,
    clearSuggestions,
    resetDismissed,
    reportActivity,
  };
}

/**
 * Find positions of a term in content, excluding text inside [[...]] brackets
 */
function findTermMatches(
  content: string,
  term: string,
  existingLinks: { from: number; to: number }[]
): number[] {
  const positions: number[] = [];
  const termLower = term.toLowerCase();
  const contentLower = content.toLowerCase();

  let searchStart = 0;
  let index: number;

  while ((index = contentLower.indexOf(termLower, searchStart)) !== -1) {
    // Check if this position is inside an existing wiki link
    const isInsideLink = existingLinks.some(
      link => index >= link.from && index < link.to
    );

    if (!isInsideLink) {
      // Check that it's a word boundary match (not part of a longer word)
      const charBefore = index > 0 ? content[index - 1] : ' ';
      const charAfter = index + term.length < content.length ? content[index + term.length] : ' ';

      const isWordBoundaryBefore = /[\s\n\r.,;:!?()\[\]{}'"<>-]/.test(charBefore);
      const isWordBoundaryAfter = /[\s\n\r.,;:!?()\[\]{}'"<>-]/.test(charAfter);

      if (isWordBoundaryBefore && isWordBoundaryAfter) {
        positions.push(index);
      }
    }

    searchStart = index + 1;
  }

  return positions;
}

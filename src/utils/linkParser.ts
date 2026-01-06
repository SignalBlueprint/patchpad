import type { Note } from '../types/note';

/**
 * Represents a parsed wiki link from content
 */
export interface ParsedWikiLink {
  id: string;
  from: number;           // Character position start (of full [[...]] syntax)
  to: number;             // Character position end
  targetTitle: string;    // The note title being linked to
  displayText?: string;   // Optional display text (from [[Title|display]])
  fullMatch: string;      // The full matched string including brackets
}

/**
 * Regex pattern for wiki links:
 * [[Note Title]] or [[Note Title|display text]]
 */
const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Parse all wiki links from content
 * @param content The text content to parse
 * @returns Array of parsed wiki links with positions
 */
export function parseWikiLinks(content: string): ParsedWikiLink[] {
  const links: ParsedWikiLink[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  WIKI_LINK_PATTERN.lastIndex = 0;

  while ((match = WIKI_LINK_PATTERN.exec(content)) !== null) {
    const [fullMatch, targetTitle, displayText] = match;
    links.push({
      id: `link-${match.index}-${targetTitle}`,
      from: match.index,
      to: match.index + fullMatch.length,
      targetTitle: targetTitle.trim(),
      displayText: displayText?.trim(),
      fullMatch,
    });
  }

  return links;
}

/**
 * Find a note by its title (case-insensitive, exact match first, then fuzzy)
 * @param title The title to search for
 * @param notes Array of notes to search
 * @returns The matching note or null
 */
export function findNoteByTitle(title: string, notes: Note[]): Note | null {
  const normalizedTitle = title.toLowerCase().trim();

  // First try exact match (case-insensitive)
  const exactMatch = notes.find(
    note => note.title.toLowerCase().trim() === normalizedTitle
  );
  if (exactMatch) return exactMatch;

  // Then try "starts with" match
  const startsWithMatch = notes.find(
    note => note.title.toLowerCase().trim().startsWith(normalizedTitle)
  );
  if (startsWithMatch) return startsWithMatch;

  // Finally try "contains" match
  const containsMatch = notes.find(
    note => note.title.toLowerCase().trim().includes(normalizedTitle)
  );

  return containsMatch || null;
}

/**
 * Search notes by title for autocomplete
 * @param query The search query
 * @param notes Array of notes to search
 * @param limit Maximum results to return
 * @returns Array of matching notes, sorted by relevance
 */
export function searchNotesByTitle(
  query: string,
  notes: Note[],
  limit: number = 10
): Note[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    // Return most recently updated notes when no query
    return [...notes]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  // Score each note based on match quality
  const scored = notes.map(note => {
    const title = note.title.toLowerCase();
    let score = 0;

    if (title === normalizedQuery) {
      score = 100; // Exact match
    } else if (title.startsWith(normalizedQuery)) {
      score = 80; // Starts with
    } else if (title.includes(normalizedQuery)) {
      score = 60; // Contains
    } else {
      // Check for word matches
      const queryWords = normalizedQuery.split(/\s+/);
      const titleWords = title.split(/\s+/);
      const matchedWords = queryWords.filter(qw =>
        titleWords.some(tw => tw.includes(qw))
      );
      score = (matchedWords.length / queryWords.length) * 40;
    }

    return { note, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.note);
}

/**
 * Generate wiki link syntax
 * @param noteTitle The title of the note to link to
 * @param displayText Optional display text
 * @returns The wiki link syntax string
 */
export function generateWikiLink(noteTitle: string, displayText?: string): string {
  if (displayText && displayText !== noteTitle) {
    return `[[${noteTitle}|${displayText}]]`;
  }
  return `[[${noteTitle}]]`;
}

/**
 * Get the display text for a wiki link
 * @param link The parsed wiki link
 * @returns The text that should be displayed
 */
export function getWikiLinkDisplayText(link: ParsedWikiLink): string {
  return link.displayText || link.targetTitle;
}

/**
 * Check if a position is inside a wiki link
 * @param content The text content
 * @param position The character position to check
 * @returns The wiki link at that position, or null
 */
export function getWikiLinkAtPosition(
  content: string,
  position: number
): ParsedWikiLink | null {
  const links = parseWikiLinks(content);
  return links.find(link => position >= link.from && position <= link.to) || null;
}

/**
 * Check if we're currently typing a wiki link (cursor is after [[ but before ]])
 * @param content The text content
 * @param position The cursor position
 * @returns Object with typing state and partial query, or null if not typing a link
 */
export function getWikiLinkTypingState(
  content: string,
  position: number
): { query: string; startPosition: number } | null {
  // Look backwards from cursor for [[
  const beforeCursor = content.slice(0, position);
  const lastOpenBrackets = beforeCursor.lastIndexOf('[[');

  if (lastOpenBrackets === -1) return null;

  // Check if there's a ]] between [[ and cursor
  const betweenBracketsAndCursor = content.slice(lastOpenBrackets, position);
  if (betweenBracketsAndCursor.includes(']]')) return null;

  // Check if there's a newline between [[ and cursor (links shouldn't span lines)
  if (betweenBracketsAndCursor.includes('\n')) return null;

  // Extract the query (text after [[)
  const query = content.slice(lastOpenBrackets + 2, position);

  // If query contains |, only use the part after | for searching
  const pipeIndex = query.indexOf('|');
  const searchQuery = pipeIndex >= 0 ? query.slice(pipeIndex + 1) : query;

  return {
    query: searchQuery,
    startPosition: lastOpenBrackets,
  };
}

/**
 * Complete a wiki link by inserting the selected note title
 * @param content The current content
 * @param startPosition The position of [[
 * @param cursorPosition The current cursor position
 * @param selectedTitle The title to insert
 * @returns Object with new content and new cursor position
 */
export function completeWikiLink(
  content: string,
  startPosition: number,
  cursorPosition: number,
  selectedTitle: string
): { content: string; cursorPosition: number } {
  const before = content.slice(0, startPosition);
  const after = content.slice(cursorPosition);

  const newLink = `[[${selectedTitle}]]`;
  const newContent = before + newLink + after;
  const newCursorPosition = startPosition + newLink.length;

  return {
    content: newContent,
    cursorPosition: newCursorPosition,
  };
}

/**
 * Get all backlinks for a note (notes that link TO this note)
 * @param noteId The ID of the target note
 * @param noteTitle The title of the target note
 * @param allNotes All notes to search through
 * @returns Array of backlinks with source info and context
 */
export interface Backlink {
  sourceNoteId: string;
  sourceTitle: string;
  context: string;        // Surrounding text snippet
  position: number;       // Character position in source
}

export function getBacklinks(
  noteId: string,
  noteTitle: string,
  allNotes: Note[]
): Backlink[] {
  const backlinks: Backlink[] = [];
  const normalizedTitle = noteTitle.toLowerCase().trim();

  for (const note of allNotes) {
    // Skip the note itself
    if (note.id === noteId) continue;

    const links = parseWikiLinks(note.content);

    for (const link of links) {
      if (link.targetTitle.toLowerCase().trim() === normalizedTitle) {
        // Extract context (surrounding text)
        const contextStart = Math.max(0, link.from - 50);
        const contextEnd = Math.min(note.content.length, link.to + 50);
        let context = note.content.slice(contextStart, contextEnd);

        // Add ellipsis if truncated
        if (contextStart > 0) context = '...' + context;
        if (contextEnd < note.content.length) context = context + '...';

        backlinks.push({
          sourceNoteId: note.id,
          sourceTitle: note.title,
          context,
          position: link.from,
        });
      }
    }
  }

  return backlinks;
}

/**
 * Update all wiki links when a note is renamed
 * @param oldTitle The old note title
 * @param newTitle The new note title
 * @param content The content to update
 * @returns Updated content with renamed links
 */
export function updateLinksOnRename(
  oldTitle: string,
  newTitle: string,
  content: string
): string {
  const links = parseWikiLinks(content);

  // Process links in reverse order to maintain positions
  let updatedContent = content;
  const linksToUpdate = links
    .filter(link => link.targetTitle.toLowerCase() === oldTitle.toLowerCase())
    .reverse();

  for (const link of linksToUpdate) {
    const before = updatedContent.slice(0, link.from);
    const after = updatedContent.slice(link.to);

    // Preserve display text if it existed and was different from title
    const newLink = link.displayText
      ? `[[${newTitle}|${link.displayText}]]`
      : `[[${newTitle}]]`;

    updatedContent = before + newLink + after;
  }

  return updatedContent;
}

/**
 * Find broken links (links to notes that don't exist)
 * @param content The content to check
 * @param allNotes All available notes
 * @returns Array of broken links
 */
export function findBrokenLinks(
  content: string,
  allNotes: Note[]
): ParsedWikiLink[] {
  const links = parseWikiLinks(content);

  return links.filter(link => {
    const matchedNote = findNoteByTitle(link.targetTitle, allNotes);
    return matchedNote === null;
  });
}

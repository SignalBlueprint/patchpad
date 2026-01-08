/**
 * Dashboard Insights Service
 *
 * Provides analytics for the Second Brain Dashboard including:
 * - Editing streaks
 * - Most active notes
 * - Unconnected notes that could benefit from links
 * - Fading memories (old notes relevant to current work)
 * - Connection suggestions using semantic search
 */

import type { Note } from '../types/note';
import { findSimilarNotes, type SearchResult } from './semanticSearch';

export interface SuggestedLink {
  fromNote: Note;
  toNote: Note;
  confidence: number;
  reason: string;
}

export interface FadingMemory {
  note: Note;
  relevanceReason: string;
  daysSinceUpdate: number;
  matchingConcepts: string[];
}

export interface DashboardInsights {
  editingStreak: number;
  mostActiveNotes: Note[];
  unconnectedNotes: Note[];
  fadingMemories: FadingMemory[];
  suggestedLinks: SuggestedLink[];
}

/**
 * Calculate the number of consecutive days with note edits
 */
export function getEditingStreak(notes: Note[]): number {
  if (notes.length === 0) return 0;

  // Get all unique edit dates
  const editDates = new Set<string>();
  notes.forEach((note) => {
    const date = new Date(note.updatedAt);
    editDates.add(date.toISOString().split('T')[0]);
  });

  // Sort dates in descending order
  const sortedDates = Array.from(editDates).sort().reverse();
  if (sortedDates.length === 0) return 0;

  // Check if today or yesterday had an edit (streak must be recent)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0; // Streak is broken
  }

  // Count consecutive days
  let streak = 1;
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const current = new Date(sortedDates[i]);
    const next = new Date(sortedDates[i + 1]);
    const diffDays = Math.floor(
      (current.getTime() - next.getTime()) / 86400000
    );

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Get the most frequently edited notes in the past N days
 */
export function getMostActiveNotes(notes: Note[], days: number = 7): Note[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Filter to notes updated within the time window
  const recentNotes = notes.filter(
    (note) => new Date(note.updatedAt) >= cutoffDate
  );

  // Sort by most recent update
  recentNotes.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Return top 5
  return recentNotes.slice(0, 5);
}

/**
 * Find notes that have no outgoing wiki links
 */
export function getUnconnectedNotes(notes: Note[]): Note[] {
  return notes.filter((note) => {
    // Check for wiki link pattern [[...]]
    const hasWikiLinks = /\[\[.+?\]\]/.test(note.content);
    return !hasWikiLinks;
  });
}

/**
 * Extract concepts (tags and key terms) from recently edited notes
 */
export function extractRecentConcepts(notes: Note[], days: number = 7): string[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const concepts = new Map<string, number>();

  notes
    .filter((note) => new Date(note.updatedAt) >= cutoffDate)
    .forEach((note) => {
      // Add tags
      note.tags?.forEach((tag) => {
        concepts.set(tag.toLowerCase(), (concepts.get(tag.toLowerCase()) || 0) + 1);
      });

      // Extract potential concepts from title
      const titleWords = note.title
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ''));

      titleWords.forEach((word) => {
        if (word.length > 3) {
          concepts.set(word, (concepts.get(word) || 0) + 1);
        }
      });
    });

  // Return concepts that appear more than once, sorted by frequency
  return Array.from(concepts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([concept]) => concept);
}

/**
 * Find old notes that are relevant to recent work (fading memories)
 */
export function getFadingMemories(
  notes: Note[],
  concepts: string[],
  minDaysOld: number = 90
): FadingMemory[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minDaysOld);

  const fadingMemories: FadingMemory[] = [];

  notes
    .filter((note) => new Date(note.updatedAt) < cutoffDate)
    .forEach((note) => {
      const contentLower = note.content.toLowerCase();
      const titleLower = note.title.toLowerCase();
      const matchingConcepts: string[] = [];

      concepts.forEach((concept) => {
        if (contentLower.includes(concept) || titleLower.includes(concept)) {
          matchingConcepts.push(concept);
        }
      });

      if (matchingConcepts.length > 0) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - new Date(note.updatedAt).getTime()) / 86400000
        );

        fadingMemories.push({
          note,
          relevanceReason: `Mentions "${matchingConcepts[0]}" which you wrote about recently`,
          daysSinceUpdate,
          matchingConcepts,
        });
      }
    });

  // Sort by number of matching concepts, then by age
  fadingMemories.sort((a, b) => {
    if (b.matchingConcepts.length !== a.matchingConcepts.length) {
      return b.matchingConcepts.length - a.matchingConcepts.length;
    }
    return a.daysSinceUpdate - b.daysSinceUpdate;
  });

  return fadingMemories.slice(0, 5);
}

/**
 * Suggest wiki links for unconnected notes using semantic similarity
 */
export async function suggestConnections(
  note: Note,
  allNotes: Note[],
  maxSuggestions: number = 3
): Promise<SuggestedLink[]> {
  const suggestions: SuggestedLink[] = [];

  try {
    // Find semantically similar notes
    const similarNotes = await findSimilarNotes(note.id, 10);

    // Filter out notes that are already linked
    const linkedTitles = new Set<string>();
    const linkPattern = /\[\[(.+?)\]\]/g;
    let match;
    while ((match = linkPattern.exec(note.content)) !== null) {
      linkedTitles.add(match[1].toLowerCase());
    }

    for (const result of similarNotes) {
      if (linkedTitles.has(result.note.title.toLowerCase())) {
        continue;
      }

      // Only suggest if similarity is high enough
      if (result.score > 0.5) {
        suggestions.push({
          fromNote: note,
          toNote: result.note,
          confidence: result.score,
          reason: result.relevantExcerpt || 'Similar content',
        });

        if (suggestions.length >= maxSuggestions) {
          break;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to generate connection suggestions:', error);
  }

  return suggestions;
}

/**
 * Get all dashboard insights at once
 */
export async function getDashboardInsights(notes: Note[]): Promise<DashboardInsights> {
  const editingStreak = getEditingStreak(notes);
  const mostActiveNotes = getMostActiveNotes(notes);
  const unconnectedNotes = getUnconnectedNotes(notes);
  const recentConcepts = extractRecentConcepts(notes);
  const fadingMemories = getFadingMemories(notes, recentConcepts);

  // Get suggestions for top 5 unconnected notes
  const suggestedLinks: SuggestedLink[] = [];
  for (const note of unconnectedNotes.slice(0, 5)) {
    const suggestions = await suggestConnections(note, notes);
    suggestedLinks.push(...suggestions);
  }

  return {
    editingStreak,
    mostActiveNotes,
    unconnectedNotes,
    fadingMemories,
    suggestedLinks: suggestedLinks.slice(0, 10),
  };
}

/**
 * Get time-based greeting
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  } else if (hour < 17) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
}

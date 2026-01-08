/**
 * Dashboard Analytics Service
 * Provides functions for analyzing notes to power the Second Brain Dashboard
 */

import type { Note } from '../types/note';
import type { Concept } from './brain';

/**
 * Get the most frequently edited notes within a date range
 * @param notes All notes to analyze
 * @param days Number of days to look back
 * @returns Top 5 most edited notes sorted by update frequency
 */
export function getMostEditedNotes(notes: Note[], days: number = 7): Note[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Filter notes updated within the date range
  const recentNotes = notes.filter(note => {
    const updatedAt = new Date(note.updatedAt);
    return updatedAt >= cutoffDate;
  });

  // Sort by updatedAt descending (most recently updated first)
  // In a real scenario, we'd track edit count, but for now use recency as proxy
  return recentNotes
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
}

/**
 * Get notes that have no outgoing wiki links
 * These are "brewing ideas" that could benefit from connections
 * @param notes All notes to analyze
 * @returns Notes with no [[wiki links]] in content
 */
export function getUnconnectedNotes(notes: Note[]): Note[] {
  const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;

  return notes.filter(note => {
    const matches = note.content.match(wikiLinkPattern);
    return !matches || matches.length === 0;
  });
}

export interface FadingNote {
  note: Note;
  relevantConcepts: string[];
  relevanceScore: number;
  daysSinceUpdate: number;
}

/**
 * Get notes that haven't been updated in 90+ days but mention recent concepts
 * These are "fading memories" that might be worth revisiting
 * @param notes All notes to analyze
 * @param concepts Recent concepts to cross-reference
 * @returns Fading notes with relevance scores
 */
export function getFadingNotes(notes: Note[], concepts: Concept[]): FadingNote[] {
  const now = new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Filter to notes not updated in 90+ days
  const oldNotes = notes.filter(note => {
    const updatedAt = new Date(note.updatedAt);
    return updatedAt < ninetyDaysAgo;
  });

  // Get concept names for matching
  const conceptNames = concepts.map(c => c.name.toLowerCase());

  // Score each old note by how many recent concepts it mentions
  const scoredNotes = oldNotes.map(note => {
    const content = (note.title + ' ' + note.content).toLowerCase();
    const matchedConcepts = concepts.filter(c =>
      content.includes(c.name.toLowerCase())
    );

    const daysSinceUpdate = Math.floor(
      (now.getTime() - new Date(note.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      note,
      relevantConcepts: matchedConcepts.map(c => c.name),
      relevanceScore: matchedConcepts.length / Math.max(conceptNames.length, 1),
      daysSinceUpdate,
    };
  });

  // Filter to notes that mention at least one recent concept
  // Sort by relevance score descending
  return scoredNotes
    .filter(sn => sn.relevantConcepts.length > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);
}

/**
 * Calculate the user's editing streak
 * A streak is consecutive days with at least one note update
 * @param notes All notes to analyze
 * @returns Number of consecutive days with updates, starting from today
 */
export function getEditingStreak(notes: Note[]): number {
  if (notes.length === 0) return 0;

  // Get unique dates (YYYY-MM-DD) when notes were updated
  const updateDates = new Set<string>();
  notes.forEach(note => {
    const date = new Date(note.updatedAt);
    const dateStr = date.toISOString().split('T')[0];
    updateDates.add(dateStr);
  });

  // Convert to sorted array (most recent first)
  const sortedDates = Array.from(updateDates).sort().reverse();

  if (sortedDates.length === 0) return 0;

  // Check if today or yesterday has updates (streak must be current)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0; // No recent activity, streak is broken
  }

  // Count consecutive days working backwards
  let streak = 1;
  let currentDate = new Date(sortedDates[0]);

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDay = new Date(currentDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayStr = prevDay.toISOString().split('T')[0];

    if (sortedDates[i] === prevDayStr) {
      streak++;
      currentDate = prevDay;
    } else {
      break; // Gap found, streak ends
    }
  }

  return streak;
}

/**
 * Get time-based greeting
 */
export function getTimeGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Get notes updated in the last N days
 */
export function getRecentlyUpdatedNotes(notes: Note[], days: number = 14): Note[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return notes.filter(note => {
    const updatedAt = new Date(note.updatedAt);
    return updatedAt >= cutoffDate;
  });
}

/**
 * Calculate total word count for notes
 */
export function getTotalWordCount(notes: Note[]): number {
  return notes.reduce((total, note) => {
    const words = note.content.trim().split(/\s+/).filter(w => w.length > 0);
    return total + words.length;
  }, 0);
}

/**
 * Get localStorage preference for showing dashboard on startup
 */
export function shouldShowDashboardOnStartup(): boolean {
  const pref = localStorage.getItem('patchpad_show_dashboard_on_load');
  return pref === 'true';
}

/**
 * Set localStorage preference for showing dashboard on startup
 */
export function setShowDashboardOnStartup(show: boolean): void {
  localStorage.setItem('patchpad_show_dashboard_on_load', String(show));
}

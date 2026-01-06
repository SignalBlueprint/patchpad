/**
 * Daily Digest Service
 * Generates personalized summaries of note-taking activity
 */

import type { Note } from '../types/note';
import type { Concept } from './brain';

export interface DailyDigest {
  date: Date;
  notesCreated: number;
  notesUpdated: number;
  wordsWritten: number;
  tasksExtracted: string[];
  topConcepts: { name: string; count: number }[];
  suggestion: string;
}

// localStorage keys
const LAST_DIGEST_DATE_KEY = 'patchpad_last_digest_date';
const DIGEST_ENABLED_KEY = 'patchpad_digest_enabled';

/**
 * Generate a daily digest from notes and concepts
 */
export function generateDailyDigest(notes: Note[], concepts: Concept[] = []): DailyDigest {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Filter notes updated in the last 24 hours
  const recentNotes = notes.filter(note => {
    const updatedAt = new Date(note.updatedAt);
    return updatedAt >= twentyFourHoursAgo;
  });

  // Count notes created in the last 24 hours
  const notesCreated = notes.filter(note => {
    const createdAt = new Date(note.createdAt);
    return createdAt >= twentyFourHoursAgo;
  }).length;

  // Count total words written in recent notes
  const wordsWritten = recentNotes.reduce((total, note) => {
    const words = note.content.trim().split(/\s+/).filter(w => w.length > 0);
    return total + words.length;
  }, 0);

  // Extract tasks from recent notes
  const taskPattern = /(?:TODO|TASK|ACTION|FIXME):\s*(.+?)(?:\n|$)/gi;
  const checkboxPattern = /- \[ \]\s*(.+?)(?:\n|$)/gi;
  const tasksExtracted: string[] = [];

  for (const note of recentNotes) {
    let match;

    // Match TODO/TASK/ACTION patterns
    taskPattern.lastIndex = 0;
    while ((match = taskPattern.exec(note.content)) !== null) {
      const task = match[1].trim();
      if (task && !tasksExtracted.includes(task)) {
        tasksExtracted.push(task);
      }
    }

    // Match unchecked checkbox items
    checkboxPattern.lastIndex = 0;
    while ((match = checkboxPattern.exec(note.content)) !== null) {
      const task = match[1].trim();
      if (task && !tasksExtracted.includes(task)) {
        tasksExtracted.push(task);
      }
    }
  }

  // Aggregate concept mentions from recent notes
  const conceptCounts = new Map<string, number>();

  for (const concept of concepts) {
    const recentMentions = concept.mentions.filter(mention => {
      const note = notes.find(n => n.id === mention.noteId);
      if (!note) return false;
      const updatedAt = new Date(note.updatedAt);
      return updatedAt >= twentyFourHoursAgo;
    });

    if (recentMentions.length > 0) {
      conceptCounts.set(concept.name, recentMentions.length);
    }
  }

  // Sort by count and take top 5
  const topConcepts = Array.from(conceptCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Generate suggestion based on activity
  const suggestion = generateSuggestion(
    notesCreated,
    recentNotes.length,
    wordsWritten,
    tasksExtracted.length
  );

  return {
    date: now,
    notesCreated,
    notesUpdated: recentNotes.length,
    wordsWritten,
    tasksExtracted: tasksExtracted.slice(0, 10), // Limit to 10 tasks
    topConcepts,
    suggestion,
  };
}

/**
 * Generate a contextual suggestion based on activity
 */
function generateSuggestion(
  notesCreated: number,
  notesUpdated: number,
  wordsWritten: number,
  openTasks: number
): string {
  if (openTasks > 5) {
    return `You have ${openTasks} open tasks. Consider reviewing and prioritizing them today.`;
  }

  if (notesCreated === 0 && notesUpdated === 0) {
    return "You haven't written anything recently. Start fresh with a new note!";
  }

  if (wordsWritten > 1000) {
    return "Great productivity! You've written a lot. Consider reviewing and organizing your notes.";
  }

  if (notesCreated > 3) {
    return `You created ${notesCreated} new notes. Try linking related notes with [[wiki links]].`;
  }

  if (openTasks > 0 && openTasks <= 5) {
    return `You have ${openTasks} task${openTasks === 1 ? '' : 's'} to complete. You've got this!`;
  }

  return "Keep building your knowledge base. Every note counts!";
}

/**
 * Get the time-based greeting
 */
export function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  } else if (hour < 17) {
    return 'Good afternoon';
  } else if (hour < 21) {
    return 'Good evening';
  } else {
    return 'Good night';
  }
}

/**
 * Check if the digest should be shown today
 */
export function shouldShowDigest(): boolean {
  // Check if digest is enabled
  if (!isDigestEnabled()) {
    return false;
  }

  // Check if digest was already shown today
  const lastShownStr = localStorage.getItem(LAST_DIGEST_DATE_KEY);
  if (!lastShownStr) {
    return true;
  }

  const lastShown = new Date(lastShownStr);
  const today = new Date();

  // Compare dates (ignoring time)
  const lastShownDate = new Date(lastShown.getFullYear(), lastShown.getMonth(), lastShown.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return lastShownDate < todayDate;
}

/**
 * Mark the digest as shown for today
 */
export function markDigestShown(): void {
  localStorage.setItem(LAST_DIGEST_DATE_KEY, new Date().toISOString());
}

/**
 * Check if digest is enabled
 */
export function isDigestEnabled(): boolean {
  const stored = localStorage.getItem(DIGEST_ENABLED_KEY);
  // Default to enabled if not set
  return stored === null || stored === 'true';
}

/**
 * Enable or disable the daily digest
 */
export function setDigestEnabled(enabled: boolean): void {
  localStorage.setItem(DIGEST_ENABLED_KEY, String(enabled));
}

/**
 * Toggle the daily digest setting
 */
export function toggleDigestEnabled(): boolean {
  const currentValue = isDigestEnabled();
  setDigestEnabled(!currentValue);
  return !currentValue;
}

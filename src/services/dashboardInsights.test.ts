import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEditingStreak,
  getMostActiveNotes,
  getUnconnectedNotes,
  extractRecentConcepts,
  getFadingMemories,
  getTimeBasedGreeting,
} from './dashboardInsights';
import type { Note } from '../types/note';

// Helper to create a note with a specific date
function createNote(id: string, title: string, content: string, updatedAt: Date, tags?: string[]): Note {
  return {
    id,
    title,
    content,
    createdAt: updatedAt,
    updatedAt,
    tags,
  };
}

// Helper to create a date N days ago
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

describe('dashboardInsights', () => {
  describe('getEditingStreak', () => {
    it('returns 0 for empty notes array', () => {
      expect(getEditingStreak([])).toBe(0);
    });

    it('returns 1 for notes edited only today', () => {
      const notes = [
        createNote('1', 'Note 1', 'Content', new Date()),
      ];
      expect(getEditingStreak(notes)).toBe(1);
    });

    it('returns 1 for notes edited only yesterday', () => {
      const notes = [
        createNote('1', 'Note 1', 'Content', daysAgo(1)),
      ];
      expect(getEditingStreak(notes)).toBe(1);
    });

    it('returns 0 for notes only edited 2 days ago (streak broken)', () => {
      const notes = [
        createNote('1', 'Note 1', 'Content', daysAgo(2)),
      ];
      expect(getEditingStreak(notes)).toBe(0);
    });

    it('counts consecutive days correctly', () => {
      const notes = [
        createNote('1', 'Note 1', 'Content', new Date()),
        createNote('2', 'Note 2', 'Content', daysAgo(1)),
        createNote('3', 'Note 3', 'Content', daysAgo(2)),
      ];
      expect(getEditingStreak(notes)).toBe(3);
    });

    it('stops counting at a gap in the streak', () => {
      const notes = [
        createNote('1', 'Note 1', 'Content', new Date()),
        createNote('2', 'Note 2', 'Content', daysAgo(1)),
        // Gap at day 2
        createNote('3', 'Note 3', 'Content', daysAgo(3)),
        createNote('4', 'Note 4', 'Content', daysAgo(4)),
      ];
      expect(getEditingStreak(notes)).toBe(2);
    });

    it('handles multiple notes on the same day', () => {
      const today = new Date();
      const notes = [
        createNote('1', 'Note 1', 'Content', today),
        createNote('2', 'Note 2', 'Content', today),
        createNote('3', 'Note 3', 'Content', today),
      ];
      expect(getEditingStreak(notes)).toBe(1);
    });
  });

  describe('getMostActiveNotes', () => {
    it('returns empty array for no notes', () => {
      expect(getMostActiveNotes([], 7)).toEqual([]);
    });

    it('returns notes updated within the time window', () => {
      const notes = [
        createNote('1', 'Recent', 'Content', new Date()),
        createNote('2', 'Old', 'Content', daysAgo(30)),
      ];
      const result = getMostActiveNotes(notes, 7);
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Recent');
    });

    it('limits to 5 notes', () => {
      const notes = Array.from({ length: 10 }, (_, i) =>
        createNote(`${i}`, `Note ${i}`, 'Content', new Date())
      );
      expect(getMostActiveNotes(notes, 7).length).toBe(5);
    });

    it('sorts by most recently updated', () => {
      const notes = [
        createNote('1', 'Older', 'Content', daysAgo(2)),
        createNote('2', 'Newest', 'Content', new Date()),
        createNote('3', 'Middle', 'Content', daysAgo(1)),
      ];
      const result = getMostActiveNotes(notes, 7);
      expect(result[0].title).toBe('Newest');
      expect(result[1].title).toBe('Middle');
      expect(result[2].title).toBe('Older');
    });
  });

  describe('getUnconnectedNotes', () => {
    it('returns empty array for no notes', () => {
      expect(getUnconnectedNotes([])).toEqual([]);
    });

    it('returns notes without wiki links', () => {
      const notes = [
        createNote('1', 'Linked', 'See [[Other Note]]', new Date()),
        createNote('2', 'Unlinked', 'No links here', new Date()),
      ];
      const result = getUnconnectedNotes(notes);
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Unlinked');
    });

    it('detects various wiki link formats', () => {
      const notes = [
        createNote('1', 'Simple', '[[Note]]', new Date()),
        createNote('2', 'Aliased', '[[Note|display]]', new Date()),
        createNote('3', 'Multiple', '[[One]] and [[Two]]', new Date()),
        createNote('4', 'Unlinked', 'Regular text', new Date()),
      ];
      const result = getUnconnectedNotes(notes);
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Unlinked');
    });
  });

  describe('extractRecentConcepts', () => {
    it('returns empty array for no notes', () => {
      expect(extractRecentConcepts([], 7)).toEqual([]);
    });

    it('extracts tags from recent notes', () => {
      const notes = [
        createNote('1', 'Note', 'Content', new Date(), ['react', 'typescript']),
        createNote('2', 'Another', 'Content', new Date(), ['react', 'javascript']),
      ];
      const result = extractRecentConcepts(notes, 7);
      expect(result).toContain('react');
    });

    it('only includes concepts that appear more than once', () => {
      const notes = [
        createNote('1', 'Note', 'Content', new Date(), ['unique']),
        createNote('2', 'Another', 'Content', new Date(), ['common']),
        createNote('3', 'Third', 'Content', new Date(), ['common']),
      ];
      const result = extractRecentConcepts(notes, 7);
      expect(result).toContain('common');
      expect(result).not.toContain('unique');
    });

    it('excludes old notes from concept extraction', () => {
      const notes = [
        createNote('1', 'Recent', 'Content', new Date(), ['new-tag']),
        createNote('2', 'Old', 'Content', daysAgo(30), ['old-tag']),
        createNote('3', 'Also Recent', 'Content', new Date(), ['new-tag']),
      ];
      const result = extractRecentConcepts(notes, 7);
      expect(result).toContain('new-tag');
      expect(result).not.toContain('old-tag');
    });
  });

  describe('getFadingMemories', () => {
    it('returns empty array for no notes', () => {
      expect(getFadingMemories([], ['concept'])).toEqual([]);
    });

    it('returns empty array for no concepts', () => {
      const notes = [createNote('1', 'Old Note', 'Content', daysAgo(100))];
      expect(getFadingMemories(notes, [])).toEqual([]);
    });

    it('finds old notes mentioning recent concepts', () => {
      const notes = [
        createNote('1', 'Old React Note', 'React is great for building UIs', daysAgo(100)),
        createNote('2', 'Recent Note', 'Learning React', new Date()),
      ];
      const result = getFadingMemories(notes, ['react'], 90);
      expect(result.length).toBe(1);
      expect(result[0].note.title).toBe('Old React Note');
      expect(result[0].matchingConcepts).toContain('react');
    });

    it('excludes notes newer than the threshold', () => {
      const notes = [
        createNote('1', 'Not old enough', 'React stuff', daysAgo(30)),
      ];
      const result = getFadingMemories(notes, ['react'], 90);
      expect(result.length).toBe(0);
    });

    it('calculates days since update correctly', () => {
      const notes = [
        createNote('1', 'Old Note', 'React content', daysAgo(120)),
      ];
      const result = getFadingMemories(notes, ['react'], 90);
      expect(result.length).toBe(1);
      expect(result[0].daysSinceUpdate).toBeGreaterThanOrEqual(119);
      expect(result[0].daysSinceUpdate).toBeLessThanOrEqual(121);
    });

    it('sorts by number of matching concepts', () => {
      const notes = [
        createNote('1', 'One Match', 'React only', daysAgo(100)),
        createNote('2', 'Two Matches', 'React and TypeScript', daysAgo(100)),
      ];
      const result = getFadingMemories(notes, ['react', 'typescript'], 90);
      expect(result[0].note.title).toBe('Two Matches');
      expect(result[0].matchingConcepts.length).toBe(2);
    });
  });

  describe('getTimeBasedGreeting', () => {
    it('returns appropriate greeting for morning', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T09:00:00'));
      expect(getTimeBasedGreeting()).toBe('Good morning');
      vi.useRealTimers();
    });

    it('returns appropriate greeting for afternoon', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T14:00:00'));
      expect(getTimeBasedGreeting()).toBe('Good afternoon');
      vi.useRealTimers();
    });

    it('returns appropriate greeting for evening', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T19:00:00'));
      expect(getTimeBasedGreeting()).toBe('Good evening');
      vi.useRealTimers();
    });
  });
});

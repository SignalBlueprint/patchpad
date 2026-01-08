import { describe, it, expect } from 'vitest';
import {
  getMostEditedNotes,
  getUnconnectedNotes,
  getFadingNotes,
  getEditingStreak,
  getTimeGreeting,
  getRecentlyUpdatedNotes,
} from './dashboardAnalytics';
import type { Note } from '../types/note';
import type { Concept } from './brain';

// Helper to create test notes
function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: Math.random().toString(36).substring(7),
    title: 'Test Note',
    content: 'Test content',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper to create dates relative to now
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

describe('getMostEditedNotes', () => {
  it('returns notes updated within the specified days', () => {
    const notes = [
      createNote({ id: '1', updatedAt: daysAgo(1) }),
      createNote({ id: '2', updatedAt: daysAgo(3) }),
      createNote({ id: '3', updatedAt: daysAgo(10) }), // Outside 7-day window
    ];

    const result = getMostEditedNotes(notes, 7);

    expect(result).toHaveLength(2);
    expect(result.map(n => n.id)).toContain('1');
    expect(result.map(n => n.id)).toContain('2');
    expect(result.map(n => n.id)).not.toContain('3');
  });

  it('returns notes sorted by most recently updated first', () => {
    const notes = [
      createNote({ id: '1', updatedAt: daysAgo(5) }),
      createNote({ id: '2', updatedAt: daysAgo(1) }),
      createNote({ id: '3', updatedAt: daysAgo(3) }),
    ];

    const result = getMostEditedNotes(notes, 7);

    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('3');
    expect(result[2].id).toBe('1');
  });

  it('returns maximum of 5 notes', () => {
    const notes = Array.from({ length: 10 }, (_, i) =>
      createNote({ id: String(i), updatedAt: daysAgo(i) })
    );

    const result = getMostEditedNotes(notes, 14);

    expect(result).toHaveLength(5);
  });

  it('returns empty array when no notes', () => {
    const result = getMostEditedNotes([], 7);
    expect(result).toHaveLength(0);
  });
});

describe('getUnconnectedNotes', () => {
  it('returns notes with no wiki links', () => {
    const notes = [
      createNote({ id: '1', content: 'No links here' }),
      createNote({ id: '2', content: 'Has a [[wiki link]]' }),
      createNote({ id: '3', content: 'Also no links' }),
    ];

    const result = getUnconnectedNotes(notes);

    expect(result).toHaveLength(2);
    expect(result.map(n => n.id)).toContain('1');
    expect(result.map(n => n.id)).toContain('3');
    expect(result.map(n => n.id)).not.toContain('2');
  });

  it('ignores notes with wiki links correctly', () => {
    const notes = [
      createNote({ id: '1', content: 'Link to [[Note A]] and [[Note B]]' }),
      createNote({ id: '2', content: 'Multiple [[links]] in [[here]]' }),
    ];

    const result = getUnconnectedNotes(notes);

    expect(result).toHaveLength(0);
  });

  it('handles notes with bracketed text that is not wiki links', () => {
    const notes = [
      createNote({ id: '1', content: 'This has [single brackets] not wiki links' }),
      createNote({ id: '2', content: 'Array: [1, 2, 3]' }),
    ];

    const result = getUnconnectedNotes(notes);

    expect(result).toHaveLength(2);
  });

  it('returns all notes when none have wiki links', () => {
    const notes = [
      createNote({ id: '1', content: 'Note one' }),
      createNote({ id: '2', content: 'Note two' }),
    ];

    const result = getUnconnectedNotes(notes);

    expect(result).toHaveLength(2);
  });
});

describe('getFadingNotes', () => {
  it('returns notes older than 90 days that mention concepts', () => {
    const notes = [
      createNote({ id: '1', title: 'Old note about Project X', content: 'Working on Project X', updatedAt: daysAgo(100) }),
      createNote({ id: '2', title: 'Recent note', content: 'Project X update', updatedAt: daysAgo(5) }),
      createNote({ id: '3', title: 'Old unrelated', content: 'Something else', updatedAt: daysAgo(100) }),
    ];

    const concepts: Concept[] = [{
      id: 'c1',
      name: 'Project X',
      type: 'project',
      mentions: [],
      relatedConcepts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const result = getFadingNotes(notes, concepts);

    expect(result).toHaveLength(1);
    expect(result[0].note.id).toBe('1');
    expect(result[0].relevantConcepts).toContain('Project X');
  });

  it('cross-references concepts correctly with case-insensitive matching', () => {
    const notes = [
      createNote({ id: '1', content: 'Talking about JOHN DOE', updatedAt: daysAgo(100) }),
    ];

    const concepts: Concept[] = [{
      id: 'c1',
      name: 'John Doe',
      type: 'person',
      mentions: [],
      relatedConcepts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const result = getFadingNotes(notes, concepts);

    expect(result).toHaveLength(1);
    expect(result[0].relevantConcepts).toContain('John Doe');
  });

  it('returns empty when no notes are older than 90 days', () => {
    const notes = [
      createNote({ id: '1', content: 'Recent note', updatedAt: daysAgo(30) }),
    ];

    const concepts: Concept[] = [{
      id: 'c1',
      name: 'Recent',
      type: 'topic',
      mentions: [],
      relatedConcepts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const result = getFadingNotes(notes, concepts);

    expect(result).toHaveLength(0);
  });

  it('returns empty when no concepts match', () => {
    const notes = [
      createNote({ id: '1', content: 'Old note about nothing', updatedAt: daysAgo(100) }),
    ];

    const concepts: Concept[] = [{
      id: 'c1',
      name: 'Unrelated Topic',
      type: 'topic',
      mentions: [],
      relatedConcepts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const result = getFadingNotes(notes, concepts);

    expect(result).toHaveLength(0);
  });

  it('includes daysSinceUpdate in results', () => {
    const notes = [
      createNote({ id: '1', content: 'Topic mention', updatedAt: daysAgo(120) }),
    ];

    const concepts: Concept[] = [{
      id: 'c1',
      name: 'Topic',
      type: 'topic',
      mentions: [],
      relatedConcepts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const result = getFadingNotes(notes, concepts);

    expect(result[0].daysSinceUpdate).toBeGreaterThanOrEqual(119);
    expect(result[0].daysSinceUpdate).toBeLessThanOrEqual(121);
  });
});

describe('getEditingStreak', () => {
  it('returns correct streak for consecutive days', () => {
    const notes = [
      createNote({ updatedAt: daysAgo(0) }), // Today
      createNote({ updatedAt: daysAgo(1) }), // Yesterday
      createNote({ updatedAt: daysAgo(2) }), // 2 days ago
    ];

    const result = getEditingStreak(notes);

    expect(result).toBe(3);
  });

  it('handles gaps correctly', () => {
    const notes = [
      createNote({ updatedAt: daysAgo(0) }), // Today
      createNote({ updatedAt: daysAgo(1) }), // Yesterday
      // Gap on day 2
      createNote({ updatedAt: daysAgo(3) }), // 3 days ago
    ];

    const result = getEditingStreak(notes);

    expect(result).toBe(2); // Only today + yesterday count
  });

  it('returns 0 when no recent activity', () => {
    const notes = [
      createNote({ updatedAt: daysAgo(5) }),
      createNote({ updatedAt: daysAgo(10) }),
    ];

    const result = getEditingStreak(notes);

    expect(result).toBe(0);
  });

  it('returns 0 for empty notes array', () => {
    const result = getEditingStreak([]);
    expect(result).toBe(0);
  });

  it('counts streak starting from yesterday if no activity today', () => {
    const notes = [
      createNote({ updatedAt: daysAgo(1) }), // Yesterday
      createNote({ updatedAt: daysAgo(2) }), // 2 days ago
    ];

    const result = getEditingStreak(notes);

    expect(result).toBe(2);
  });

  it('handles multiple notes on the same day', () => {
    const today = new Date();
    const yesterday = daysAgo(1);

    const notes = [
      createNote({ updatedAt: today }),
      createNote({ updatedAt: today }),
      createNote({ updatedAt: yesterday }),
      createNote({ updatedAt: yesterday }),
    ];

    const result = getEditingStreak(notes);

    expect(result).toBe(2); // Still just 2 days, not 4
  });
});

describe('getTimeGreeting', () => {
  it('returns appropriate greeting based on time of day', () => {
    const greeting = getTimeGreeting();

    // Should return one of the valid greetings
    expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(greeting);
  });
});

describe('getRecentlyUpdatedNotes', () => {
  it('returns notes updated within the specified days', () => {
    const notes = [
      createNote({ id: '1', updatedAt: daysAgo(5) }),
      createNote({ id: '2', updatedAt: daysAgo(10) }),
      createNote({ id: '3', updatedAt: daysAgo(20) }),
    ];

    const result = getRecentlyUpdatedNotes(notes, 14);

    expect(result).toHaveLength(2);
    expect(result.map(n => n.id)).toContain('1');
    expect(result.map(n => n.id)).toContain('2');
    expect(result.map(n => n.id)).not.toContain('3');
  });

  it('uses default of 14 days', () => {
    const notes = [
      createNote({ id: '1', updatedAt: daysAgo(7) }),
      createNote({ id: '2', updatedAt: daysAgo(20) }),
    ];

    const result = getRecentlyUpdatedNotes(notes);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

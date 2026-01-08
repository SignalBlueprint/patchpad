import { describe, it, expect } from 'vitest';
import {
  clusterIntoSessions,
  extractSessionTags,
  formatSessionDuration,
  formatSessionTimeRange,
  groupSessionsByDate,
  formatDateHeader,
} from './thinkingSession';
import type { Note } from '../types/note';

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
function minutesAgo(minutes: number): Date {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date;
}

function hoursAgo(hours: number): Date {
  return minutesAgo(hours * 60);
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

describe('clusterIntoSessions', () => {
  it('groups notes created within 60 minutes of each other', () => {
    const notes = [
      createNote({ id: '1', createdAt: minutesAgo(100) }),
      createNote({ id: '2', createdAt: minutesAgo(70) }),  // 30 min after note 1
      createNote({ id: '3', createdAt: minutesAgo(40) }),  // 30 min after note 2
    ];

    const sessions = clusterIntoSessions(notes, 60);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].noteIds).toHaveLength(3);
    expect(sessions[0].noteIds).toEqual(['1', '2', '3']);
  });

  it('creates separate sessions for notes more than maxGapMinutes apart', () => {
    const notes = [
      createNote({ id: '1', createdAt: hoursAgo(5) }),
      createNote({ id: '2', createdAt: hoursAgo(3) }),  // 2 hours after note 1
      createNote({ id: '3', createdAt: hoursAgo(1) }),  // 2 hours after note 2
    ];

    const sessions = clusterIntoSessions(notes, 60);

    expect(sessions).toHaveLength(3);
    expect(sessions.map(s => s.noteIds)).toEqual([['3'], ['2'], ['1']]);
  });

  it('handles solo notes as single-note sessions', () => {
    const notes = [
      createNote({ id: '1', createdAt: hoursAgo(10) }),
    ];

    const sessions = clusterIntoSessions(notes, 60);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].noteIds).toHaveLength(1);
    expect(sessions[0].noteIds[0]).toBe('1');
  });

  it('returns sessions sorted by start time descending (most recent first)', () => {
    const notes = [
      createNote({ id: '1', createdAt: hoursAgo(10) }),
      createNote({ id: '2', createdAt: hoursAgo(5) }),
      createNote({ id: '3', createdAt: hoursAgo(1) }),
    ];

    const sessions = clusterIntoSessions(notes, 60);

    // Most recent session should be first
    expect(sessions[0].noteIds[0]).toBe('3');
    expect(sessions[1].noteIds[0]).toBe('2');
    expect(sessions[2].noteIds[0]).toBe('1');
  });

  it('handles empty notes array', () => {
    const sessions = clusterIntoSessions([], 60);
    expect(sessions).toHaveLength(0);
  });

  it('respects custom maxGapMinutes', () => {
    const notes = [
      createNote({ id: '1', createdAt: minutesAgo(60) }),
      createNote({ id: '2', createdAt: minutesAgo(30) }),  // 30 min after note 1
    ];

    // With 20 minute gap - should be separate
    const sessions20 = clusterIntoSessions(notes, 20);
    expect(sessions20).toHaveLength(2);

    // With 60 minute gap - should be together
    const sessions60 = clusterIntoSessions(notes, 60);
    expect(sessions60).toHaveLength(1);
  });

  it('sets correct start and end times for sessions', () => {
    const startTime = minutesAgo(60);
    const endTime = minutesAgo(10);

    const notes = [
      createNote({ id: '1', createdAt: startTime }),
      createNote({ id: '2', createdAt: minutesAgo(35) }),
      createNote({ id: '3', createdAt: endTime }),
    ];

    const sessions = clusterIntoSessions(notes, 60);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].startTime.getTime()).toBe(startTime.getTime());
    expect(sessions[0].endTime.getTime()).toBe(endTime.getTime());
  });

  it('handles notes on different days', () => {
    const notes = [
      createNote({ id: '1', createdAt: daysAgo(2) }),
      createNote({ id: '2', createdAt: daysAgo(1) }),
      createNote({ id: '3', createdAt: new Date() }),
    ];

    const sessions = clusterIntoSessions(notes, 60);

    expect(sessions).toHaveLength(3);
  });
});

describe('extractSessionTags', () => {
  it('returns common tags from session notes', () => {
    const notes = [
      createNote({ id: '1', tags: ['project', 'important'] }),
      createNote({ id: '2', tags: ['project', 'meeting'] }),
      createNote({ id: '3', tags: ['project'] }),
    ];

    const session = {
      id: 's1',
      startTime: new Date(),
      endTime: new Date(),
      noteIds: ['1', '2', '3'],
      topics: [],
      summary: '',
    };

    const tags = extractSessionTags(session, notes);

    expect(tags[0]).toBe('project'); // Most common
    expect(tags).toContain('important');
    expect(tags).toContain('meeting');
  });

  it('returns empty array when notes have no tags', () => {
    const notes = [
      createNote({ id: '1' }),
      createNote({ id: '2' }),
    ];

    const session = {
      id: 's1',
      startTime: new Date(),
      endTime: new Date(),
      noteIds: ['1', '2'],
      topics: [],
      summary: '',
    };

    const tags = extractSessionTags(session, notes);
    expect(tags).toHaveLength(0);
  });

  it('handles notes not found in notes array', () => {
    const notes = [
      createNote({ id: '1', tags: ['test'] }),
    ];

    const session = {
      id: 's1',
      startTime: new Date(),
      endTime: new Date(),
      noteIds: ['1', 'nonexistent'],
      topics: [],
      summary: '',
    };

    const tags = extractSessionTags(session, notes);
    expect(tags).toContain('test');
  });
});

describe('formatSessionDuration', () => {
  it('formats short sessions as "Just now"', () => {
    const now = new Date();
    const session = {
      id: 's1',
      startTime: now,
      endTime: now,
      noteIds: [],
      topics: [],
      summary: '',
    };

    expect(formatSessionDuration(session)).toBe('Just now');
  });

  it('formats sessions under an hour in minutes', () => {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const session = {
      id: 's1',
      startTime: thirtyMinAgo,
      endTime: now,
      noteIds: [],
      topics: [],
      summary: '',
    };

    expect(formatSessionDuration(session)).toBe('30 min');
  });

  it('formats sessions over an hour in hours and minutes', () => {
    const now = new Date();
    const ninetyMinAgo = new Date(now.getTime() - 90 * 60 * 1000);
    const session = {
      id: 's1',
      startTime: ninetyMinAgo,
      endTime: now,
      noteIds: [],
      topics: [],
      summary: '',
    };

    expect(formatSessionDuration(session)).toBe('1h 30m');
  });

  it('formats exact hours without minutes', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const session = {
      id: 's1',
      startTime: twoHoursAgo,
      endTime: now,
      noteIds: [],
      topics: [],
      summary: '',
    };

    expect(formatSessionDuration(session)).toBe('2h');
  });
});

describe('formatSessionTimeRange', () => {
  it('formats single-point session as single time', () => {
    const time = new Date('2026-01-07T14:30:00');
    const session = {
      id: 's1',
      startTime: time,
      endTime: time,
      noteIds: [],
      topics: [],
      summary: '',
    };

    expect(formatSessionTimeRange(session)).toBe('2:30 PM');
  });

  it('formats time range for sessions with duration', () => {
    const startTime = new Date('2026-01-07T14:30:00');
    const endTime = new Date('2026-01-07T16:45:00');
    const session = {
      id: 's1',
      startTime,
      endTime,
      noteIds: [],
      topics: [],
      summary: '',
    };

    expect(formatSessionTimeRange(session)).toBe('2:30 PM - 4:45 PM');
  });
});

describe('groupSessionsByDate', () => {
  it('groups sessions by their date', () => {
    const today = new Date();
    const yesterday = daysAgo(1);

    const sessions = [
      {
        id: 's1',
        startTime: today,
        endTime: today,
        noteIds: ['1'],
        topics: [],
        summary: '',
      },
      {
        id: 's2',
        startTime: today,
        endTime: today,
        noteIds: ['2'],
        topics: [],
        summary: '',
      },
      {
        id: 's3',
        startTime: yesterday,
        endTime: yesterday,
        noteIds: ['3'],
        topics: [],
        summary: '',
      },
    ];

    const grouped = groupSessionsByDate(sessions);

    expect(grouped.size).toBe(2);

    const todayKey = today.toISOString().split('T')[0];
    const yesterdayKey = yesterday.toISOString().split('T')[0];

    expect(grouped.get(todayKey)).toHaveLength(2);
    expect(grouped.get(yesterdayKey)).toHaveLength(1);
  });

  it('handles empty sessions array', () => {
    const grouped = groupSessionsByDate([]);
    expect(grouped.size).toBe(0);
  });
});

describe('formatDateHeader', () => {
  it('formats today as "Today"', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(formatDateHeader(today)).toBe('Today');
  });

  it('formats yesterday as "Yesterday"', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    expect(formatDateHeader(yesterdayStr)).toBe('Yesterday');
  });

  it('formats other dates with full format', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const dateStr = twoDaysAgo.toISOString().split('T')[0];

    const formatted = formatDateHeader(dateStr);

    // Should include day of week and month
    expect(formatted).toMatch(/\w+day/); // Monday, Tuesday, etc.
    expect(formatted).toMatch(/\w+/); // Month name
    expect(formatted).toMatch(/\d+/); // Day number
  });
});

/**
 * Thinking Session Service
 * Groups notes into "thinking sessions" - clusters of related work within short time windows.
 */

import type { Note } from '../types/note';
import { extractFromNote } from './brain';
import { isAIAvailable } from './ai';
import { env } from '../config/env';

export interface ThinkingSession {
  id: string;
  startTime: Date;
  endTime: Date;
  noteIds: string[];
  topics: string[];
  summary: string;
}

/**
 * Cluster notes into thinking sessions based on time proximity
 * @param notes Notes to cluster
 * @param maxGapMinutes Maximum gap between notes to be in the same session (default: 60 minutes)
 * @returns Array of thinking sessions sorted by start time (most recent first)
 */
export function clusterIntoSessions(notes: Note[], maxGapMinutes: number = 60): ThinkingSession[] {
  if (notes.length === 0) return [];

  // Sort notes by createdAt ascending
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const sessions: ThinkingSession[] = [];
  let currentSession: {
    noteIds: string[];
    startTime: Date;
    endTime: Date;
  } | null = null;

  const maxGapMs = maxGapMinutes * 60 * 1000;

  for (const note of sortedNotes) {
    const noteTime = new Date(note.createdAt);

    if (!currentSession) {
      // Start a new session
      currentSession = {
        noteIds: [note.id],
        startTime: noteTime,
        endTime: noteTime,
      };
    } else {
      // Check if this note is within the time window
      const timeSinceLastNote = noteTime.getTime() - currentSession.endTime.getTime();

      if (timeSinceLastNote <= maxGapMs) {
        // Add to current session
        currentSession.noteIds.push(note.id);
        currentSession.endTime = noteTime;
      } else {
        // Finalize current session and start a new one
        sessions.push({
          id: generateSessionId(),
          startTime: currentSession.startTime,
          endTime: currentSession.endTime,
          noteIds: currentSession.noteIds,
          topics: [],
          summary: '',
        });

        currentSession = {
          noteIds: [note.id],
          startTime: noteTime,
          endTime: noteTime,
        };
      }
    }
  }

  // Finalize the last session
  if (currentSession) {
    sessions.push({
      id: generateSessionId(),
      startTime: currentSession.startTime,
      endTime: currentSession.endTime,
      noteIds: currentSession.noteIds,
      topics: [],
      summary: '',
    });
  }

  // Sort sessions by start time descending (most recent first)
  return sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
}

/**
 * Extract topics from notes in a session
 * @param session The thinking session
 * @param notes All notes (to look up by ID)
 * @returns Array of top 3 topic names
 */
export async function extractSessionTopics(session: ThinkingSession, notes: Note[]): Promise<string[]> {
  const sessionNotes = session.noteIds
    .map(id => notes.find(n => n.id === id))
    .filter((n): n is Note => n !== undefined);

  if (sessionNotes.length === 0) return [];

  // Collect all concepts from session notes
  const conceptCounts = new Map<string, number>();

  for (const note of sessionNotes) {
    try {
      const extraction = await extractFromNote(note);
      for (const concept of extraction.concepts) {
        const name = concept.name.toLowerCase();
        conceptCounts.set(name, (conceptCounts.get(name) || 0) + 1);
      }
    } catch (error) {
      // If extraction fails, try simple approach
      const words = extractKeywords(note.title + ' ' + note.content);
      for (const word of words.slice(0, 5)) {
        conceptCounts.set(word, (conceptCounts.get(word) || 0) + 1);
      }
    }
  }

  // Also extract from tags
  for (const note of sessionNotes) {
    if (note.tags) {
      for (const tag of note.tags) {
        conceptCounts.set(tag.toLowerCase(), (conceptCounts.get(tag.toLowerCase()) || 0) + 1);
      }
    }
  }

  // Return top 3 concepts
  return [...conceptCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}

/**
 * Extract common tags from notes in a session
 * @param session The thinking session
 * @param notes All notes (to look up by ID)
 * @returns Array of common tags
 */
export function extractSessionTags(session: ThinkingSession, notes: Note[]): string[] {
  const sessionNotes = session.noteIds
    .map(id => notes.find(n => n.id === id))
    .filter((n): n is Note => n !== undefined);

  const tagCounts = new Map<string, number>();

  for (const note of sessionNotes) {
    if (note.tags) {
      for (const tag of note.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  // Return tags sorted by frequency
  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);
}

/**
 * Generate a summary for a thinking session
 * @param session The thinking session
 * @param notes All notes (to look up by ID)
 * @returns Summary string
 */
export async function generateSessionSummary(session: ThinkingSession, notes: Note[]): Promise<string> {
  const sessionNotes = session.noteIds
    .map(id => notes.find(n => n.id === id))
    .filter((n): n is Note => n !== undefined);

  if (sessionNotes.length === 0) return 'Empty session';

  // If only one note, use its title
  if (sessionNotes.length === 1) {
    return sessionNotes[0].title || 'Untitled note';
  }

  // Try AI summary if available
  if (isAIAvailable() && sessionNotes.length >= 2) {
    try {
      const summary = await generateAISummary(sessionNotes);
      if (summary) return summary;
    } catch (error) {
      console.error('AI summary failed:', error);
    }
  }

  // Fallback: generate from note titles and topics
  const topics = await extractSessionTopics(session, notes);
  const noteCount = sessionNotes.length;

  if (topics.length > 0) {
    return `${noteCount} notes about ${topics.slice(0, 2).join(', ')}`;
  }

  // Use note titles as fallback
  const titles = sessionNotes
    .map(n => n.title || 'Untitled')
    .slice(0, 3);

  if (titles.length === sessionNotes.length) {
    return titles.join(', ');
  }

  return `${titles.join(', ')} and ${sessionNotes.length - titles.length} more`;
}

/**
 * Generate AI-powered summary for notes
 */
async function generateAISummary(notes: Note[]): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;

  const notesText = notes
    .map(n => `"${n.title || 'Untitled'}": ${n.content.slice(0, 100)}`)
    .join('\n');

  const prompt = `Summarize what these notes are about in one short sentence (max 15 words):
${notesText}

Return only the summary, no explanation.`;

  try {
    if (provider.type === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50,
          temperature: 0.3,
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.choices[0]?.message?.content?.trim() || null;
    }

    // Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 50,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.content[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

function getProvider() {
  if (env.aiProvider === 'openai' && env.openai.apiKey) {
    return {
      type: 'openai' as const,
      apiKey: env.openai.apiKey,
      model: env.openai.model,
    };
  }
  if (env.aiProvider === 'anthropic' && env.anthropic.apiKey) {
    return {
      type: 'anthropic' as const,
      apiKey: env.anthropic.apiKey,
      model: env.anthropic.model,
    };
  }
  return null;
}

/**
 * Simple keyword extraction (fallback when AI not available)
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'under',
    'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
    'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
    'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
    'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
    'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
    'his', 'she', 'her', 'they', 'them', 'their',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Format session duration for display
 */
export function formatSessionDuration(session: ThinkingSession): string {
  const startTime = new Date(session.startTime);
  const endTime = new Date(session.endTime);
  const durationMs = endTime.getTime() - startTime.getTime();

  if (durationMs < 60000) {
    return 'Just now';
  }

  const minutes = Math.floor(durationMs / 60000);
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format session time range for display
 */
export function formatSessionTimeRange(session: ThinkingSession): string {
  const startTime = new Date(session.startTime);
  const endTime = new Date(session.endTime);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (startTime.getTime() === endTime.getTime()) {
    return formatTime(startTime);
  }

  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

/**
 * Group sessions by date for timeline display
 */
export function groupSessionsByDate(sessions: ThinkingSession[]): Map<string, ThinkingSession[]> {
  const grouped = new Map<string, ThinkingSession[]>();

  for (const session of sessions) {
    const dateKey = new Date(session.startTime).toISOString().split('T')[0];
    const existing = grouped.get(dateKey) || [];
    existing.push(session);
    grouped.set(dateKey, existing);
  }

  return grouped;
}

/**
 * Format date for timeline header
 */
export function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.toISOString().split('T')[0] === d2.toISOString().split('T')[0];

  if (isSameDay(date, today)) {
    return 'Today';
  }

  if (isSameDay(date, yesterday)) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Session Comparison Service
 *
 * Compare two thinking sessions to identify how thinking evolved,
 * what changed, and what was learned between sessions.
 */

import type { ThinkingSession, ThinkingEvent, SessionStats } from '../types/session';
import { getSessionStats } from './sessionRecorder';

export interface SessionComparison {
  session1: ThinkingSession;
  session2: ThinkingSession;
  /** Notes that appear in both sessions */
  commonNotes: string[];
  /** Notes only in session 1 */
  uniqueToSession1: string[];
  /** Notes only in session 2 */
  uniqueToSession2: string[];
  /** Stats comparison */
  statsComparison: StatsComparison;
  /** Activity timeline comparison */
  timelineComparison: TimelineComparison;
  /** Topic evolution analysis */
  topicEvolution: TopicEvolution;
  /** Focus area changes */
  focusComparison: FocusComparison;
}

export interface StatsComparison {
  session1Stats: SessionStats;
  session2Stats: SessionStats;
  /** Percentage changes */
  changes: {
    notesCreated: number;
    notesEdited: number;
    notesMoved: number;
    connectionsCreated: number;
    aiQueries: number;
    duration: number;
  };
}

export interface TimelineComparison {
  /** Events binned by time segment (e.g., first 5 min, next 5 min, etc.) */
  session1Segments: TimeSegment[];
  session2Segments: TimeSegment[];
  /** Common patterns between sessions */
  commonPatterns: string[];
  /** Key differences */
  differences: string[];
}

export interface TimeSegment {
  startMs: number;
  endMs: number;
  eventCount: number;
  dominantActivity: 'creating' | 'editing' | 'organizing' | 'connecting' | 'idle';
  notesAffected: string[];
}

export interface TopicEvolution {
  /** Topics explored in session 1 but not 2 */
  abandonedTopics: string[];
  /** Topics explored in session 2 but not 1 */
  newTopics: string[];
  /** Topics expanded between sessions */
  expandedTopics: Array<{
    topic: string;
    session1Depth: number;
    session2Depth: number;
    change: 'expanded' | 'reduced' | 'stable';
  }>;
  /** Topic connections added between sessions */
  newConnections: Array<{
    from: string;
    to: string;
    session: 1 | 2;
  }>;
}

export interface FocusComparison {
  /** Most-interacted notes in session 1 */
  session1Focus: Array<{ noteId: string; interactionCount: number }>;
  /** Most-interacted notes in session 2 */
  session2Focus: Array<{ noteId: string; interactionCount: number }>;
  /** Notes that gained focus */
  increasedFocus: string[];
  /** Notes that lost focus */
  decreasedFocus: string[];
}

export interface LearningInsights {
  /** High-level summary of what changed */
  summary: string;
  /** Key learnings extracted */
  keyLearnings: string[];
  /** Questions that emerged */
  emergentQuestions: string[];
  /** Recommended next steps */
  recommendations: string[];
  /** Overall assessment */
  assessment: 'significant-progress' | 'iterative-refinement' | 'exploratory' | 'revisiting';
}

const SEGMENT_DURATION_MS = 5 * 60 * 1000; // 5-minute segments

/**
 * Compare two thinking sessions
 */
export function compareSessions(
  session1: ThinkingSession,
  session2: ThinkingSession
): SessionComparison {
  const allNotes1 = getAllNotesInSession(session1);
  const allNotes2 = getAllNotesInSession(session2);

  const commonNotes = allNotes1.filter((n) => allNotes2.includes(n));
  const uniqueToSession1 = allNotes1.filter((n) => !allNotes2.includes(n));
  const uniqueToSession2 = allNotes2.filter((n) => !allNotes1.includes(n));

  return {
    session1,
    session2,
    commonNotes,
    uniqueToSession1,
    uniqueToSession2,
    statsComparison: compareStats(session1, session2),
    timelineComparison: compareTimelines(session1, session2),
    topicEvolution: analyzeTopicEvolution(session1, session2, commonNotes, uniqueToSession1, uniqueToSession2),
    focusComparison: compareFocus(session1, session2),
  };
}

/**
 * Get all note IDs involved in a session
 */
function getAllNotesInSession(session: ThinkingSession): string[] {
  const notes = new Set<string>([
    ...session.canvasSnapshot.existingNoteIds,
    ...session.createdNoteIds,
    ...session.modifiedNoteIds,
  ]);

  session.events.forEach((event) => {
    if ('noteId' in event.payload) {
      notes.add((event.payload as { noteId: string }).noteId);
    }
    if ('sourceNoteId' in event.payload) {
      const payload = event.payload as { sourceNoteId: string; targetNoteId: string };
      notes.add(payload.sourceNoteId);
      notes.add(payload.targetNoteId);
    }
  });

  return Array.from(notes);
}

/**
 * Compare session statistics
 */
function compareStats(session1: ThinkingSession, session2: ThinkingSession): StatsComparison {
  const stats1 = getSessionStats(session1);
  const stats2 = getSessionStats(session2);

  const calcChange = (v1: number, v2: number) => {
    if (v1 === 0) return v2 > 0 ? 100 : 0;
    return Math.round(((v2 - v1) / v1) * 100);
  };

  return {
    session1Stats: stats1,
    session2Stats: stats2,
    changes: {
      notesCreated: calcChange(stats1.notesCreated, stats2.notesCreated),
      notesEdited: calcChange(stats1.notesEdited, stats2.notesEdited),
      notesMoved: calcChange(stats1.notesMoved, stats2.notesMoved),
      connectionsCreated: calcChange(stats1.connectionsCreated, stats2.connectionsCreated),
      aiQueries: calcChange(stats1.aiQueries, stats2.aiQueries),
      duration: calcChange(stats1.durationMs, stats2.durationMs),
    },
  };
}

/**
 * Compare session timelines
 */
function compareTimelines(session1: ThinkingSession, session2: ThinkingSession): TimelineComparison {
  const segments1 = segmentSession(session1);
  const segments2 = segmentSession(session2);

  const patterns1 = extractPatterns(segments1);
  const patterns2 = extractPatterns(segments2);
  const commonPatterns = patterns1.filter((p) => patterns2.includes(p));
  const differences = findDifferences(segments1, segments2);

  return {
    session1Segments: segments1,
    session2Segments: segments2,
    commonPatterns,
    differences,
  };
}

/**
 * Segment a session into time-based chunks
 */
function segmentSession(session: ThinkingSession): TimeSegment[] {
  const segments: TimeSegment[] = [];
  const segmentCount = Math.ceil(session.durationMs / SEGMENT_DURATION_MS);

  for (let i = 0; i < Math.max(1, segmentCount); i++) {
    const startMs = i * SEGMENT_DURATION_MS;
    const endMs = Math.min((i + 1) * SEGMENT_DURATION_MS, session.durationMs);

    const segmentEvents = session.events.filter(
      (e) => e.timestamp >= startMs && e.timestamp < endMs
    );

    const notesAffected = new Set<string>();
    const activityCounts = {
      creating: 0,
      editing: 0,
      organizing: 0,
      connecting: 0,
    };

    segmentEvents.forEach((event) => {
      if ('noteId' in event.payload) {
        notesAffected.add((event.payload as { noteId: string }).noteId);
      }

      switch (event.type) {
        case 'note-create':
          activityCounts.creating++;
          break;
        case 'note-edit':
          activityCounts.editing++;
          break;
        case 'note-move':
        case 'viewport-change':
          activityCounts.organizing++;
          break;
        case 'note-connect':
          activityCounts.connecting++;
          break;
      }
    });

    const dominantActivity =
      segmentEvents.length === 0
        ? 'idle'
        : (Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0][0] as TimeSegment['dominantActivity']);

    segments.push({
      startMs,
      endMs,
      eventCount: segmentEvents.length,
      dominantActivity,
      notesAffected: Array.from(notesAffected),
    });
  }

  return segments;
}

/**
 * Extract activity patterns from segments
 */
function extractPatterns(segments: TimeSegment[]): string[] {
  const patterns: string[] = [];

  // Pattern: Starts with creating
  if (segments.length > 0 && segments[0].dominantActivity === 'creating') {
    patterns.push('starts-with-creation');
  }

  // Pattern: Ends with organizing
  if (segments.length > 0 && segments[segments.length - 1].dominantActivity === 'organizing') {
    patterns.push('ends-with-organization');
  }

  // Pattern: High editing activity
  const editingSegments = segments.filter((s) => s.dominantActivity === 'editing').length;
  if (editingSegments > segments.length / 2) {
    patterns.push('editing-heavy');
  }

  // Pattern: Connection building
  const connectingSegments = segments.filter((s) => s.dominantActivity === 'connecting').length;
  if (connectingSegments > 0) {
    patterns.push('connection-building');
  }

  // Pattern: Burst activity
  const highActivitySegments = segments.filter((s) => s.eventCount > 20);
  if (highActivitySegments.length > 0) {
    patterns.push('burst-activity');
  }

  return patterns;
}

/**
 * Find differences between two segment sequences
 */
function findDifferences(segments1: TimeSegment[], segments2: TimeSegment[]): string[] {
  const differences: string[] = [];

  const avgEvents1 = segments1.reduce((sum, s) => sum + s.eventCount, 0) / Math.max(1, segments1.length);
  const avgEvents2 = segments2.reduce((sum, s) => sum + s.eventCount, 0) / Math.max(1, segments2.length);

  if (avgEvents2 > avgEvents1 * 1.5) {
    differences.push('Session 2 was more active');
  } else if (avgEvents1 > avgEvents2 * 1.5) {
    differences.push('Session 1 was more active');
  }

  const activities1 = new Set(segments1.map((s) => s.dominantActivity));
  const activities2 = new Set(segments2.map((s) => s.dominantActivity));

  if (activities2.has('connecting') && !activities1.has('connecting')) {
    differences.push('Session 2 introduced note connections');
  }

  if (activities2.has('editing') && activities1.size === 1 && activities1.has('creating')) {
    differences.push('Session 2 refined existing notes');
  }

  return differences;
}

/**
 * Analyze how topics evolved between sessions
 */
function analyzeTopicEvolution(
  session1: ThinkingSession,
  session2: ThinkingSession,
  commonNotes: string[],
  uniqueToSession1: string[],
  uniqueToSession2: string[]
): TopicEvolution {
  // Extract connections from events
  const connections1 = extractConnections(session1);
  const connections2 = extractConnections(session2);

  // Find new connections
  const newConnections = connections2
    .filter((c2) => !connections1.some((c1) => c1.from === c2.from && c1.to === c2.to))
    .map((c) => ({ ...c, session: 2 as const }));

  // Calculate "depth" as interaction count per note
  const depth1 = calculateNoteDepth(session1);
  const depth2 = calculateNoteDepth(session2);

  const expandedTopics = commonNotes.map((noteId) => ({
    topic: noteId,
    session1Depth: depth1[noteId] || 0,
    session2Depth: depth2[noteId] || 0,
    change: (depth2[noteId] || 0) > (depth1[noteId] || 0)
      ? 'expanded' as const
      : (depth2[noteId] || 0) < (depth1[noteId] || 0)
      ? 'reduced' as const
      : 'stable' as const,
  }));

  return {
    abandonedTopics: uniqueToSession1,
    newTopics: uniqueToSession2,
    expandedTopics,
    newConnections,
  };
}

/**
 * Extract note connections from session events
 */
function extractConnections(session: ThinkingSession): Array<{ from: string; to: string }> {
  return session.events
    .filter((e) => e.type === 'note-connect')
    .map((e) => {
      const payload = e.payload as { sourceNoteId: string; targetNoteId: string };
      return { from: payload.sourceNoteId, to: payload.targetNoteId };
    });
}

/**
 * Calculate interaction depth per note
 */
function calculateNoteDepth(session: ThinkingSession): Record<string, number> {
  const depth: Record<string, number> = {};

  session.events.forEach((event) => {
    let noteId: string | undefined;

    if ('noteId' in event.payload) {
      noteId = (event.payload as { noteId: string }).noteId;
    }

    if (noteId) {
      depth[noteId] = (depth[noteId] || 0) + 1;
    }
  });

  return depth;
}

/**
 * Compare focus areas between sessions
 */
function compareFocus(session1: ThinkingSession, session2: ThinkingSession): FocusComparison {
  const depth1 = calculateNoteDepth(session1);
  const depth2 = calculateNoteDepth(session2);

  const session1Focus = Object.entries(depth1)
    .map(([noteId, count]) => ({ noteId, interactionCount: count }))
    .sort((a, b) => b.interactionCount - a.interactionCount)
    .slice(0, 5);

  const session2Focus = Object.entries(depth2)
    .map(([noteId, count]) => ({ noteId, interactionCount: count }))
    .sort((a, b) => b.interactionCount - a.interactionCount)
    .slice(0, 5);

  const allNotes = new Set([...Object.keys(depth1), ...Object.keys(depth2)]);
  const increasedFocus: string[] = [];
  const decreasedFocus: string[] = [];

  allNotes.forEach((noteId) => {
    const d1 = depth1[noteId] || 0;
    const d2 = depth2[noteId] || 0;
    if (d2 > d1 * 1.5 && d2 >= 3) {
      increasedFocus.push(noteId);
    } else if (d1 > d2 * 1.5 && d1 >= 3) {
      decreasedFocus.push(noteId);
    }
  });

  return {
    session1Focus,
    session2Focus,
    increasedFocus,
    decreasedFocus,
  };
}

/**
 * Generate learning insights from comparison (AI-enhanced)
 */
export async function generateLearningInsights(
  comparison: SessionComparison,
  aiClient?: (prompt: string) => Promise<string>
): Promise<LearningInsights> {
  // Generate summary based on comparison data
  const summary = generateSummary(comparison);
  const keyLearnings = extractKeyLearnings(comparison);
  const emergentQuestions = generateQuestions(comparison);
  const recommendations = generateRecommendations(comparison);
  const assessment = assessProgress(comparison);

  // If AI is available, enhance with AI insights
  if (aiClient) {
    try {
      const enhancedInsights = await enhanceWithAI(comparison, aiClient);
      return {
        ...enhancedInsights,
        assessment,
      };
    } catch (error) {
      console.error('AI enhancement failed, using basic insights:', error);
    }
  }

  return {
    summary,
    keyLearnings,
    emergentQuestions,
    recommendations,
    assessment,
  };
}

function generateSummary(comparison: SessionComparison): string {
  const { statsComparison, topicEvolution, focusComparison } = comparison;
  const parts: string[] = [];

  // Duration comparison
  if (statsComparison.changes.duration > 20) {
    parts.push(`Session 2 was ${statsComparison.changes.duration}% longer`);
  } else if (statsComparison.changes.duration < -20) {
    parts.push(`Session 2 was ${Math.abs(statsComparison.changes.duration)}% shorter`);
  }

  // Activity changes
  if (statsComparison.changes.notesCreated > 50) {
    parts.push('with significantly more note creation');
  }
  if (statsComparison.changes.connectionsCreated > 50) {
    parts.push('and more connection-building');
  }

  // Topic changes
  if (topicEvolution.newTopics.length > 2) {
    parts.push(`Explored ${topicEvolution.newTopics.length} new topics`);
  }
  if (topicEvolution.abandonedTopics.length > 2) {
    parts.push(`while setting aside ${topicEvolution.abandonedTopics.length} earlier threads`);
  }

  // Focus changes
  if (focusComparison.increasedFocus.length > 0) {
    parts.push(`Deepened focus on ${focusComparison.increasedFocus.length} notes`);
  }

  return parts.length > 0
    ? parts.join('. ') + '.'
    : 'The sessions had similar structure and activity levels.';
}

function extractKeyLearnings(comparison: SessionComparison): string[] {
  const learnings: string[] = [];
  const { topicEvolution, focusComparison, statsComparison } = comparison;

  if (topicEvolution.newTopics.length > 0) {
    learnings.push(`Discovered ${topicEvolution.newTopics.length} new areas worth exploring`);
  }

  const expanded = topicEvolution.expandedTopics.filter((t) => t.change === 'expanded');
  if (expanded.length > 0) {
    learnings.push(`Deepened understanding in ${expanded.length} topics`);
  }

  if (topicEvolution.newConnections.length > 0) {
    learnings.push(`Found ${topicEvolution.newConnections.length} new connections between ideas`);
  }

  if (statsComparison.session2Stats.aiQueries > statsComparison.session1Stats.aiQueries) {
    learnings.push('Leveraged AI assistance more in the second session');
  }

  if (focusComparison.increasedFocus.length > focusComparison.decreasedFocus.length) {
    learnings.push('Converged toward core topics');
  } else if (focusComparison.decreasedFocus.length > focusComparison.increasedFocus.length) {
    learnings.push('Explored more breadth, less depth');
  }

  return learnings;
}

function generateQuestions(comparison: SessionComparison): string[] {
  const questions: string[] = [];
  const { topicEvolution, focusComparison } = comparison;

  if (topicEvolution.abandonedTopics.length > 0) {
    questions.push('Why were earlier topics set aside? Should they be revisited?');
  }

  if (topicEvolution.newTopics.length === 0 && comparison.commonNotes.length > 0) {
    questions.push('Is there value in exploring new directions?');
  }

  const reduced = topicEvolution.expandedTopics.filter((t) => t.change === 'reduced');
  if (reduced.length > 0) {
    questions.push('Some topics received less attention - is that intentional?');
  }

  if (focusComparison.session2Focus.length > 0) {
    questions.push('What drove the focus toward the top topics?');
  }

  return questions;
}

function generateRecommendations(comparison: SessionComparison): string[] {
  const recommendations: string[] = [];
  const { topicEvolution, statsComparison, focusComparison } = comparison;

  if (topicEvolution.newConnections.length === 0 && comparison.commonNotes.length > 3) {
    recommendations.push('Consider connecting related notes to build a knowledge network');
  }

  if (topicEvolution.abandonedTopics.length > 3) {
    recommendations.push('Review abandoned topics to archive or consolidate them');
  }

  if (statsComparison.session2Stats.notesCreated > 10 && statsComparison.session2Stats.notesEdited < 3) {
    recommendations.push('Take time to refine and edit newly created notes');
  }

  const expanded = topicEvolution.expandedTopics.filter((t) => t.change === 'expanded');
  if (expanded.length > 0) {
    recommendations.push('Continue developing the topics showing momentum');
  }

  return recommendations;
}

function assessProgress(comparison: SessionComparison): LearningInsights['assessment'] {
  const { statsComparison, topicEvolution, focusComparison } = comparison;

  // Significant progress: Many new notes, connections, or topics
  if (
    statsComparison.changes.notesCreated > 50 ||
    topicEvolution.newConnections.length > 3 ||
    topicEvolution.newTopics.length > 3
  ) {
    return 'significant-progress';
  }

  // Exploratory: High breadth, low depth
  if (
    topicEvolution.newTopics.length > topicEvolution.abandonedTopics.length &&
    focusComparison.increasedFocus.length < focusComparison.decreasedFocus.length
  ) {
    return 'exploratory';
  }

  // Revisiting: Mostly working on existing notes
  if (
    comparison.commonNotes.length > topicEvolution.newTopics.length * 2 &&
    statsComparison.changes.notesEdited > statsComparison.changes.notesCreated
  ) {
    return 'revisiting';
  }

  // Default: Iterative refinement
  return 'iterative-refinement';
}

async function enhanceWithAI(
  comparison: SessionComparison,
  aiClient: (prompt: string) => Promise<string>
): Promise<Omit<LearningInsights, 'assessment'>> {
  const prompt = `Analyze these two thinking sessions and provide insights:

Session 1:
- Duration: ${Math.round(comparison.session1.durationMs / 60000)} minutes
- Notes created: ${comparison.statsComparison.session1Stats.notesCreated}
- Notes edited: ${comparison.statsComparison.session1Stats.notesEdited}
- Connections: ${comparison.statsComparison.session1Stats.connectionsCreated}

Session 2:
- Duration: ${Math.round(comparison.session2.durationMs / 60000)} minutes
- Notes created: ${comparison.statsComparison.session2Stats.notesCreated}
- Notes edited: ${comparison.statsComparison.session2Stats.notesEdited}
- Connections: ${comparison.statsComparison.session2Stats.connectionsCreated}

Changes:
- New topics explored: ${comparison.topicEvolution.newTopics.length}
- Topics set aside: ${comparison.topicEvolution.abandonedTopics.length}
- Notes with increased focus: ${comparison.focusComparison.increasedFocus.length}
- Notes with decreased focus: ${comparison.focusComparison.decreasedFocus.length}
- New connections made: ${comparison.topicEvolution.newConnections.length}

Provide a JSON response with:
{
  "summary": "One paragraph summary of how thinking evolved",
  "keyLearnings": ["learning1", "learning2", "learning3"],
  "emergentQuestions": ["question1", "question2"],
  "recommendations": ["rec1", "rec2"]
}`;

  const response = await aiClient(prompt);

  try {
    const parsed = JSON.parse(response);
    return {
      summary: parsed.summary || generateSummary(comparison),
      keyLearnings: parsed.keyLearnings || extractKeyLearnings(comparison),
      emergentQuestions: parsed.emergentQuestions || generateQuestions(comparison),
      recommendations: parsed.recommendations || generateRecommendations(comparison),
    };
  } catch {
    return {
      summary: generateSummary(comparison),
      keyLearnings: extractKeyLearnings(comparison),
      emergentQuestions: generateQuestions(comparison),
      recommendations: generateRecommendations(comparison),
    };
  }
}

/**
 * Check if two sessions are related (share tags or notes)
 */
export function areSessionsRelated(session1: ThinkingSession, session2: ThinkingSession): boolean {
  // Check for shared tags
  const sharedTags = session1.tags.filter((t) => session2.tags.includes(t));
  if (sharedTags.length > 0) return true;

  // Check for shared notes
  const allNotes1 = getAllNotesInSession(session1);
  const allNotes2 = getAllNotesInSession(session2);
  const sharedNotes = allNotes1.filter((n) => allNotes2.includes(n));
  return sharedNotes.length >= 2;
}

/**
 * Find related sessions for comparison
 */
export function findRelatedSessions(
  targetSession: ThinkingSession,
  allSessions: ThinkingSession[]
): ThinkingSession[] {
  return allSessions
    .filter((s) => s.id !== targetSession.id && areSessionsRelated(targetSession, s))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

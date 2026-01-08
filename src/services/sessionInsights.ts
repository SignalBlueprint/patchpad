/**
 * Session Insights Service
 *
 * Analyzes thinking sessions to extract patterns, hotspots, and insights.
 * Provides metrics like time spent in areas, revisitation patterns, and activity clusters.
 */

import type {
  ThinkingSession,
  ThinkingEvent,
  NoteMovePayload,
  ViewportChangePayload,
} from '../types/session';
import { isAIAvailable } from './ai';

/**
 * Insight types that can be generated from session analysis
 */
export interface SessionInsight {
  type: 'time-spent' | 'revisitation' | 'cluster' | 'breakthrough' | 'pattern' | 'ai-usage';
  title: string;
  description: string;
  timestamp?: number;
  noteIds?: string[];
  metric?: number;
  icon: string;
}

/**
 * Region of activity on the canvas
 */
export interface ActivityRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  eventCount: number;
  totalTime: number;
  noteIds: string[];
}

/**
 * Heatmap cell for visualization
 */
export interface HeatmapCell {
  x: number;
  y: number;
  intensity: number; // 0-1
}

/**
 * Analyze session and generate insights
 */
export function analyzeSession(session: ThinkingSession): SessionInsight[] {
  const insights: SessionInsight[] = [];

  // Time spent analysis
  const timeInsights = analyzeTimeSpent(session);
  insights.push(...timeInsights);

  // Revisitation patterns
  const revisitInsights = analyzeRevisitations(session);
  insights.push(...revisitInsights);

  // Activity clusters
  const clusterInsights = analyzeActivityClusters(session);
  insights.push(...clusterInsights);

  // Breakthrough moments (long pauses followed by rapid activity)
  const breakthroughInsights = detectBreakthroughs(session);
  insights.push(...breakthroughInsights);

  // AI usage patterns
  const aiInsights = analyzeAIUsage(session);
  insights.push(...aiInsights);

  // Sort by relevance (metric or timestamp)
  return insights.sort((a, b) => (b.metric || 0) - (a.metric || 0));
}

/**
 * Analyze time spent in different areas
 */
function analyzeTimeSpent(session: ThinkingSession): SessionInsight[] {
  const insights: SessionInsight[] = [];
  const events = session.events;

  // Track time between viewport changes
  const viewportEvents = events.filter(e => e.type === 'viewport-change');

  if (viewportEvents.length < 2) return insights;

  // Find longest focused period
  let longestFocusDuration = 0;
  let longestFocusStart = 0;
  let longestFocusEnd = 0;

  for (let i = 0; i < viewportEvents.length - 1; i++) {
    const duration = viewportEvents[i + 1].timestamp - viewportEvents[i].timestamp;
    if (duration > longestFocusDuration) {
      longestFocusDuration = duration;
      longestFocusStart = viewportEvents[i].timestamp;
      longestFocusEnd = viewportEvents[i + 1].timestamp;
    }
  }

  if (longestFocusDuration > 60000) { // More than 1 minute
    insights.push({
      type: 'time-spent',
      title: 'Deep Focus Period',
      description: `You spent ${Math.round(longestFocusDuration / 60000)} minutes focused in one area before moving on`,
      timestamp: longestFocusStart,
      metric: longestFocusDuration,
      icon: '🎯',
    });
  }

  // Track time spent per note
  const noteTimeMap = new Map<string, number>();
  const noteEditEvents = events.filter(e => e.type === 'note-edit');

  for (let i = 0; i < noteEditEvents.length; i++) {
    const event = noteEditEvents[i];
    const noteId = (event.payload as { noteId: string }).noteId;
    const nextTime = noteEditEvents[i + 1]?.timestamp || session.durationMs;
    const duration = Math.min(nextTime - event.timestamp, 300000); // Cap at 5 min per edit

    noteTimeMap.set(noteId, (noteTimeMap.get(noteId) || 0) + duration);
  }

  // Find most worked-on note
  let mostWorkedNote = '';
  let mostWorkedTime = 0;

  for (const [noteId, time] of noteTimeMap) {
    if (time > mostWorkedTime) {
      mostWorkedTime = time;
      mostWorkedNote = noteId;
    }
  }

  if (mostWorkedTime > 120000) { // More than 2 minutes
    insights.push({
      type: 'time-spent',
      title: 'Most Worked On',
      description: `You spent about ${Math.round(mostWorkedTime / 60000)} minutes editing one note`,
      noteIds: [mostWorkedNote],
      metric: mostWorkedTime,
      icon: '✏️',
    });
  }

  return insights;
}

/**
 * Analyze how often notes were revisited
 */
function analyzeRevisitations(session: ThinkingSession): SessionInsight[] {
  const insights: SessionInsight[] = [];
  const events = session.events;

  // Track note visits
  const noteVisits = new Map<string, number[]>();

  for (const event of events) {
    if ('noteId' in event.payload) {
      const noteId = (event.payload as { noteId: string }).noteId;
      if (!noteVisits.has(noteId)) {
        noteVisits.set(noteId, []);
      }
      noteVisits.get(noteId)!.push(event.timestamp);
    }
  }

  // Find most revisited notes
  const revisitCounts: Array<{ noteId: string; count: number }> = [];

  for (const [noteId, visits] of noteVisits) {
    // Count distinct visits (gaps of at least 30 seconds between interactions)
    let distinctVisits = 1;
    for (let i = 1; i < visits.length; i++) {
      if (visits[i] - visits[i - 1] > 30000) {
        distinctVisits++;
      }
    }
    if (distinctVisits > 1) {
      revisitCounts.push({ noteId, count: distinctVisits });
    }
  }

  revisitCounts.sort((a, b) => b.count - a.count);

  if (revisitCounts.length > 0 && revisitCounts[0].count >= 3) {
    insights.push({
      type: 'revisitation',
      title: 'Frequently Revisited',
      description: `You returned to one note ${revisitCounts[0].count} times during this session`,
      noteIds: [revisitCounts[0].noteId],
      metric: revisitCounts[0].count,
      icon: '🔄',
    });
  }

  // Multiple notes revisited pattern
  const multipleRevisits = revisitCounts.filter(r => r.count >= 2);
  if (multipleRevisits.length >= 3) {
    insights.push({
      type: 'revisitation',
      title: 'Iterative Thinking',
      description: `You revisited ${multipleRevisits.length} different notes multiple times, suggesting iterative development`,
      noteIds: multipleRevisits.map(r => r.noteId),
      metric: multipleRevisits.length,
      icon: '♻️',
    });
  }

  return insights;
}

/**
 * Analyze activity clusters (regions where ideas grouped)
 */
function analyzeActivityClusters(session: ThinkingSession): SessionInsight[] {
  const insights: SessionInsight[] = [];
  const events = session.events;

  // Collect note positions
  const positions: Array<{ x: number; y: number; noteId: string }> = [];

  for (const event of events) {
    if (event.type === 'note-move') {
      const payload = event.payload as NoteMovePayload;
      positions.push({ x: payload.toX, y: payload.toY, noteId: payload.noteId });
    } else if (event.type === 'note-create') {
      const payload = event.payload as { noteId: string; x: number; y: number };
      positions.push({ x: payload.x, y: payload.y, noteId: payload.noteId });
    }
  }

  if (positions.length < 3) return insights;

  // Simple clustering: divide canvas into regions and count activity
  const regions = detectRegions(positions);

  if (regions.length >= 2) {
    insights.push({
      type: 'cluster',
      title: 'Ideas Clustered',
      description: `Your thinking organized into ${regions.length} distinct regions on the canvas`,
      metric: regions.length,
      icon: '🗺️',
    });
  }

  // Find the busiest region
  const busiestRegion = regions.sort((a, b) => b.eventCount - a.eventCount)[0];
  if (busiestRegion && busiestRegion.eventCount > 5) {
    insights.push({
      type: 'cluster',
      title: 'Activity Hotspot',
      description: `One area had ${busiestRegion.eventCount} interactions involving ${busiestRegion.noteIds.length} notes`,
      noteIds: busiestRegion.noteIds,
      metric: busiestRegion.eventCount,
      icon: '🔥',
    });
  }

  return insights;
}

/**
 * Detect potential breakthrough moments
 */
function detectBreakthroughs(session: ThinkingSession): SessionInsight[] {
  const insights: SessionInsight[] = [];
  const events = session.events;

  if (events.length < 10) return insights;

  // Look for patterns: long pause (> 2 min) followed by burst of activity (> 5 events in 30 sec)
  for (let i = 1; i < events.length - 5; i++) {
    const gap = events[i].timestamp - events[i - 1].timestamp;

    if (gap > 120000) { // 2+ minute pause
      // Check for burst after
      const burstEnd = events[i].timestamp + 30000;
      const burstEvents = events.filter(e =>
        e.timestamp >= events[i].timestamp && e.timestamp <= burstEnd
      );

      if (burstEvents.length >= 5) {
        insights.push({
          type: 'breakthrough',
          title: 'Aha Moment',
          description: `After ${Math.round(gap / 60000)} minutes of thinking, you had a burst of ${burstEvents.length} actions`,
          timestamp: events[i].timestamp,
          metric: burstEvents.length,
          icon: '💡',
        });
        break; // Only report first breakthrough
      }
    }
  }

  return insights;
}

/**
 * Analyze AI usage patterns
 */
function analyzeAIUsage(session: ThinkingSession): SessionInsight[] {
  const insights: SessionInsight[] = [];
  const events = session.events;

  const aiQueries = events.filter(e => e.type === 'ai-query');
  const aiResponses = events.filter(e => e.type === 'ai-response');

  if (aiQueries.length === 0) return insights;

  // AI assistance ratio
  const totalActions = events.filter(e =>
    ['note-create', 'note-edit', 'note-connect'].includes(e.type)
  ).length;

  if (totalActions > 0) {
    const aiRatio = aiQueries.length / totalActions;
    if (aiRatio > 0.3) {
      insights.push({
        type: 'ai-usage',
        title: 'AI-Assisted Thinking',
        description: `You asked AI ${aiQueries.length} questions during ${totalActions} actions - a collaborative approach`,
        metric: aiQueries.length,
        icon: '🤖',
      });
    }
  }

  // AI query timing
  const queryTimes = aiQueries.map(e => e.timestamp);
  const avgGap = queryTimes.length > 1
    ? queryTimes.reduce((sum, t, i) => i > 0 ? sum + (t - queryTimes[i - 1]) : sum, 0) / (queryTimes.length - 1)
    : 0;

  if (avgGap > 300000 && aiQueries.length > 2) { // Average gap > 5 minutes
    insights.push({
      type: 'ai-usage',
      title: 'Strategic AI Use',
      description: `You consulted AI at key moments, averaging ${Math.round(avgGap / 60000)} minutes between queries`,
      metric: avgGap,
      icon: '🎯',
    });
  }

  return insights;
}

/**
 * Detect regions of activity using simple grid-based clustering
 */
function detectRegions(
  positions: Array<{ x: number; y: number; noteId: string }>
): ActivityRegion[] {
  if (positions.length === 0) return [];

  // Find bounds
  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // If everything is close together, it's one region
  const width = maxX - minX;
  const height = maxY - minY;

  if (width < 500 && height < 500) {
    return [{
      x: minX,
      y: minY,
      width,
      height,
      eventCount: positions.length,
      totalTime: 0,
      noteIds: [...new Set(positions.map(p => p.noteId))],
    }];
  }

  // Divide into grid cells
  const cellSize = Math.max(width, height) / 3;
  const cells = new Map<string, ActivityRegion>();

  for (const pos of positions) {
    const cellX = Math.floor((pos.x - minX) / cellSize);
    const cellY = Math.floor((pos.y - minY) / cellSize);
    const key = `${cellX},${cellY}`;

    if (!cells.has(key)) {
      cells.set(key, {
        x: minX + cellX * cellSize,
        y: minY + cellY * cellSize,
        width: cellSize,
        height: cellSize,
        eventCount: 0,
        totalTime: 0,
        noteIds: [],
      });
    }

    const cell = cells.get(key)!;
    cell.eventCount++;
    if (!cell.noteIds.includes(pos.noteId)) {
      cell.noteIds.push(pos.noteId);
    }
  }

  // Filter to regions with meaningful activity
  return Array.from(cells.values()).filter(r => r.eventCount >= 2);
}

/**
 * Generate activity heatmap for visualization
 */
export function generateHeatmap(
  session: ThinkingSession,
  gridSize: number = 20
): HeatmapCell[] {
  const events = session.events;
  const positions: Array<{ x: number; y: number }> = [];

  // Collect all positions
  for (const event of events) {
    if (event.type === 'note-move') {
      const payload = event.payload as NoteMovePayload;
      positions.push({ x: payload.toX, y: payload.toY });
    } else if (event.type === 'note-create') {
      const payload = event.payload as { x: number; y: number };
      positions.push({ x: payload.x, y: payload.y });
    } else if (event.type === 'viewport-change') {
      const payload = event.payload as ViewportChangePayload;
      positions.push({ x: payload.x, y: payload.y });
    }
  }

  if (positions.length === 0) return [];

  // Find bounds
  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const cellWidth = width / gridSize;
  const cellHeight = height / gridSize;

  // Count activity in each cell
  const grid: number[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));

  for (const pos of positions) {
    const cellX = Math.min(Math.floor((pos.x - minX) / cellWidth), gridSize - 1);
    const cellY = Math.min(Math.floor((pos.y - minY) / cellHeight), gridSize - 1);
    grid[cellY][cellX]++;
  }

  // Find max for normalization
  const maxCount = Math.max(...grid.flat());

  // Convert to heatmap cells
  const cells: HeatmapCell[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x] > 0) {
        cells.push({
          x: minX + x * cellWidth + cellWidth / 2,
          y: minY + y * cellHeight + cellHeight / 2,
          intensity: grid[y][x] / maxCount,
        });
      }
    }
  }

  return cells;
}

/**
 * Generate AI summary of thinking process
 */
export async function generateSessionSummary(session: ThinkingSession): Promise<string> {
  if (!isAIAvailable()) {
    return generateFallbackSummary(session);
  }

  try {
    const { generateChatCompletion } = await import('./ai');

    const eventSummary = summarizeEvents(session.events);
    const insights = analyzeSession(session);

    const prompt = `Analyze this thinking session and provide a brief (2-3 sentence) summary of what the user was trying to figure out and how their thinking evolved.

Session Duration: ${Math.round(session.durationMs / 60000)} minutes
Notes Created: ${session.events.filter(e => e.type === 'note-create').length}
Notes Edited: ${session.events.filter(e => e.type === 'note-edit').length}
Connections Made: ${session.events.filter(e => e.type === 'note-connect').length}
AI Queries: ${session.events.filter(e => e.type === 'ai-query').length}

Key Patterns:
${insights.slice(0, 3).map(i => `- ${i.title}: ${i.description}`).join('\n')}

Event Flow:
${eventSummary}

Annotations:
${session.annotations.map(a => `[${Math.round(a.timestamp / 60000)}m] ${a.content}`).join('\n') || 'None'}

Provide a natural language summary of what the user was working on and any notable patterns in their thinking process.`;

    const response = await generateChatCompletion([
      { role: 'system', content: 'You are analyzing a thinking session recording. Be concise and insightful.' },
      { role: 'user', content: prompt },
    ]);

    return response || generateFallbackSummary(session);
  } catch (error) {
    console.error('Failed to generate AI summary:', error);
    return generateFallbackSummary(session);
  }
}

/**
 * Summarize events into readable format
 */
function summarizeEvents(events: ThinkingEvent[]): string {
  const summary: string[] = [];
  const phases: Array<{ start: number; events: ThinkingEvent[] }> = [];

  // Group events into phases (separated by 2+ minute gaps)
  let currentPhase = { start: 0, events: [] as ThinkingEvent[] };

  for (const event of events) {
    if (currentPhase.events.length > 0) {
      const lastTime = currentPhase.events[currentPhase.events.length - 1].timestamp;
      if (event.timestamp - lastTime > 120000) {
        phases.push(currentPhase);
        currentPhase = { start: event.timestamp, events: [] };
      }
    }
    currentPhase.events.push(event);
  }

  if (currentPhase.events.length > 0) {
    phases.push(currentPhase);
  }

  // Summarize each phase
  for (const phase of phases.slice(0, 5)) {
    const types = phase.events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominant = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    summary.push(`${Math.round(phase.start / 60000)}m: ${dominant[0].replace('-', ' ')} (${phase.events.length} events)`);
  }

  return summary.join('\n');
}

/**
 * Generate fallback summary without AI
 */
function generateFallbackSummary(session: ThinkingSession): string {
  const creates = session.events.filter(e => e.type === 'note-create').length;
  const edits = session.events.filter(e => e.type === 'note-edit').length;
  const connects = session.events.filter(e => e.type === 'note-connect').length;
  const duration = Math.round(session.durationMs / 60000);

  let summary = `This ${duration}-minute session involved `;

  const activities: string[] = [];
  if (creates > 0) activities.push(`creating ${creates} note${creates > 1 ? 's' : ''}`);
  if (edits > 0) activities.push(`editing ${edits} time${edits > 1 ? 's' : ''}`);
  if (connects > 0) activities.push(`making ${connects} connection${connects > 1 ? 's' : ''}`);

  if (activities.length === 0) {
    return `This ${duration}-minute session focused on exploration and navigation.`;
  }

  return summary + activities.join(', ') + '.';
}

/**
 * Generate exploration suggestions based on session analysis
 */
export function generateSuggestions(session: ThinkingSession): string[] {
  const suggestions: string[] = [];
  const insights = analyzeSession(session);

  // Based on revisitation patterns
  const revisitInsight = insights.find(i => i.type === 'revisitation' && i.noteIds?.length);
  if (revisitInsight) {
    suggestions.push(`You kept returning to certain notes - consider creating a summary note to consolidate those ideas.`);
  }

  // Based on clusters
  const clusterInsight = insights.find(i => i.type === 'cluster' && (i.metric || 0) >= 3);
  if (clusterInsight) {
    suggestions.push(`Your ideas formed ${clusterInsight.metric} clusters - try connecting notes across clusters to find new relationships.`);
  }

  // Based on AI usage
  const aiInsight = insights.find(i => i.type === 'ai-usage');
  if (!aiInsight && session.events.length > 20) {
    suggestions.push(`Consider using AI assistance to explore connections between your ideas.`);
  }

  // Based on time spent
  const timeInsight = insights.find(i => i.type === 'time-spent' && i.title === 'Deep Focus Period');
  if (timeInsight) {
    suggestions.push(`Your deep focus period might contain key insights - review those notes when fresh.`);
  }

  // Generic suggestions if we don't have specific ones
  if (suggestions.length === 0) {
    if (session.annotations.length < 3) {
      suggestions.push(`Try adding more annotations to capture your thoughts in the moment.`);
    }
    suggestions.push(`Consider revisiting this session tomorrow with fresh eyes.`);
  }

  return suggestions.slice(0, 3);
}

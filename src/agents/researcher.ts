/**
 * Researcher Agent
 *
 * Monitors topics and creates briefings about areas of interest.
 * Capabilities:
 * - createBriefing: Generate briefings about your notes
 * - findGaps: Identify knowledge gaps
 * - monitorTopic: Track external sources (future)
 */

import type { Note } from '../types/note';
import type { AgentTask, AgentTaskResult } from '../types/agent';
import { registerTaskHandler, createSuggestion } from '../services/agentFramework';
import { askNotes } from '../services/ai';
import { searchNotes } from '../services/semanticSearch';

/**
 * Extract key concepts from text using simple keyword extraction
 */
function extractConcepts(text: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in', 'for', 'on',
    'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'also', 'now', 'this', 'that', 'these', 'those', 'it', 'its',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
    'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'about', 'if', 'because',
  ]);

  // Extract words, filter stop words, and count occurrences
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  const wordCounts = new Map<string, number>();
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }

  // Return top concepts by frequency
  return Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

/**
 * Initialize the Researcher agent by registering its task handlers
 */
export function initializeResearcherAgent(): void {
  registerTaskHandler('researcher', 'createBriefing', createBriefing);
  registerTaskHandler('researcher', 'findGaps', findGaps);
  registerTaskHandler('researcher', 'monitorTopic', monitorTopic);
}

/**
 * Generate a briefing about recent notes or a specific topic
 */
async function createBriefing(task: AgentTask): Promise<AgentTaskResult> {
  const notes = task.input.notes as Note[];
  const topic = task.input.topic as string | undefined;
  const period = (task.input.period as 'daily' | 'weekly') || 'daily';
  const log: string[] = [];

  log.push(`Creating ${period} briefing${topic ? ` about "${topic}"` : ''}...`);

  // Filter notes by time period
  const cutoffDate = new Date();
  if (period === 'daily') {
    cutoffDate.setDate(cutoffDate.getDate() - 1);
  } else {
    cutoffDate.setDate(cutoffDate.getDate() - 7);
  }

  let relevantNotes = notes.filter(
    (n) => new Date(n.updatedAt).getTime() > cutoffDate.getTime()
  );

  // If topic specified, filter by semantic search
  if (topic && relevantNotes.length > 0) {
    try {
      const searchResults = await searchNotes(topic, 10, notes);
      const searchIds = new Set(searchResults.map((r) => r.note.id));
      relevantNotes = relevantNotes.filter((n) => searchIds.has(n.id));
    } catch (error) {
      log.push(`Error filtering by topic: ${error}`);
    }
  }

  log.push(`Found ${relevantNotes.length} relevant notes`);

  if (relevantNotes.length === 0) {
    return {
      summary: 'No relevant notes found for briefing',
      log,
    };
  }

  // Extract key concepts from recent notes
  const allConcepts: Map<string, number> = new Map();
  for (const note of relevantNotes) {
    const concepts = extractConcepts(note.content);
    for (const concept of concepts) {
      allConcepts.set(concept, (allConcepts.get(concept) || 0) + 1);
    }
  }

  const topConcepts = Array.from(allConcepts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([concept]) => concept);

  log.push(`Top concepts: ${topConcepts.join(', ')}`);

  // Use AI to synthesize briefing
  let briefingContent: string;
  try {
    const question = topic
      ? `Summarize my recent notes about "${topic}". What are the key insights and what should I focus on next?`
      : `Summarize my recent notes from the past ${period === 'daily' ? 'day' : 'week'}. What are the key themes and what should I focus on next?`;

    const response = await askNotes(question, relevantNotes);
    briefingContent = response.answer;
    log.push('Generated AI briefing');
  } catch (error) {
    log.push(`Error generating AI briefing: ${error}`);
    // Fallback to simple summary
    briefingContent = generateFallbackBriefing(relevantNotes, topConcepts, period);
  }

  // Create suggestion to save as note
  const briefingTitle = topic
    ? `Briefing: ${topic} (${new Date().toLocaleDateString()})`
    : `${period === 'daily' ? 'Daily' : 'Weekly'} Briefing (${new Date().toLocaleDateString()})`;

  const suggestion = createSuggestion(
    'researcher',
    'briefing',
    briefingTitle,
    briefingContent.slice(0, 200) + '...',
    {
      title: briefingTitle,
      content: briefingContent,
      tags: ['briefing', 'agent-generated', ...(topic ? [topic.toLowerCase()] : [])],
      topConcepts,
      noteCount: relevantNotes.length,
    },
    2
  );

  return {
    suggestions: [suggestion],
    summary: `Created ${period} briefing covering ${relevantNotes.length} notes`,
    log,
  };
}

/**
 * Generate a simple briefing without AI
 */
function generateFallbackBriefing(
  notes: Note[],
  concepts: string[],
  period: 'daily' | 'weekly'
): string {
  const lines: string[] = [];

  lines.push(
    `# ${period === 'daily' ? 'Daily' : 'Weekly'} Briefing\n`
  );
  lines.push(`*Generated on ${new Date().toLocaleDateString()}*\n`);

  lines.push(`## Overview\n`);
  lines.push(`You worked on **${notes.length} notes** in the past ${period === 'daily' ? 'day' : 'week'}.\n`);

  if (concepts.length > 0) {
    lines.push(`## Key Concepts\n`);
    lines.push(`Your notes covered these main topics:\n`);
    for (const concept of concepts.slice(0, 5)) {
      lines.push(`- ${concept}`);
    }
    lines.push('');
  }

  lines.push(`## Recent Notes\n`);
  for (const note of notes.slice(0, 5)) {
    lines.push(`- **${note.title}** (${note.tags?.join(', ') || 'no tags'})`);
    if (note.content.length > 0) {
      lines.push(`  ${note.content.slice(0, 100).replace(/\n/g, ' ')}...`);
    }
  }

  return lines.join('\n');
}

/**
 * Identify knowledge gaps
 */
async function findGaps(task: AgentTask): Promise<AgentTaskResult> {
  const notes = task.input.notes as Note[];
  const log: string[] = [];

  log.push(`Analyzing ${notes.length} notes for knowledge gaps...`);

  // Extract all concepts and questions
  const conceptCounts: Map<string, number> = new Map();
  const questions: Array<{ note: Note; question: string }> = [];

  // Patterns for identifying questions and TODOs
  const questionPatterns = [
    /\?\s*$/gm, // Ends with ?
    /^(?:what|how|why|when|where|who|which)\s+/gim, // Question words
    /^TODO:?\s+(.+)/gim, // TODOs
    /^QUESTION:?\s+(.+)/gim, // Explicit questions
    /need to (?:find out|research|learn|understand)\s+(.+)/gi, // Research needs
    /\[\s*\?\s*\]/g, // [?] markers
  ];

  for (const note of notes) {
    // Count concepts
    const concepts = extractConcepts(note.content);
    for (const concept of concepts) {
      conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
    }

    // Find questions
    for (const pattern of questionPatterns) {
      let match;
      while ((match = pattern.exec(note.content)) !== null) {
        // Get the full line containing the match
        const lineStart = note.content.lastIndexOf('\n', match.index) + 1;
        const lineEnd = note.content.indexOf('\n', match.index);
        const line = note.content.slice(
          lineStart,
          lineEnd === -1 ? undefined : lineEnd
        ).trim();

        if (line.length > 5 && line.length < 200) {
          questions.push({ note, question: line });
        }
      }
    }
  }

  log.push(`Found ${questions.length} questions/TODOs across notes`);

  // Identify concepts that are mentioned but never explained
  const conceptsWithLowDepth: string[] = [];
  for (const [concept, count] of conceptCounts) {
    if (count === 1) {
      // Mentioned only once - might be a gap
      const note = notes.find((n) =>
        n.content.toLowerCase().includes(concept.toLowerCase())
      );
      if (note && note.content.length < 300) {
        // Short note mentioning concept once - likely needs more depth
        conceptsWithLowDepth.push(concept);
      }
    }
  }

  log.push(
    `Found ${conceptsWithLowDepth.length} concepts that might need more depth`
  );

  // Create suggestions for top gaps
  const suggestions = [];

  // Suggest researching unanswered questions
  for (const { note, question } of questions.slice(0, 5)) {
    const suggestion = createSuggestion(
      'researcher',
      'knowledge_gap',
      `Unanswered question in "${note.title}"`,
      question,
      {
        noteId: note.id,
        noteTitle: note.title,
        question,
        type: 'unanswered_question',
      },
      3
    );
    suggestions.push(suggestion);
  }

  // Suggest expanding on shallow concepts
  for (const concept of conceptsWithLowDepth.slice(0, 5)) {
    const suggestion = createSuggestion(
      'researcher',
      'knowledge_gap',
      `Expand on "${concept}"`,
      `The concept "${concept}" is only mentioned briefly. Consider creating a dedicated note or adding more detail.`,
      {
        concept,
        type: 'shallow_concept',
      },
      4
    );
    suggestions.push(suggestion);
  }

  return {
    suggestions,
    summary: `Found ${questions.length} questions and ${conceptsWithLowDepth.length} concepts that need more depth`,
    log,
  };
}

/**
 * Monitor external sources for topics (placeholder for future implementation)
 */
async function monitorTopic(task: AgentTask): Promise<AgentTaskResult> {
  const topic = task.input.topic as string;
  const log: string[] = [];

  log.push(`Topic monitoring for "${topic}" is not yet implemented`);
  log.push('This feature requires web search capabilities');

  return {
    summary: 'Topic monitoring is not yet available',
    log,
  };
}

/**
 * Writer Agent
 *
 * Helps with note composition, refinement, and formatting.
 * Capabilities:
 * - expandNote: Expand brief notes into detailed content
 * - formatNote: Clean up and format note content
 * - suggestOutline: Generate an outline from bullet points
 * - summarize: Create summaries of long notes
 */

import type { Note } from '../types/note';
import type { AgentTask, AgentTaskResult } from '../types/agent';
import { registerTaskHandler, createSuggestion } from '../services/agentFramework';
import { askNotes } from '../services/ai';

/**
 * Initialize the Writer agent by registering its task handlers
 */
export function initializeWriterAgent(): void {
  registerTaskHandler('writer', 'expandNote', expandNote);
  registerTaskHandler('writer', 'formatNote', formatNote);
  registerTaskHandler('writer', 'suggestOutline', suggestOutline);
  registerTaskHandler('writer', 'summarize', summarize);
}

/**
 * Expand a brief note into detailed content
 */
async function expandNote(task: AgentTask): Promise<AgentTaskResult> {
  const note = task.input.note as Note;
  const style = (task.input.style as 'detailed' | 'conversational' | 'technical') || 'detailed';
  const log: string[] = [];

  log.push(`Expanding note "${note.title}" in ${style} style...`);

  if (note.content.length < 10) {
    return {
      summary: 'Note content is too short to expand',
      log,
    };
  }

  // Use AI to expand the content
  try {
    const styleInstructions = {
      detailed: 'Expand with thorough explanations, examples, and supporting details.',
      conversational: 'Expand in a friendly, approachable tone with relatable examples.',
      technical: 'Expand with precise terminology, code examples where relevant, and technical depth.',
    };

    const prompt = `Expand the following note into a more comprehensive version. ${styleInstructions[style]}

Original note title: "${note.title}"
Original content:
${note.content}

Provide an expanded version that:
1. Maintains the original meaning and intent
2. Adds relevant details and examples
3. Improves clarity and structure
4. Uses markdown formatting appropriately`;

    const response = await askNotes(prompt, [note]);
    const expandedContent = response.answer;

    log.push('Generated expanded content');

    const suggestion = createSuggestion(
      'writer',
      'create_note',
      `Expanded: ${note.title}`,
      expandedContent.slice(0, 200) + '...',
      {
        originalNoteId: note.id,
        content: expandedContent,
        style,
        action: 'replace', // or 'new_note'
      },
      2
    );

    return {
      suggestions: [suggestion],
      summary: `Expanded note from ${note.content.length} to ${expandedContent.length} characters`,
      log,
    };
  } catch (error) {
    log.push(`Error expanding note: ${error}`);
    return {
      summary: 'Failed to expand note',
      log,
    };
  }
}

/**
 * Clean up and format note content
 */
async function formatNote(task: AgentTask): Promise<AgentTaskResult> {
  const note = task.input.note as Note;
  const log: string[] = [];

  log.push(`Formatting note "${note.title}"...`);

  // Apply formatting rules
  let formatted = note.content;

  // Normalize line endings
  formatted = formatted.replace(/\r\n/g, '\n');

  // Fix multiple consecutive blank lines
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // Ensure headers have space after #
  formatted = formatted.replace(/^(#{1,6})([^#\s])/gm, '$1 $2');

  // Ensure list items have space after marker
  formatted = formatted.replace(/^([-*+])([^\s])/gm, '$1 $2');
  formatted = formatted.replace(/^(\d+\.)([^\s])/gm, '$1 $2');

  // Fix inconsistent checkbox formatting
  formatted = formatted.replace(/\[ \]/g, '[ ]');
  formatted = formatted.replace(/\[x\]/gi, '[x]');

  // Ensure code blocks have language hints if missing
  formatted = formatted.replace(/```\n([^`]+)```/g, (match, code) => {
    // Try to detect language
    if (code.includes('function') || code.includes('const') || code.includes('=>')) {
      return '```javascript\n' + code + '```';
    }
    if (code.includes('def ') || code.includes('import ') || code.includes('class ')) {
      return '```python\n' + code + '```';
    }
    return match;
  });

  // Trim trailing whitespace from lines
  formatted = formatted.split('\n').map(line => line.trimEnd()).join('\n');

  // Ensure file ends with single newline
  formatted = formatted.trimEnd() + '\n';

  const changes = [];
  if (formatted !== note.content) {
    if (note.content.match(/\n{3,}/)) changes.push('normalized blank lines');
    if (note.content.match(/^#{1,6}[^#\s]/m)) changes.push('fixed header spacing');
    if (note.content.match(/^[-*+][^\s]/m)) changes.push('fixed list spacing');
  }

  log.push(`Applied formatting: ${changes.length > 0 ? changes.join(', ') : 'no changes needed'}`);

  if (formatted === note.content) {
    return {
      summary: 'Note is already well-formatted',
      log,
    };
  }

  const suggestion = createSuggestion(
    'writer',
    'create_note',
    `Format: ${note.title}`,
    `Applied: ${changes.join(', ')}`,
    {
      noteId: note.id,
      content: formatted,
      changes,
    },
    5
  );

  return {
    suggestions: [suggestion],
    summary: `Formatted note: ${changes.join(', ')}`,
    log,
  };
}

/**
 * Generate an outline from bullet points or rough notes
 */
async function suggestOutline(task: AgentTask): Promise<AgentTaskResult> {
  const note = task.input.note as Note;
  const depth = (task.input.depth as number) || 2;
  const log: string[] = [];

  log.push(`Generating outline for "${note.title}" with depth ${depth}...`);

  if (note.content.length < 20) {
    return {
      summary: 'Note content is too short to generate an outline',
      log,
    };
  }

  try {
    const prompt = `Create a well-structured outline from the following rough notes. Use ${depth} levels of hierarchy (e.g., ## for main sections, ### for subsections).

Title: "${note.title}"
Content:
${note.content}

Generate a markdown outline that:
1. Organizes the ideas logically
2. Uses ## for main topics and ### for subtopics
3. Includes brief descriptions under each section
4. Maintains all the original information`;

    const response = await askNotes(prompt, [note]);
    const outline = response.answer;

    log.push('Generated structured outline');

    const suggestion = createSuggestion(
      'writer',
      'create_note',
      `Outline: ${note.title}`,
      outline.slice(0, 200) + '...',
      {
        originalNoteId: note.id,
        content: outline,
        type: 'outline',
      },
      3
    );

    return {
      suggestions: [suggestion],
      summary: 'Generated structured outline from rough notes',
      log,
    };
  } catch (error) {
    log.push(`Error generating outline: ${error}`);

    // Fallback: simple outline extraction
    const lines = note.content.split('\n').filter(l => l.trim());
    const outline = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        return '### ' + trimmed.slice(1).trim();
      }
      if (trimmed.match(/^\d+\./)) {
        return '### ' + trimmed.replace(/^\d+\./, '').trim();
      }
      return '## ' + trimmed;
    }).join('\n\n');

    log.push('Generated basic outline from list items');

    const suggestion = createSuggestion(
      'writer',
      'create_note',
      `Outline: ${note.title}`,
      'Basic outline generated from list items',
      {
        originalNoteId: note.id,
        content: outline,
        type: 'outline',
        fallback: true,
      },
      4
    );

    return {
      suggestions: [suggestion],
      summary: 'Generated basic outline (AI unavailable)',
      log,
    };
  }
}

/**
 * Create a summary of a long note
 */
async function summarize(task: AgentTask): Promise<AgentTaskResult> {
  const note = task.input.note as Note;
  const length = (task.input.length as 'brief' | 'standard' | 'detailed') || 'standard';
  const log: string[] = [];

  log.push(`Summarizing "${note.title}" (${length})...`);

  if (note.content.length < 100) {
    return {
      summary: 'Note is already concise, no summary needed',
      log,
    };
  }

  const wordCounts = {
    brief: '2-3 sentences',
    standard: '1 paragraph',
    detailed: '2-3 paragraphs with key points',
  };

  try {
    const prompt = `Summarize the following note in ${wordCounts[length]}.

Title: "${note.title}"
Content:
${note.content}

Create a summary that:
1. Captures the main ideas
2. Preserves important details
3. Uses clear, concise language`;

    const response = await askNotes(prompt, [note]);
    const summary = response.answer;

    log.push('Generated summary');

    const suggestion = createSuggestion(
      'writer',
      'create_note',
      `Summary: ${note.title}`,
      summary.slice(0, 200) + '...',
      {
        originalNoteId: note.id,
        content: `# Summary: ${note.title}\n\n${summary}\n\n---\n*Summarized from [[${note.title}]]*`,
        length,
        tags: ['summary', 'agent-generated'],
      },
      3
    );

    return {
      suggestions: [suggestion],
      summary: `Created ${length} summary (${summary.length} chars)`,
      log,
    };
  } catch (error) {
    log.push(`Error generating summary: ${error}`);

    // Fallback: extract first sentences
    const sentences = note.content
      .replace(/\n+/g, ' ')
      .match(/[^.!?]+[.!?]+/g) || [];

    const sentenceCount = length === 'brief' ? 2 : length === 'standard' ? 4 : 6;
    const fallbackSummary = sentences.slice(0, sentenceCount).join(' ').trim();

    if (fallbackSummary.length > 0) {
      log.push('Generated fallback summary from first sentences');

      const suggestion = createSuggestion(
        'writer',
        'create_note',
        `Summary: ${note.title}`,
        fallbackSummary,
        {
          originalNoteId: note.id,
          content: fallbackSummary,
          length,
          fallback: true,
        },
        4
      );

      return {
        suggestions: [suggestion],
        summary: 'Generated basic summary (AI unavailable)',
        log,
      };
    }

    return {
      summary: 'Failed to generate summary',
      log,
    };
  }
}

/**
 * Helper: Analyze writing style of a note
 */
export function analyzeWritingStyle(content: string): {
  tone: 'formal' | 'casual' | 'technical';
  structure: 'prose' | 'list' | 'mixed';
  complexity: 'simple' | 'moderate' | 'complex';
} {
  // Analyze tone
  const formalIndicators = ['therefore', 'however', 'furthermore', 'consequently', 'thus'];
  const casualIndicators = ['!', 'lol', 'btw', 'gonna', 'wanna', "don't", "can't"];
  const technicalIndicators = ['function', 'class', 'api', 'http', 'const', 'var', '```'];

  const lowerContent = content.toLowerCase();
  const formalCount = formalIndicators.filter(w => lowerContent.includes(w)).length;
  const casualCount = casualIndicators.filter(w => lowerContent.includes(w)).length;
  const technicalCount = technicalIndicators.filter(w => lowerContent.includes(w)).length;

  let tone: 'formal' | 'casual' | 'technical' = 'formal';
  if (technicalCount > 2) tone = 'technical';
  else if (casualCount > formalCount) tone = 'casual';

  // Analyze structure
  const lines = content.split('\n');
  const listLines = lines.filter(l => l.match(/^[-*+\d.]/)).length;
  const proseLines = lines.filter(l => l.length > 50 && !l.match(/^[-*+#\d.]/)).length;

  let structure: 'prose' | 'list' | 'mixed' = 'mixed';
  if (listLines > proseLines * 2) structure = 'list';
  else if (proseLines > listLines * 2) structure = 'prose';

  // Analyze complexity
  const words = content.split(/\s+/);
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  const sentenceCount = (content.match(/[.!?]+/g) || []).length;
  const avgSentenceLength = words.length / Math.max(1, sentenceCount);

  let complexity: 'simple' | 'moderate' | 'complex' = 'moderate';
  if (avgWordLength < 5 && avgSentenceLength < 15) complexity = 'simple';
  else if (avgWordLength > 6 || avgSentenceLength > 25) complexity = 'complex';

  return { tone, structure, complexity };
}

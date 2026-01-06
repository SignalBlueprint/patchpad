import type { PatchRequest, PatchResponse, PatchOp, Suggestion, AnalysisResult } from '../types/patch';
import type { Note } from '../types/note';
import { v4 as uuidv4 } from 'uuid';
import { isAIAvailable, generatePatchWithAI, analyzeWithAI, stitchWithAI } from '../services/ai';

export interface StitchRequest {
  notes: Note[];
}

export interface StitchResponse {
  rationale: string;
  content: string;
}

/**
 * Generate a patch using AI if available, otherwise use mock.
 */
export async function generatePatch(request: PatchRequest): Promise<PatchResponse> {
  const { content, action, selection, customPrompt, targetLanguage } = request;

  // Try AI first if available
  if (isAIAvailable()) {
    try {
      const aiResult = await generatePatchWithAI({
        content,
        action,
        selection,
        customPrompt,
        targetLanguage,
      });
      if (aiResult) {
        // Convert AI result to patch ops (full replace)
        return {
          rationale: aiResult.rationale,
          ops: [{
            type: 'replace',
            start: 0,
            end: content.length,
            text: aiResult.newContent,
          }],
        };
      }
    } catch (error) {
      console.warn('AI patch generation failed, falling back to mock:', error);
    }
  }

  // Fall back to mock implementation for basic actions
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 200));

  switch (action) {
    case 'summarize':
      return generateSummaryPatch(content);
    case 'extract-tasks':
      return generateTasksPatch(content);
    case 'rewrite':
      return generateRewritePatch(content);
    case 'title-tags':
      return generateTitleTagsPatch(content);
    case 'fix-grammar':
      return generateRewritePatch(content); // Basic fallback
    case 'continue':
    case 'expand':
    case 'simplify':
    case 'translate':
    case 'ask-ai':
    case 'explain':
    case 'outline':
      // These require AI - return empty if not available
      return {
        rationale: 'AI is required for this action. Please configure an API key.',
        ops: [],
      };
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function generateSummaryPatch(content: string): PatchResponse {
  const lines = content.split('\n').filter((l) => l.trim());
  const summary =
    lines.length > 3
      ? `\n\n---\n**Summary:** This note contains ${lines.length} lines covering the main topics discussed above.`
      : '\n\n---\n**Summary:** Brief note.';

  const ops: PatchOp[] = [
    {
      type: 'insert',
      start: content.length,
      text: summary,
    },
  ];

  return {
    rationale: `Adding a summary section at the end of the note (${lines.length} lines analyzed).`,
    ops,
  };
}

function generateTasksPatch(content: string): PatchResponse {
  const taskPatterns = content.match(/(?:todo|task|need to|should|must|will)[\s:]+.+/gi) || [];

  let tasksSection = '\n\n## Tasks\n';
  if (taskPatterns.length > 0) {
    taskPatterns.forEach((task) => {
      tasksSection += `- [ ] ${task.replace(/^(todo|task|need to|should|must|will)[\s:]*/i, '').trim()}\n`;
    });
  } else {
    tasksSection += '- [ ] Review this note\n- [ ] Add action items\n';
  }

  const ops: PatchOp[] = [
    {
      type: 'insert',
      start: content.length,
      text: tasksSection,
    },
  ];

  return {
    rationale:
      taskPatterns.length > 0
        ? `Extracted ${taskPatterns.length} task(s) from the note content.`
        : 'No explicit tasks found. Added placeholder task section.',
    ops,
  };
}

function generateRewritePatch(content: string): PatchResponse {
  const lines = content.split('\n');
  const cleaned = lines
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned === content.trim()) {
    return {
      rationale: 'Content is already well-formatted. No changes needed.',
      ops: [],
    };
  }

  const ops: PatchOp[] = [
    {
      type: 'replace',
      start: 0,
      end: content.length,
      text: cleaned,
    },
  ];

  return {
    rationale: 'Cleaned up whitespace and normalized line breaks.',
    ops,
  };
}

function generateTitleTagsPatch(content: string): PatchResponse {
  const firstLine = content.split('\n')[0].trim();
  const hasTitle = firstLine.startsWith('#');

  const ops: PatchOp[] = [];
  let rationale = '';

  if (!hasTitle && firstLine) {
    ops.push({
      type: 'replace',
      start: 0,
      end: firstLine.length,
      text: `# ${firstLine}`,
    });
    rationale = 'Converted first line to heading. ';
  }

  const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const wordFreq = new Map<string, number>();
  words.forEach((w) => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));

  const topWords = [...wordFreq.entries()]
    .filter(([word]) => !['that', 'this', 'with', 'from', 'have', 'will', 'been', 'were', 'they', 'their'].includes(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  if (topWords.length > 0) {
    const tagsSection = `\n\n---\nTags: ${topWords.map((t) => `#${t}`).join(' ')}`;
    ops.push({
      type: 'insert',
      start: content.length,
      text: tagsSection,
    });
    rationale += `Added ${topWords.length} suggested tags based on content.`;
  }

  return {
    rationale: rationale || 'No changes needed.',
    ops,
  };
}

/**
 * Stitch multiple notes using AI if available, otherwise use mock.
 */
export async function generateStitch(request: StitchRequest): Promise<StitchResponse> {
  const { notes } = request;

  // Try AI first if available
  if (isAIAvailable()) {
    try {
      const aiResult = await stitchWithAI(notes);
      if (aiResult) {
        return aiResult;
      }
    } catch (error) {
      console.warn('AI stitch failed, falling back to mock:', error);
    }
  }

  // Fall back to mock implementation
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 300));

  let content = `# Compiled Document\n\n`;
  content += `> Compiled from ${notes.length} notes\n\n`;
  content += `---\n\n`;

  content += `## Table of Contents\n\n`;
  notes.forEach((note, index) => {
    content += `${index + 1}. [${note.title}](#section-${index + 1})\n`;
  });
  content += `\n---\n\n`;

  notes.forEach((note, index) => {
    content += `## Section ${index + 1}: ${note.title}\n\n`;
    content += note.content.trim() || '_Empty note_';
    content += `\n\n`;
    if (index < notes.length - 1) {
      content += `---\n\n`;
    }
  });

  const totalWords = notes.reduce((acc, note) => {
    return acc + (note.content.match(/\b\w+\b/g)?.length || 0);
  }, 0);

  content += `\n---\n\n`;
  content += `## Summary\n\n`;
  content += `This document combines ${notes.length} notes with approximately ${totalWords} words total.\n`;

  const rationale = `Created a compiled document with table of contents, ${notes.length} sections, and a summary. Total word count: ${totalWords}.`;

  return {
    rationale,
    content,
  };
}

/**
 * Simple hash function for content comparison
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Analyze content and generate smart suggestions.
 * Uses AI if available, otherwise uses rule-based analysis.
 */
export async function analyzeContent(content: string, previousHash?: string): Promise<AnalysisResult | null> {
  const contentHash = hashContent(content);

  if (previousHash && contentHash === previousHash) {
    return null;
  }

  if (content.trim().length < 10) {
    return {
      suggestions: [],
      analyzedAt: new Date(),
      contentHash,
    };
  }

  // Try AI analysis first if available
  if (isAIAvailable()) {
    try {
      const aiResult = await analyzeWithAI(content);
      if (aiResult) {
        return {
          ...aiResult,
          contentHash,
        };
      }
    } catch (error) {
      console.warn('AI analysis failed, falling back to rule-based:', error);
    }
  }

  // Fall back to rule-based analysis
  await new Promise((resolve) => setTimeout(resolve, 100));

  const suggestions: Suggestion[] = [];

  // Check if title formatting would help
  const firstLine = content.split('\n')[0].trim();
  if (firstLine && !firstLine.startsWith('#') && firstLine.length > 0 && firstLine.length < 100) {
    suggestions.push({
      id: uuidv4(),
      action: 'title-tags',
      rationale: 'Add markdown heading to first line',
      ops: [{
        type: 'replace',
        start: 0,
        end: firstLine.length,
        text: `# ${firstLine}`,
      }],
      priority: 'high',
    });
  }

  // Check for extractable tasks
  const taskPatterns = content.match(/(?:todo|task|need to|should|must|will)[\s:]+.+/gi) || [];
  if (taskPatterns.length > 0) {
    const tasksSection = '\n\n## Tasks\n' + taskPatterns
      .map((task) => `- [ ] ${task.replace(/^(todo|task|need to|should|must|will)[\s:]*/i, '').trim()}`)
      .join('\n') + '\n';

    suggestions.push({
      id: uuidv4(),
      action: 'extract-tasks',
      rationale: `Found ${taskPatterns.length} task${taskPatterns.length > 1 ? 's' : ''} to extract`,
      ops: [{
        type: 'insert',
        start: content.length,
        text: tasksSection,
      }],
      priority: 'high',
    });
  }

  // Check for whitespace cleanup opportunities
  const hasExtraWhitespace = /\n{3,}/.test(content) || /[ \t]+$/.test(content);
  if (hasExtraWhitespace) {
    const cleaned = content
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleaned !== content.trim()) {
      suggestions.push({
        id: uuidv4(),
        action: 'rewrite',
        rationale: 'Clean up extra whitespace',
        ops: [{
          type: 'replace',
          start: 0,
          end: content.length,
          text: cleaned,
        }],
        priority: 'low',
      });
    }
  }

  // Suggest summary for longer content
  const lines = content.split('\n').filter((l) => l.trim());
  const wordCount = content.match(/\b\w+\b/g)?.length || 0;
  if (lines.length > 5 && wordCount > 50) {
    suggestions.push({
      id: uuidv4(),
      action: 'summarize',
      rationale: `Add summary for ${wordCount} word note`,
      ops: [{
        type: 'insert',
        start: content.length,
        text: `\n\n---\n**Summary:** This note contains ${lines.length} lines and ${wordCount} words.`,
      }],
      priority: 'medium',
    });
  }

  return {
    suggestions,
    analyzedAt: new Date(),
    contentHash,
  };
}

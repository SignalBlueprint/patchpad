/**
 * Voice Note Processor Service
 * Processes transcribed voice notes using AI to clean up, structure, and extract metadata
 */

import { isAIAvailable } from './ai';
import { getAPIKey, getAIProvider } from './ai';

export interface ProcessedNote {
  title: string;
  content: string;
  tags: string[];
  tasks: string[];
  isVoiceNote: boolean;
}

export interface ProcessingOptions {
  summarizeIfLong?: boolean;
  extractTasks?: boolean;
  generateTitle?: boolean;
  cleanupFillerWords?: boolean;
}

const DEFAULT_OPTIONS: ProcessingOptions = {
  summarizeIfLong: true,
  extractTasks: true,
  generateTitle: true,
  cleanupFillerWords: true,
};

// Filler words to remove for quick cleanup (non-AI fallback)
const FILLER_WORDS = [
  'um', 'uh', 'like', 'you know', 'basically', 'actually',
  'literally', 'I mean', 'sort of', 'kind of', 'right',
];

/**
 * Clean up filler words from transcription (non-AI fallback)
 */
function cleanupFillerWords(text: string): string {
  let cleaned = text;
  for (const filler of FILLER_WORDS) {
    // Match filler words with word boundaries, case insensitive
    const regex = new RegExp(`\\b${filler}\\b[,\\s]*`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  // Clean up multiple spaces
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Extract tasks from text using regex patterns
 */
function extractTasksFromText(text: string): string[] {
  const tasks: string[] = [];

  // Pattern 1: TODO/TASK/ACTION items
  const todoPattern = /(?:TODO|TASK|ACTION|FIXME):\s*(.+?)(?:\n|$)/gi;
  let match;
  while ((match = todoPattern.exec(text)) !== null) {
    tasks.push(match[1].trim());
  }

  // Pattern 2: "I need to...", "I should...", "I have to...", "Don't forget to..."
  const needToPattern = /(?:I\s+)?(?:need|should|have|must|gotta|want)\s+to\s+([^.!?\n]+)/gi;
  while ((match = needToPattern.exec(text)) !== null) {
    const task = match[1].trim();
    if (task.length > 5 && task.length < 100) {
      tasks.push(task);
    }
  }

  // Pattern 3: "Don't forget..." / "Remember to..."
  const rememberPattern = /(?:don't forget|remember)\s+(?:to\s+)?([^.!?\n]+)/gi;
  while ((match = rememberPattern.exec(text)) !== null) {
    const task = match[1].trim();
    if (task.length > 5 && task.length < 100) {
      tasks.push(task);
    }
  }

  // Deduplicate
  return [...new Set(tasks)];
}

/**
 * Generate a simple title from content (non-AI fallback)
 */
function generateSimpleTitle(content: string): string {
  // Take first sentence or first 50 chars
  const firstSentence = content.split(/[.!?]/)[0]?.trim() || '';
  if (firstSentence.length > 5 && firstSentence.length <= 60) {
    return firstSentence;
  }

  // Just take first few words
  const words = content.split(/\s+/).slice(0, 6).join(' ');
  return words.length > 50 ? words.substring(0, 47) + '...' : words;
}

/**
 * Process voice note with AI
 */
async function processWithAI(
  transcription: string,
  options: ProcessingOptions
): Promise<ProcessedNote | null> {
  const apiKey = getAPIKey();
  const provider = getAIProvider();

  if (!apiKey || !provider) {
    return null;
  }

  const prompt = `Process this voice transcription into a well-structured note. Return a JSON object with these fields:

1. "title": A concise, descriptive title (max 60 chars)
2. "content": The cleaned up and formatted content with:
   - Filler words removed (um, uh, like, you know, etc.)
   - Proper punctuation and capitalization
   - Logical paragraph breaks
   - Markdown formatting where appropriate
   ${options.summarizeIfLong ? '- If over 500 words, summarize key points while preserving important details' : ''}
3. "tags": Array of 2-5 relevant tags (lowercase, no #)
4. "tasks": Array of action items or todos extracted from the content

Transcription:
${transcription}

Respond ONLY with valid JSON, no markdown code blocks.`;

  try {
    const endpoint = provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.anthropic.com/v1/messages';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let body: string;

    if (provider === 'openai') {
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that processes voice transcriptions into structured notes. Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      });
    } else {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      body = JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2048,
        system: 'You are a helpful assistant that processes voice transcriptions into structured notes. Always respond with valid JSON only.',
        messages: [
          { role: 'user', content: prompt },
        ],
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      console.error('AI processing failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const content = provider === 'openai'
      ? data.choices?.[0]?.message?.content
      : data.content?.[0]?.text;

    if (!content) {
      return null;
    }

    // Parse JSON response
    const result = JSON.parse(content);

    return {
      title: result.title || generateSimpleTitle(transcription),
      content: result.content || cleanupFillerWords(transcription),
      tags: Array.isArray(result.tags) ? result.tags : [],
      tasks: Array.isArray(result.tasks) ? result.tasks : [],
      isVoiceNote: true,
    };
  } catch (error) {
    console.error('Voice note AI processing failed:', error);
    return null;
  }
}

/**
 * Process a voice note transcription into a structured note
 * Uses AI if available, falls back to simple processing otherwise
 */
export async function processVoiceNote(
  transcription: string,
  options: ProcessingOptions = {}
): Promise<ProcessedNote> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Try AI processing first
  if (isAIAvailable()) {
    const aiResult = await processWithAI(transcription, opts);
    if (aiResult) {
      return aiResult;
    }
  }

  // Fallback to simple processing
  let content = transcription;

  if (opts.cleanupFillerWords) {
    content = cleanupFillerWords(content);
  }

  const tasks = opts.extractTasks ? extractTasksFromText(content) : [];
  const title = opts.generateTitle
    ? generateSimpleTitle(content)
    : `Voice Note - ${new Date().toLocaleDateString()}`;

  return {
    title,
    content,
    tags: ['voice-note'],
    tasks,
    isVoiceNote: true,
  };
}

/**
 * Check if the transcription is long enough to benefit from summarization
 */
export function shouldSummarize(text: string): boolean {
  const wordCount = text.split(/\s+/).length;
  return wordCount > 500;
}

/**
 * Get word count of text
 */
export function getWordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

import { env, hasAIProvider } from '../config/env';
import type { PatchOp, Suggestion, AnalysisResult, PatchAction } from '../types/patch';
import type { Note } from '../types/note';
import { v4 as uuidv4 } from 'uuid';

// Types for AI requests/responses
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Abstract AI provider interface
interface AIProviderInterface {
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}

// OpenAI Provider
class OpenAIProvider implements AIProviderInterface {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}

// Anthropic Provider
class AnthropicProvider implements AIProviderInterface {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    // Extract system message
    const systemMessage = request.messages.find(m => m.role === 'system')?.content ?? '';
    const otherMessages = request.messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 1024,
        system: systemMessage,
        messages: otherMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return {
      content: data.content[0]?.text ?? '',
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
    };
  }
}

// Get the appropriate provider
function getProvider(): AIProviderInterface | null {
  if (env.aiProvider === 'openai' && env.openai.apiKey) {
    return new OpenAIProvider(env.openai.apiKey, env.openai.model);
  }
  if (env.aiProvider === 'anthropic' && env.anthropic.apiKey) {
    return new AnthropicProvider(env.anthropic.apiKey, env.anthropic.model);
  }
  return null;
}

// Prompts for different actions
const PROMPTS = {
  analyze: `You are an AI assistant helping users improve their notes. Analyze the following note and suggest improvements.

Return a JSON object with this structure:
{
  "suggestions": [
    {
      "action": "title-tags" | "extract-tasks" | "rewrite" | "summarize",
      "rationale": "Brief explanation of why this would help",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Only suggest improvements that would genuinely help. Don't suggest changes for well-formatted content.
Keep suggestions concise and actionable.`,

  summarize: `Summarize the following note in 1-2 sentences. Focus on the key points and main ideas.`,

  extractTasks: `Extract actionable tasks from the following note. Return as a markdown checklist with "- [ ]" format.
Only extract actual tasks mentioned, don't invent new ones.`,

  rewrite: `Improve the formatting and clarity of the following note while preserving its meaning.
- Fix grammar and spelling
- Improve structure
- Clean up whitespace
- Add markdown formatting where helpful

Return only the improved text, no explanations.`,

  titleTags: `For the following note:
1. Suggest a concise title (if the first line isn't already a good title)
2. Suggest 2-3 relevant tags based on the content

Return as JSON: { "title": "...", "tags": ["tag1", "tag2"] }`,

  stitch: `Combine the following notes into a single coherent document.
- Create a logical structure with sections
- Add a table of contents
- Write a brief summary at the end
- Preserve important details from each note

Notes to combine:`,

  continue: `Continue writing from where the text leaves off. Match the style and tone of the existing content.
Write 2-4 more sentences or a short paragraph that naturally extends the content.
Return only the continuation text, no explanations.`,

  expand: `Expand on the following text by adding more detail, examples, or explanation.
Maintain the same writing style and voice.
Return only the expanded text, no explanations.`,

  simplify: `Rewrite the following text to make it simpler and easier to understand.
- Use shorter sentences
- Replace complex words with simpler alternatives
- Break down complicated ideas
- Keep the core meaning intact
Return only the simplified text, no explanations.`,

  fixGrammar: `Fix any grammar, spelling, and punctuation errors in the following text.
Make minimal changes - only fix actual errors, don't rephrase unnecessarily.
Return only the corrected text, no explanations.`,

  translate: `Translate the following text to TARGET_LANGUAGE.
Maintain the original meaning and tone as closely as possible.
Return only the translated text, no explanations.`,

  askAi: `You are a helpful assistant. Answer the user's question based on their note content.
Be concise but thorough. If the note doesn't contain relevant information, say so.`,

  explain: `Explain the following text in simple terms.
- Break down complex concepts
- Use analogies if helpful
- Structure your explanation clearly
Keep your explanation concise but comprehensive.`,

  outline: `Convert this note into a well-structured outline format.
- Create clear hierarchical sections
- Use markdown headers (##, ###)
- Organize content logically
- Add bullet points for key points
- Group related ideas together
- Keep the original information, just reorganize it
Return only the restructured content in outline format.`,
};

// AI-powered analysis (with real AI)
export async function analyzeWithAI(content: string): Promise<AnalysisResult | null> {
  const provider = getProvider();
  if (!provider) return null;

  try {
    const response = await provider.complete({
      messages: [
        { role: 'system', content: PROMPTS.analyze },
        { role: 'user', content: content },
      ],
      maxTokens: 512,
      temperature: 0.3,
    });

    const parsed = JSON.parse(response.content);
    const suggestions: Suggestion[] = (parsed.suggestions || []).map((s: { action: string; rationale: string; priority: string }) => ({
      id: uuidv4(),
      action: s.action as Patch['action'],
      rationale: s.rationale,
      ops: [], // AI suggestions don't have ops - they trigger full regeneration
      priority: s.priority as Suggestion['priority'],
    }));

    return {
      suggestions,
      analyzedAt: new Date(),
      contentHash: hashContent(content),
    };
  } catch (error) {
    console.error('AI analysis failed:', error);
    return null;
  }
}

export interface PatchGenerationOptions {
  content: string;
  action: PatchAction;
  selection?: { from: number; to: number; text: string };
  customPrompt?: string;
  targetLanguage?: string;
}

// AI-powered patch generation
export async function generatePatchWithAI(
  options: PatchGenerationOptions
): Promise<{ rationale: string; newContent: string } | null> {
  const { content, action, selection, customPrompt, targetLanguage } = options;
  const provider = getProvider();
  if (!provider) return null;

  const promptMap: Record<PatchAction, string> = {
    'summarize': PROMPTS.summarize,
    'extract-tasks': PROMPTS.extractTasks,
    'rewrite': PROMPTS.rewrite,
    'title-tags': PROMPTS.titleTags,
    'continue': PROMPTS.continue,
    'expand': PROMPTS.expand,
    'simplify': PROMPTS.simplify,
    'fix-grammar': PROMPTS.fixGrammar,
    'translate': PROMPTS.translate.replace('TARGET_LANGUAGE', targetLanguage || 'Spanish'),
    'ask-ai': PROMPTS.askAi,
    'explain': PROMPTS.explain,
    'outline': PROMPTS.outline,
  };

  // Determine what content to send to AI
  const textToProcess = selection ? selection.text : content;
  const systemPrompt = action === 'ask-ai' && customPrompt
    ? `${PROMPTS.askAi}\n\nUser's question: ${customPrompt}`
    : promptMap[action];

  try {
    const response = await provider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: textToProcess },
      ],
      maxTokens: 2048,
      temperature: action === 'fix-grammar' ? 0.1 : 0.5,
    });

    let newContent = content;
    let rationale = '';
    const aiResponse = response.content.trim();

    // Handle selection-based actions differently
    if (selection) {
      switch (action) {
        case 'expand':
        case 'simplify':
        case 'fix-grammar':
        case 'translate':
          // Replace the selected text with the AI result
          newContent = content.slice(0, selection.from) + aiResponse + content.slice(selection.to);
          rationale = `Applied ${action.replace('-', ' ')} to selection`;
          break;

        case 'explain':
        case 'ask-ai':
          // Insert the explanation/answer after the selection
          newContent = content.slice(0, selection.to) + `\n\n> **AI Response:**\n> ${aiResponse.split('\n').join('\n> ')}` + content.slice(selection.to);
          rationale = action === 'explain' ? 'Added AI explanation' : 'Added AI response';
          break;

        default:
          // For other actions, replace selection
          newContent = content.slice(0, selection.from) + aiResponse + content.slice(selection.to);
          rationale = `Applied ${action} to selection`;
      }
    } else {
      // Handle full-note actions
      switch (action) {
        case 'summarize':
          newContent = content + `\n\n---\n**Summary:** ${aiResponse}`;
          rationale = 'Added AI-generated summary';
          break;

        case 'extract-tasks':
          newContent = content + `\n\n## Tasks\n${aiResponse}`;
          rationale = 'Extracted tasks using AI';
          break;

        case 'rewrite':
        case 'simplify':
        case 'fix-grammar':
          newContent = aiResponse;
          rationale = `Improved note with AI (${action.replace('-', ' ')})`;
          break;

        case 'title-tags': {
          try {
            const parsed = JSON.parse(aiResponse);
            const firstLine = content.split('\n')[0].trim();
            newContent = content;
            if (parsed.title && !firstLine.startsWith('#')) {
              newContent = `# ${parsed.title}\n\n${content}`;
            }
            if (parsed.tags?.length > 0) {
              newContent += `\n\n---\nTags: ${parsed.tags.map((t: string) => `#${t}`).join(' ')}`;
            }
            rationale = 'Added title and tags using AI';
          } catch {
            newContent = content;
            rationale = 'Could not parse AI response for title/tags';
          }
          break;
        }

        case 'continue':
          newContent = content + ' ' + aiResponse;
          rationale = 'AI continued writing';
          break;

        case 'expand':
          newContent = aiResponse;
          rationale = 'AI expanded the content';
          break;

        case 'translate':
          newContent = content + `\n\n---\n**Translation (${targetLanguage || 'Spanish'}):**\n${aiResponse}`;
          rationale = `Translated to ${targetLanguage || 'Spanish'}`;
          break;

        case 'ask-ai':
          newContent = content + `\n\n---\n**AI Response:**\n${aiResponse}`;
          rationale = 'Added AI response';
          break;

        case 'explain':
          newContent = content + `\n\n---\n**Explanation:**\n${aiResponse}`;
          rationale = 'Added AI explanation';
          break;

        case 'outline':
          newContent = aiResponse;
          rationale = 'Reorganized content into structured outline';
          break;
      }
    }

    return { rationale, newContent };
  } catch (error) {
    console.error('AI patch generation failed:', error);
    return null;
  }
}

// AI-powered stitch
export async function stitchWithAI(notes: Note[]): Promise<{ rationale: string; content: string } | null> {
  const provider = getProvider();
  if (!provider) return null;

  const notesText = notes
    .map((n, i) => `--- Note ${i + 1}: ${n.title} ---\n${n.content}`)
    .join('\n\n');

  try {
    const response = await provider.complete({
      messages: [
        { role: 'system', content: PROMPTS.stitch },
        { role: 'user', content: notesText },
      ],
      maxTokens: 4096,
      temperature: 0.5,
    });

    return {
      rationale: `AI compiled ${notes.length} notes into a structured document`,
      content: response.content.trim(),
    };
  } catch (error) {
    console.error('AI stitch failed:', error);
    return null;
  }
}

// Check if AI is available
export function isAIAvailable(): boolean {
  return hasAIProvider();
}

// Get current provider name
export function getProviderName(): string {
  if (env.aiProvider === 'openai' && env.openai.apiKey) return 'OpenAI';
  if (env.aiProvider === 'anthropic' && env.anthropic.apiKey) return 'Anthropic';
  return 'Mock';
}

// Simple hash function
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Additional prompts for new features
const EXTENDED_PROMPTS = {
  findRelated: `You are a semantic similarity analyzer. Given the current note and a list of other notes,
identify which notes are most semantically related to the current note.

Return a JSON array of note IDs ordered by relevance, with a brief reason why each is related:
[{ "noteId": "...", "reason": "Brief explanation of relationship", "score": 0.0-1.0 }]

Only include notes with meaningful connections. Maximum 5 results.`,

  askNotes: `You are a helpful assistant with access to the user's notes. Answer the question using information from the provided notes.
- Cite specific notes when quoting or referencing information
- If the answer isn't in the notes, say so
- Be concise but thorough
- Format your answer with markdown for readability`,

  suggestTags: `Analyze the note content and suggest relevant tags.
Return a JSON array of 3-5 single-word or hyphenated tags that describe the main topics.
Focus on: main subject, type of content (meeting, project, idea, etc.), and key themes.
Example: ["project-planning", "marketing", "q1-2024"]
Return only the JSON array, nothing else.`,

  generateOutline: `Convert this note into a well-structured outline format.
- Create clear hierarchical sections
- Use markdown headers (##, ###)
- Organize content logically
- Add bullet points for key points
- Group related ideas together
- Keep the original information, just reorganize it
Return only the restructured content in outline format.`,

  dailyDigest: `Create a brief daily digest summarizing the provided notes.
- Group notes by topic/theme if possible
- Highlight key points and action items
- Keep it concise (3-5 bullet points)
- Focus on what's most important
Format as markdown with clear sections.`,
};

export interface RelatedNote {
  noteId: string;
  reason: string;
  score: number;
}

// Find semantically related notes
export async function findRelatedNotes(
  currentNote: Note,
  otherNotes: Note[]
): Promise<RelatedNote[]> {
  const provider = getProvider();
  if (!provider) {
    // Fallback: simple keyword matching
    return findRelatedNotesFallback(currentNote, otherNotes);
  }

  if (otherNotes.length === 0) return [];

  const notesContext = otherNotes
    .map(n => `ID: ${n.id}\nTitle: ${n.title}\nContent: ${n.content.slice(0, 200)}...`)
    .join('\n\n---\n\n');

  try {
    const response = await provider.complete({
      messages: [
        { role: 'system', content: EXTENDED_PROMPTS.findRelated },
        { role: 'user', content: `Current note:\nTitle: ${currentNote.title}\nContent: ${currentNote.content}\n\n---\n\nOther notes:\n${notesContext}` },
      ],
      maxTokens: 512,
      temperature: 0.3,
    });

    const parsed = JSON.parse(response.content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Find related notes failed:', error);
    return findRelatedNotesFallback(currentNote, otherNotes);
  }
}

// Fallback: keyword-based similarity
function findRelatedNotesFallback(currentNote: Note, otherNotes: Note[]): RelatedNote[] {
  const currentWords = extractKeywords(currentNote.content + ' ' + currentNote.title);

  const scored = otherNotes
    .map(note => {
      const noteWords = extractKeywords(note.content + ' ' + note.title);
      const overlap = currentWords.filter(w => noteWords.includes(w));
      const score = overlap.length / Math.max(currentWords.length, 1);
      return {
        noteId: note.id,
        reason: overlap.length > 0 ? `Shares keywords: ${overlap.slice(0, 3).join(', ')}` : 'No common keywords',
        score,
      };
    })
    .filter(r => r.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored;
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their']);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

export interface AskNotesResult {
  answer: string;
  citedNotes: string[];
}

// Ask questions across all notes
export async function askNotes(
  question: string,
  notes: Note[]
): Promise<AskNotesResult> {
  const provider = getProvider();
  if (!provider) {
    return {
      answer: 'AI is required to search across notes. Please configure an API key.',
      citedNotes: [],
    };
  }

  if (notes.length === 0) {
    return {
      answer: 'No notes available to search.',
      citedNotes: [],
    };
  }

  const notesContext = notes
    .map(n => `[Note: ${n.title} (ID: ${n.id})]\n${n.content}`)
    .join('\n\n---\n\n');

  try {
    const response = await provider.complete({
      messages: [
        { role: 'system', content: EXTENDED_PROMPTS.askNotes },
        { role: 'user', content: `Notes:\n${notesContext}\n\n---\n\nQuestion: ${question}` },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    // Extract cited note IDs from the response
    const citedNotes = notes
      .filter(n => response.content.toLowerCase().includes(n.title.toLowerCase()))
      .map(n => n.id);

    return {
      answer: response.content.trim(),
      citedNotes,
    };
  } catch (error) {
    console.error('Ask notes failed:', error);
    return {
      answer: 'Failed to process your question. Please try again.',
      citedNotes: [],
    };
  }
}

// Suggest tags for a note
export async function suggestTags(content: string): Promise<string[]> {
  const provider = getProvider();
  if (!provider) {
    return suggestTagsFallback(content);
  }

  try {
    const response = await provider.complete({
      messages: [
        { role: 'system', content: EXTENDED_PROMPTS.suggestTags },
        { role: 'user', content: content },
      ],
      maxTokens: 128,
      temperature: 0.3,
    });

    const parsed = JSON.parse(response.content);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch (error) {
    console.error('Suggest tags failed:', error);
    return suggestTagsFallback(content);
  }
}

// Fallback tag suggestion based on word frequency
function suggestTagsFallback(content: string): string[] {
  const words = extractKeywords(content);
  const freq = new Map<string, number>();

  words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// Generate smart outline from messy content
export async function generateOutline(content: string): Promise<string | null> {
  const provider = getProvider();
  if (!provider) {
    return null; // No fallback for this - requires AI
  }

  try {
    const response = await provider.complete({
      messages: [
        { role: 'system', content: EXTENDED_PROMPTS.generateOutline },
        { role: 'user', content: content },
      ],
      maxTokens: 2048,
      temperature: 0.5,
    });

    return response.content.trim();
  } catch (error) {
    console.error('Generate outline failed:', error);
    return null;
  }
}

// Generate daily digest
export async function generateDailyDigest(notes: Note[]): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;

  if (notes.length === 0) return 'No notes to summarize.';

  const notesContext = notes
    .map(n => `Title: ${n.title}\nContent: ${n.content}`)
    .join('\n\n---\n\n');

  try {
    const response = await provider.complete({
      messages: [
        { role: 'system', content: EXTENDED_PROMPTS.dailyDigest },
        { role: 'user', content: notesContext },
      ],
      maxTokens: 1024,
      temperature: 0.5,
    });

    return response.content.trim();
  } catch (error) {
    console.error('Generate digest failed:', error);
    return null;
  }
}

// Summarize transcribed audio
export async function summarizeTranscription(transcription: string): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;

  try {
    const response = await provider.complete({
      messages: [
        { role: 'system', content: `Summarize this transcribed audio recording into clear, organized notes.
- Extract key points and action items
- Organize into logical sections if the content covers multiple topics
- Clean up any transcription artifacts (filler words, repetitions)
- Format using markdown for readability
- Include a brief summary at the top` },
        { role: 'user', content: transcription },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    return response.content.trim();
  } catch (error) {
    console.error('Summarize transcription failed:', error);
    return null;
  }
}

// Export utility functions
export function getAPIKey(): string | null {
  if (env.aiProvider === 'openai') return env.openai.apiKey || null;
  if (env.aiProvider === 'anthropic') return env.anthropic.apiKey || null;
  return null;
}

export function getAIProvider(): 'openai' | 'anthropic' | null {
  return env.aiProvider || null;
}

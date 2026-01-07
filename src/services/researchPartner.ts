/**
 * Research Partner Service
 *
 * A conversational AI assistant that knows your notes.
 * Uses semantic search to provide context-aware responses.
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import type { Note } from '../types/note';
import { hybridSearch, type SearchResult } from './semanticSearch';

// Conversation types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

export interface Citation {
  noteId: string;
  noteTitle: string;
  excerpt: string;
  relevance: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// Storage key
const CONVERSATIONS_STORE = 'conversations';

/**
 * Get OpenAI API key
 */
function getOpenAIKey(): string | null {
  return localStorage.getItem('openai_api_key');
}

/**
 * Check if Research Partner is available
 */
export function isResearchPartnerAvailable(): boolean {
  return getOpenAIKey() !== null;
}

/**
 * Create a new conversation
 */
export async function createConversation(title?: string): Promise<Conversation> {
  const conversation: Conversation = {
    id: uuidv4(),
    title: title || 'New Conversation',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.table(CONVERSATIONS_STORE).add(conversation);
  return conversation;
}

/**
 * Get a conversation by ID
 */
export async function getConversation(id: string): Promise<Conversation | undefined> {
  return db.table(CONVERSATIONS_STORE).get(id);
}

/**
 * Get all conversations
 */
export async function getAllConversations(): Promise<Conversation[]> {
  const conversations = await db.table(CONVERSATIONS_STORE).toArray();
  return conversations.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Update conversation
 */
export async function updateConversation(conversation: Conversation): Promise<void> {
  conversation.updatedAt = new Date();
  await db.table(CONVERSATIONS_STORE).put(conversation);
}

/**
 * Delete conversation
 */
export async function deleteConversation(id: string): Promise<void> {
  await db.table(CONVERSATIONS_STORE).delete(id);
}

/**
 * Build context from relevant notes
 */
async function buildContext(query: string, notes: Note[]): Promise<{
  context: string;
  citations: Citation[];
}> {
  // Search for relevant notes
  const results = await hybridSearch(query, 5, notes);

  if (results.length === 0) {
    return { context: '', citations: [] };
  }

  // Build context string
  const contextParts: string[] = [];
  const citations: Citation[] = [];

  for (const result of results) {
    contextParts.push(`[Note: ${result.note.title}]\n${result.note.content.slice(0, 1000)}`);

    citations.push({
      noteId: result.note.id,
      noteTitle: result.note.title,
      excerpt: result.relevantExcerpt || result.note.content.slice(0, 150),
      relevance: result.score,
    });
  }

  return {
    context: contextParts.join('\n\n---\n\n'),
    citations,
  };
}

/**
 * Generate system prompt with note knowledge
 */
function buildSystemPrompt(context: string): string {
  const basePrompt = `You are a Research Partner - an AI assistant that helps users explore and understand their notes. You have access to the user's personal notes and can answer questions based on them.

When responding:
1. Reference specific notes by title: [Note: Title]
2. Quote relevant passages when helpful
3. Be honest if you don't find relevant information in the notes
4. Suggest related questions the user might want to explore
5. Be conversational and helpful

You know things from the user's notes, but you should NOT make up information. If something isn't in the notes, say so.`;

  if (context) {
    return `${basePrompt}

Here are relevant notes from the user's knowledge base:

${context}`;
  }

  return `${basePrompt}

Note: I don't have specific notes to reference for this query. I'll do my best to help, but please let me know if you'd like me to search your notes for specific topics.`;
}

/**
 * Send a message and get a response
 */
export async function sendMessage(
  conversationId: string,
  userMessage: string,
  notes: Note[]
): Promise<{ response: Message; citations: Citation[] }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Get conversation
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Build context from relevant notes
  const { context, citations } = await buildContext(userMessage, notes);

  // Add user message
  const userMsg: Message = {
    id: uuidv4(),
    role: 'user',
    content: userMessage,
    timestamp: new Date(),
  };
  conversation.messages.push(userMsg);

  // Build messages array for API
  const apiMessages = [
    { role: 'system' as const, content: buildSystemPrompt(context) },
    ...conversation.messages.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get AI response');
  }

  const data = await response.json();
  const assistantContent = data.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

  // Add assistant message
  const assistantMsg: Message = {
    id: uuidv4(),
    role: 'assistant',
    content: assistantContent,
    citations,
    timestamp: new Date(),
  };
  conversation.messages.push(assistantMsg);

  // Update conversation title if this is the first exchange
  if (conversation.messages.length === 2) {
    conversation.title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '');
  }

  // Save conversation
  await updateConversation(conversation);

  return { response: assistantMsg, citations };
}

/**
 * Get suggested follow-up questions based on the conversation
 */
export async function getFollowUpSuggestions(
  conversationId: string
): Promise<string[]> {
  const conversation = await getConversation(conversationId);
  if (!conversation || conversation.messages.length === 0) {
    return [];
  }

  const lastAssistantMessage = [...conversation.messages]
    .reverse()
    .find(m => m.role === 'assistant');

  if (!lastAssistantMessage) {
    return [];
  }

  // Extract note titles mentioned
  const mentions = lastAssistantMessage.content.match(/\[Note: ([^\]]+)\]/g) || [];
  const noteTitles = mentions.map(m => m.replace('[Note: ', '').replace(']', ''));

  const suggestions: string[] = [];

  if (noteTitles.length > 0) {
    suggestions.push(`Tell me more about ${noteTitles[0]}`);
  }

  // Add generic follow-ups
  suggestions.push('What else do I know about this topic?');
  suggestions.push('Are there any related notes I should look at?');

  return suggestions.slice(0, 3);
}

/**
 * Generate a research brief on a topic
 */
export async function generateResearchBrief(
  topic: string,
  notes: Note[]
): Promise<{ brief: string; citations: Citation[] }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Search for relevant notes
  const results = await hybridSearch(topic, 10, notes);

  if (results.length === 0) {
    return {
      brief: `I couldn't find any notes about "${topic}". Try a different topic or add some notes first.`,
      citations: [],
    };
  }

  // Build context
  const context = results
    .map(r => `[${r.note.title}]\n${r.note.content.slice(0, 800)}`)
    .join('\n\n---\n\n');

  const citations: Citation[] = results.map(r => ({
    noteId: r.note.id,
    noteTitle: r.note.title,
    excerpt: r.relevantExcerpt || r.note.content.slice(0, 150),
    relevance: r.score,
  }));

  // Generate brief
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a research assistant. Generate a concise research brief based on the user's notes. Include:
1. A summary of what the user knows about the topic
2. Key facts and insights
3. Questions or gaps in knowledge
4. Action items if any are mentioned

Format with markdown headers and bullet points. Reference source notes as [Note: Title].`,
        },
        {
          role: 'user',
          content: `Generate a research brief about "${topic}" based on these notes:\n\n${context}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate brief');
  }

  const data = await response.json();
  const brief = data.choices[0]?.message?.content || 'Failed to generate brief.';

  return { brief, citations };
}

/**
 * Answer a quick question using notes as context (no conversation)
 */
export async function quickAnswer(
  question: string,
  notes: Note[]
): Promise<{ answer: string; citations: Citation[] }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const { context, citations } = await buildContext(question, notes);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Answer the user's question based on their notes. Be concise and cite sources as [Note: Title]. If the answer isn't in the notes, say so.

${context ? `Notes:\n${context}` : 'No relevant notes found.'}`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get answer');
  }

  const data = await response.json();
  const answer = data.choices[0]?.message?.content || 'I could not find an answer.';

  return { answer, citations };
}

// ============================================================================
// PHASE 3: PROACTIVE ASSISTANCE
// ============================================================================

/**
 * Extract tasks from AI response
 */
export interface ExtractedTask {
  id: string;
  task: string;
  priority: 'high' | 'medium' | 'low';
  relatedNoteIds: string[];
}

/**
 * Extract actionable tasks from conversation context
 */
export async function extractTasksFromConversation(
  conversationId: string,
  notes: Note[]
): Promise<ExtractedTask[]> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const conversation = await getConversation(conversationId);
  if (!conversation || conversation.messages.length < 2) {
    return [];
  }

  // Get last few exchanges
  const recentMessages = conversation.messages.slice(-6);
  const context = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a task extraction assistant. Extract actionable tasks from the conversation. Return a JSON array of tasks:
[
  {"task": "description", "priority": "high|medium|low"}
]

Only extract concrete, actionable tasks. If no tasks, return [].
Return ONLY valid JSON, no markdown formatting.`,
        },
        {
          role: 'user',
          content: `Extract tasks from this conversation:\n\n${context}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '[]';

  try {
    const parsed = JSON.parse(content.replace(/```json?|```/g, '').trim());
    return parsed.map((t: { task: string; priority: string }) => ({
      id: uuidv4(),
      task: t.task,
      priority: t.priority || 'medium',
      relatedNoteIds: [],
    }));
  } catch {
    return [];
  }
}

/**
 * Generate AI-powered follow-up suggestions based on conversation
 */
export async function getAIFollowUpSuggestions(
  conversationId: string,
  notes: Note[]
): Promise<string[]> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    return getFollowUpSuggestions(conversationId); // Fall back to basic suggestions
  }

  const conversation = await getConversation(conversationId);
  if (!conversation || conversation.messages.length === 0) {
    return [];
  }

  const lastMessages = conversation.messages.slice(-4);
  const context = lastMessages.map(m => `${m.role}: ${m.content.slice(0, 300)}`).join('\n');

  // Get note titles for context
  const noteTitles = notes.slice(0, 20).map(n => n.title).join(', ');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate 3 follow-up questions the user might want to ask based on the conversation. Questions should explore related topics in their notes.
Available notes include: ${noteTitles}

Return ONLY a JSON array of 3 strings (questions). No markdown.`,
        },
        {
          role: 'user',
          content: context,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    return getFollowUpSuggestions(conversationId);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '[]';

  try {
    const parsed = JSON.parse(content.replace(/```json?|```/g, '').trim());
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return getFollowUpSuggestions(conversationId);
  }
}

/**
 * Generate a meeting preparation brief
 */
export async function generateMeetingBrief(
  meetingTopic: string,
  participants: string[],
  notes: Note[]
): Promise<{ brief: string; citations: Citation[]; suggestedTalkingPoints: string[] }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Search for notes related to the meeting topic and participants
  const searchQueries = [meetingTopic, ...participants];
  const allResults: SearchResult[] = [];

  for (const query of searchQueries) {
    const results = await hybridSearch(query, 5, notes);
    allResults.push(...results);
  }

  // Deduplicate results
  const seen = new Set<string>();
  const uniqueResults = allResults.filter(r => {
    if (seen.has(r.note.id)) return false;
    seen.add(r.note.id);
    return true;
  }).slice(0, 10);

  if (uniqueResults.length === 0) {
    return {
      brief: `No relevant notes found for meeting about "${meetingTopic}".`,
      citations: [],
      suggestedTalkingPoints: [],
    };
  }

  const context = uniqueResults
    .map(r => `[${r.note.title}]\n${r.note.content.slice(0, 600)}`)
    .join('\n\n---\n\n');

  const citations: Citation[] = uniqueResults.map(r => ({
    noteId: r.note.id,
    noteTitle: r.note.title,
    excerpt: r.relevantExcerpt || r.note.content.slice(0, 150),
    relevance: r.score,
  }));

  const participantContext = participants.length > 0
    ? `\nMeeting participants: ${participants.join(', ')}`
    : '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are preparing someone for a meeting. Create a concise brief that includes:

1. **Context**: What the user knows about this topic from their notes
2. **Key Points**: Important facts and figures to remember
3. **History**: Previous interactions or decisions (if any)
4. **Questions**: Things to clarify or ask in the meeting
5. **Talking Points**: Suggested discussion topics

Use markdown formatting. Reference notes as [Note: Title].
At the end, include a JSON block with talking points:
\`\`\`json
{"talkingPoints": ["point1", "point2", "point3"]}
\`\`\``,
        },
        {
          role: 'user',
          content: `Prepare me for a meeting about "${meetingTopic}".${participantContext}\n\nMy relevant notes:\n\n${context}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate brief');
  }

  const data = await response.json();
  let briefContent = data.choices[0]?.message?.content || 'Failed to generate brief.';

  // Extract talking points from JSON block
  let suggestedTalkingPoints: string[] = [];
  const jsonMatch = briefContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      suggestedTalkingPoints = parsed.talkingPoints || [];
      // Remove JSON block from brief
      briefContent = briefContent.replace(/```json[\s\S]*?```/, '').trim();
    } catch {
      // Ignore JSON parsing errors
    }
  }

  return { brief: briefContent, citations, suggestedTalkingPoints };
}

// ============================================================================
// PHASE 4: LONG-TERM MEMORY
// ============================================================================

/**
 * Key fact extracted from notes
 */
export interface KeyFact {
  id: string;
  fact: string;
  category: string;
  sourceNoteIds: string[];
  extractedAt: Date;
  confidence: number;
}

/**
 * AI Knowledge summary
 */
export interface AIKnowledge {
  facts: KeyFact[];
  topics: { name: string; noteCount: number }[];
  lastUpdated: Date;
}

const AI_KNOWLEDGE_KEY = 'patchpad_ai_knowledge';

/**
 * Get stored AI knowledge
 */
export function getStoredKnowledge(): AIKnowledge | null {
  try {
    const stored = localStorage.getItem(AI_KNOWLEDGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      lastUpdated: new Date(parsed.lastUpdated),
      facts: parsed.facts.map((f: KeyFact) => ({
        ...f,
        extractedAt: new Date(f.extractedAt),
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Save AI knowledge
 */
function saveKnowledge(knowledge: AIKnowledge): void {
  localStorage.setItem(AI_KNOWLEDGE_KEY, JSON.stringify(knowledge));
}

/**
 * Extract key facts from notes
 */
export async function extractKeyFacts(
  notes: Note[],
  maxFacts: number = 20
): Promise<KeyFact[]> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Sample notes for fact extraction (avoid token limits)
  const sampledNotes = notes
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 30);

  const context = sampledNotes
    .map(n => `[ID: ${n.id}] [${n.title}]\n${n.content.slice(0, 400)}`)
    .join('\n\n---\n\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract key facts from the user's notes. Focus on:
- Names of people, companies, projects
- Important dates and deadlines
- Key decisions or conclusions
- Recurring themes or patterns

Return a JSON array:
[
  {"fact": "description", "category": "person|project|date|decision|theme", "sourceIds": ["noteId1"], "confidence": 0.8}
]

Extract up to ${maxFacts} most important facts. Return ONLY valid JSON, no markdown.`,
        },
        {
          role: 'user',
          content: `Extract key facts from these notes:\n\n${context}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to extract facts');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '[]';

  try {
    const parsed = JSON.parse(content.replace(/```json?|```/g, '').trim());
    return parsed.map((f: { fact: string; category: string; sourceIds: string[]; confidence: number }) => ({
      id: uuidv4(),
      fact: f.fact,
      category: f.category || 'general',
      sourceNoteIds: f.sourceIds || [],
      extractedAt: new Date(),
      confidence: f.confidence || 0.5,
    }));
  } catch {
    return [];
  }
}

/**
 * Build AI knowledge summary from notes
 */
export async function buildAIKnowledge(notes: Note[]): Promise<AIKnowledge> {
  // Extract key facts
  const facts = await extractKeyFacts(notes);

  // Build topic summary
  const topicCounts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) {
      topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
    }
  }

  const topics = Array.from(topicCounts.entries())
    .map(([name, noteCount]) => ({ name, noteCount }))
    .sort((a, b) => b.noteCount - a.noteCount)
    .slice(0, 15);

  const knowledge: AIKnowledge = {
    facts,
    topics,
    lastUpdated: new Date(),
  };

  saveKnowledge(knowledge);
  return knowledge;
}

/**
 * Remove a fact from AI knowledge
 */
export function removeKnowledgeFact(factId: string): void {
  const knowledge = getStoredKnowledge();
  if (!knowledge) return;

  knowledge.facts = knowledge.facts.filter(f => f.id !== factId);
  saveKnowledge(knowledge);
}

/**
 * Update a fact in AI knowledge
 */
export function updateKnowledgeFact(factId: string, newFact: string): void {
  const knowledge = getStoredKnowledge();
  if (!knowledge) return;

  const fact = knowledge.facts.find(f => f.id === factId);
  if (fact) {
    fact.fact = newFact;
    saveKnowledge(knowledge);
  }
}

/**
 * Reference past conversations in context
 */
export async function getConversationContext(
  query: string,
  limit: number = 3
): Promise<{ conversationId: string; title: string; excerpt: string }[]> {
  const conversations = await getAllConversations();

  // Simple keyword matching for now
  const queryWords = query.toLowerCase().split(/\s+/);

  const scored = conversations.map(convo => {
    const allText = convo.messages.map(m => m.content).join(' ').toLowerCase();
    const score = queryWords.reduce((s, word) => {
      return s + (allText.includes(word) ? 1 : 0);
    }, 0);

    return { convo, score };
  }).filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(s => {
    const lastAssistant = [...s.convo.messages].reverse().find(m => m.role === 'assistant');
    return {
      conversationId: s.convo.id,
      title: s.convo.title,
      excerpt: lastAssistant?.content.slice(0, 200) || 'No response yet',
    };
  });
}

/**
 * Create a note from a research brief
 */
export function briefToNoteContent(
  topic: string,
  brief: string,
  citations: Citation[]
): { title: string; content: string; tags: string[] } {
  const title = `Research Brief: ${topic}`;

  let content = `# ${title}\n\n`;
  content += `*Generated on ${new Date().toLocaleDateString()}*\n\n`;
  content += brief;

  if (citations.length > 0) {
    content += '\n\n---\n\n## Sources\n\n';
    content += citations.map(c => `- [[${c.noteTitle}]]`).join('\n');
  }

  return {
    title,
    content,
    tags: ['research-brief', 'ai-generated'],
  };
}

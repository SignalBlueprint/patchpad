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

/**
 * Conversation Insights Service
 *
 * Analyzes AI Research Partner conversations to surface patterns,
 * frequently asked questions, and knowledge gaps.
 */

import type { Conversation, Message } from './researchPartner';
import { extractFromNote } from './brain';
import type { Note } from '../types/note';

// Types
export interface QuestionSummary {
  question: string;
  count: number;
  conversations: string[]; // conversation IDs
  lastAsked: Date;
}

export interface TopicCount {
  topic: string;
  count: number;
  conversations: string[];
}

export interface KnowledgeGap {
  id: string;
  topic: string;
  originalQuestion: string;
  aiResponse: string;
  conversationId: string;
  timestamp: Date;
}

export interface ConversationInsights {
  topQuestions: QuestionSummary[];
  topTopics: TopicCount[];
  knowledgeGaps: KnowledgeGap[];
  questionCount: number;
  totalConversations: number;
}

/**
 * Phrases that indicate AI couldn't find information
 */
const KNOWLEDGE_GAP_PHRASES = [
  "i don't have information",
  "your notes don't mention",
  "i couldn't find",
  "no information about",
  "not mentioned in",
  "i don't see any",
  "there's no information",
  "i wasn't able to find",
  "your notes don't contain",
  "i don't have any data",
  "no notes contain",
  "i can't find any",
];

/**
 * Analyze all conversations and extract insights
 */
export async function analyzeConversations(conversations: Conversation[]): Promise<ConversationInsights> {
  const topQuestions = await getTopQuestions(conversations);
  const topTopics = await getTopTopics(conversations);
  const knowledgeGaps = getKnowledgeGaps(conversations);

  // Count total user questions
  const questionCount = conversations.reduce((count, conv) =>
    count + conv.messages.filter(m => m.role === 'user').length, 0
  );

  return {
    topQuestions,
    topTopics,
    knowledgeGaps,
    questionCount,
    totalConversations: conversations.length,
  };
}

/**
 * Extract and aggregate top questions from conversations
 */
export async function getTopQuestions(
  conversations: Conversation[],
  limit: number = 10
): Promise<QuestionSummary[]> {
  // Extract all user messages (questions)
  const questions: { text: string; convId: string; timestamp: Date }[] = [];

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role === 'user' && msg.content.trim()) {
        questions.push({
          text: msg.content.trim(),
          convId: conv.id,
          timestamp: new Date(msg.timestamp),
        });
      }
    }
  }

  // Group similar questions using normalized form
  const questionGroups = new Map<string, {
    original: string;
    conversations: Set<string>;
    lastAsked: Date;
    count: number;
  }>();

  for (const q of questions) {
    const normalized = normalizeQuestion(q.text);

    if (questionGroups.has(normalized)) {
      const group = questionGroups.get(normalized)!;
      group.count++;
      group.conversations.add(q.convId);
      if (q.timestamp > group.lastAsked) {
        group.lastAsked = q.timestamp;
        group.original = q.text; // Keep the most recent phrasing
      }
    } else {
      questionGroups.set(normalized, {
        original: q.text,
        conversations: new Set([q.convId]),
        lastAsked: q.timestamp,
        count: 1,
      });
    }
  }

  // Convert to array and sort by count
  const summaries: QuestionSummary[] = [...questionGroups.values()]
    .map(g => ({
      question: g.original,
      count: g.count,
      conversations: [...g.conversations],
      lastAsked: g.lastAsked,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return summaries;
}

/**
 * Extract topics from conversations using keyword extraction
 */
export async function getTopTopics(
  conversations: Conversation[],
  limit: number = 15
): Promise<TopicCount[]> {
  const topicCounts = new Map<string, Set<string>>();

  for (const conv of conversations) {
    // Extract topics from user messages
    for (const msg of conv.messages) {
      if (msg.role === 'user') {
        const topics = extractTopicsFromText(msg.content);
        for (const topic of topics) {
          if (!topicCounts.has(topic)) {
            topicCounts.set(topic, new Set());
          }
          topicCounts.get(topic)!.add(conv.id);
        }
      }
    }
  }

  // Convert to array and sort by count
  return [...topicCounts.entries()]
    .map(([topic, convs]) => ({
      topic,
      count: convs.size,
      conversations: [...convs],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Find knowledge gaps - questions where AI couldn't provide information
 */
export function getKnowledgeGaps(conversations: Conversation[]): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];

  for (const conv of conversations) {
    const messages = conv.messages;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // Only check assistant messages
      if (msg.role !== 'assistant') continue;

      const contentLower = msg.content.toLowerCase();

      // Check if response contains gap phrases
      const hasGap = KNOWLEDGE_GAP_PHRASES.some(phrase =>
        contentLower.includes(phrase)
      );

      if (hasGap) {
        // Find the user question that led to this response
        const userQuestion = findPrecedingUserMessage(messages, i);

        if (userQuestion) {
          // Extract the topic from the question
          const topic = extractMainTopic(userQuestion.content);

          gaps.push({
            id: generateId(),
            topic,
            originalQuestion: userQuestion.content,
            aiResponse: msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : ''),
            conversationId: conv.id,
            timestamp: new Date(msg.timestamp),
          });
        }
      }
    }
  }

  // Deduplicate by topic (keep most recent)
  const uniqueGaps = new Map<string, KnowledgeGap>();
  for (const gap of gaps) {
    const normalizedTopic = gap.topic.toLowerCase();
    if (!uniqueGaps.has(normalizedTopic) ||
        gap.timestamp > uniqueGaps.get(normalizedTopic)!.timestamp) {
      uniqueGaps.set(normalizedTopic, gap);
    }
  }

  return [...uniqueGaps.values()]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Normalize a question for comparison
 */
function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?!.,;:'"]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim()
    .split(' ')
    .filter(w => w.length > 2)  // Remove short words
    .sort()                     // Sort for order-independent comparison
    .join(' ');
}

/**
 * Extract topics/keywords from text
 */
function extractTopicsFromText(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'about', 'what', 'how', 'when', 'where', 'why', 'who', 'which',
    'tell', 'me', 'please', 'can', 'you', 'i', 'my', 'your', 'we', 'our',
    'and', 'or', 'but', 'if', 'so', 'then', 'there', 'here', 'this', 'that',
    'these', 'those', 'all', 'any', 'some', 'no', 'not', 'only', 'just',
    'more', 'most', 'much', 'many', 'few', 'such', 'other', 'another',
    'find', 'get', 'make', 'know', 'think', 'see', 'look', 'want', 'give',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i); // Unique
}

/**
 * Find the user message that preceded an assistant message
 */
function findPrecedingUserMessage(messages: Message[], assistantIndex: number): Message | null {
  for (let i = assistantIndex - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i];
    }
  }
  return null;
}

/**
 * Extract the main topic from a question
 */
function extractMainTopic(question: string): string {
  const topics = extractTopicsFromText(question);

  if (topics.length === 0) {
    // Fallback: use first few words
    return question.slice(0, 50) + (question.length > 50 ? '...' : '');
  }

  // Return top topics joined
  return topics.slice(0, 3).join(' ');
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Format question count for display
 */
export function formatQuestionTrend(count: number, periodDays: number = 30): string {
  if (count === 0) return 'No questions asked';
  if (count === 1) return '1 question this month';
  return `${count} questions this month`;
}

/**
 * Get conversations mentioning a specific topic
 */
export function filterConversationsByTopic(
  conversations: Conversation[],
  topic: string
): Conversation[] {
  const topicLower = topic.toLowerCase();

  return conversations.filter(conv =>
    conv.messages.some(msg =>
      msg.role === 'user' && msg.content.toLowerCase().includes(topicLower)
    )
  );
}

/**
 * Get all questions from a specific conversation
 */
export function getQuestionsFromConversation(conversation: Conversation): string[] {
  return conversation.messages
    .filter(m => m.role === 'user')
    .map(m => m.content);
}

/**
 * Calculate conversation activity over time
 */
export function getConversationActivity(
  conversations: Conversation[],
  periodDays: number = 30
): { date: string; count: number }[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  const activityMap = new Map<string, number>();

  for (const conv of conversations) {
    const date = new Date(conv.createdAt);
    if (date >= cutoffDate) {
      const dateStr = date.toISOString().split('T')[0];
      activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
    }
  }

  // Fill in missing dates
  const activity: { date: string; count: number }[] = [];
  const current = new Date(cutoffDate);
  const today = new Date();

  while (current <= today) {
    const dateStr = current.toISOString().split('T')[0];
    activity.push({
      date: dateStr,
      count: activityMap.get(dateStr) || 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return activity;
}

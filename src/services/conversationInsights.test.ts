import { describe, it, expect } from 'vitest';
import {
  getTopQuestions,
  getTopTopics,
  getKnowledgeGaps,
  analyzeConversations,
  filterConversationsByTopic,
  getQuestionsFromConversation,
  getConversationActivity,
} from './conversationInsights';
import type { Conversation, Message } from './researchPartner';

// Helper to create test messages
function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: Math.random().toString(36).substring(7),
    role: 'user',
    content: 'Test message',
    timestamp: new Date(),
    ...overrides,
  };
}

// Helper to create test conversations
function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: Math.random().toString(36).substring(7),
    title: 'Test Conversation',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('getTopQuestions', () => {
  it('aggregates similar questions', async () => {
    const conversations = [
      createConversation({
        id: 'conv1',
        messages: [
          createMessage({ role: 'user', content: 'What is the project deadline?' }),
          createMessage({ role: 'assistant', content: 'The deadline is...' }),
        ],
      }),
      createConversation({
        id: 'conv2',
        messages: [
          createMessage({ role: 'user', content: 'What is the project deadline' }),
          createMessage({ role: 'assistant', content: 'Based on your notes...' }),
        ],
      }),
      createConversation({
        id: 'conv3',
        messages: [
          createMessage({ role: 'user', content: 'Tell me about the budget' }),
          createMessage({ role: 'assistant', content: 'The budget info...' }),
        ],
      }),
    ];

    const result = await getTopQuestions(conversations);

    // Should group the similar deadline questions
    expect(result.length).toBeLessThanOrEqual(2);

    // Find the deadline question (should have count 2)
    const deadlineQ = result.find(q =>
      q.question.toLowerCase().includes('deadline')
    );
    expect(deadlineQ).toBeDefined();
    expect(deadlineQ!.count).toBe(2);
    expect(deadlineQ!.conversations).toHaveLength(2);
  });

  it('returns questions sorted by frequency', async () => {
    const conversations = [
      createConversation({
        messages: [
          createMessage({ role: 'user', content: 'What is the marketing budget for next year?' }),
          createMessage({ role: 'assistant', content: 'Answer' }),
          createMessage({ role: 'user', content: 'Tell me about the project timeline' }),
          createMessage({ role: 'assistant', content: 'Answer' }),
          createMessage({ role: 'user', content: 'Tell me about the project timeline' }),
          createMessage({ role: 'assistant', content: 'Answer' }),
        ],
      }),
    ];

    const result = await getTopQuestions(conversations);

    // Timeline question should be first (appears twice with exact same wording)
    expect(result[0].question.toLowerCase()).toContain('timeline');
    expect(result[0].count).toBe(2);
  });

  it('respects limit parameter', async () => {
    const conversations = [
      createConversation({
        messages: Array.from({ length: 20 }, (_, i) => [
          createMessage({ role: 'user', content: `Unique question ${i}` }),
          createMessage({ role: 'assistant', content: 'Answer' }),
        ]).flat() as Message[],
      }),
    ];

    const result = await getTopQuestions(conversations, 5);

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('ignores empty questions', async () => {
    const conversations = [
      createConversation({
        messages: [
          createMessage({ role: 'user', content: '' }),
          createMessage({ role: 'user', content: '   ' }),
          createMessage({ role: 'user', content: 'Real question' }),
        ],
      }),
    ];

    const result = await getTopQuestions(conversations);

    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('Real question');
  });
});

describe('getTopTopics', () => {
  it('extracts topics from questions correctly', async () => {
    const conversations = [
      createConversation({
        messages: [
          createMessage({ role: 'user', content: 'What is the marketing strategy?' }),
          createMessage({ role: 'user', content: 'Tell me about marketing plans' }),
          createMessage({ role: 'user', content: 'How does the budget work?' }),
        ],
      }),
    ];

    const result = await getTopTopics(conversations);

    // Marketing should be top topic (mentioned twice)
    const marketingTopic = result.find(t =>
      t.topic.toLowerCase().includes('marketing')
    );
    expect(marketingTopic).toBeDefined();
  });

  it('filters out stop words', async () => {
    const conversations = [
      createConversation({
        messages: [
          createMessage({ role: 'user', content: 'What is the thing about something?' }),
        ],
      }),
    ];

    const result = await getTopTopics(conversations);

    // Should not include common stop words as topics
    const stopWordTopics = result.filter(t =>
      ['what', 'the', 'is', 'about'].includes(t.topic.toLowerCase())
    );
    expect(stopWordTopics).toHaveLength(0);
  });

  it('tracks which conversations mention each topic', async () => {
    const conversations = [
      createConversation({
        id: 'conv1',
        messages: [
          createMessage({ role: 'user', content: 'Tell me about project alpha' }),
        ],
      }),
      createConversation({
        id: 'conv2',
        messages: [
          createMessage({ role: 'user', content: 'What about project alpha?' }),
        ],
      }),
    ];

    const result = await getTopTopics(conversations);

    const projectTopic = result.find(t =>
      t.topic.toLowerCase().includes('project')
    );
    expect(projectTopic?.conversations).toContain('conv1');
    expect(projectTopic?.conversations).toContain('conv2');
  });
});

describe('getKnowledgeGaps', () => {
  it('detects "no information" responses', () => {
    const conversations = [
      createConversation({
        id: 'conv1',
        messages: [
          createMessage({ role: 'user', content: 'What is the Q4 revenue?' }),
          createMessage({
            role: 'assistant',
            content: "I couldn't find any information about Q4 revenue in your notes.",
          }),
        ],
      }),
    ];

    const gaps = getKnowledgeGaps(conversations);

    expect(gaps).toHaveLength(1);
    expect(gaps[0].originalQuestion).toContain('Q4 revenue');
    expect(gaps[0].conversationId).toBe('conv1');
  });

  it('detects multiple gap phrases', () => {
    const gapPhrases = [
      "I don't have information about",
      "your notes don't mention",
      "I couldn't find",
      "no information about",
    ];

    const conversations = gapPhrases.map((phrase, i) =>
      createConversation({
        id: `conv${i}`,
        messages: [
          createMessage({ role: 'user', content: `Question ${i}` }),
          createMessage({ role: 'assistant', content: `${phrase} this topic.` }),
        ],
      })
    );

    const gaps = getKnowledgeGaps(conversations);

    expect(gaps.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts topic from question', () => {
    const conversations = [
      createConversation({
        messages: [
          createMessage({ role: 'user', content: 'Tell me about the marketing budget for 2024' }),
          createMessage({
            role: 'assistant',
            content: "Your notes don't mention anything about marketing budgets.",
          }),
        ],
      }),
    ];

    const gaps = getKnowledgeGaps(conversations);

    expect(gaps).toHaveLength(1);
    // Topic should include relevant keywords
    expect(gaps[0].topic.toLowerCase()).toMatch(/marketing|budget|2024/);
  });

  it('ignores responses without gap phrases', () => {
    const conversations = [
      createConversation({
        messages: [
          createMessage({ role: 'user', content: 'What is the deadline?' }),
          createMessage({
            role: 'assistant',
            content: 'Based on your notes, the deadline is next Friday.',
          }),
        ],
      }),
    ];

    const gaps = getKnowledgeGaps(conversations);

    expect(gaps).toHaveLength(0);
  });

  it('deduplicates gaps by topic', () => {
    const conversations = [
      createConversation({
        id: 'conv1',
        messages: [
          createMessage({ role: 'user', content: 'What is the budget?' }),
          createMessage({
            role: 'assistant',
            content: "I couldn't find budget information.",
          }),
        ],
      }),
      createConversation({
        id: 'conv2',
        messages: [
          createMessage({ role: 'user', content: 'Tell me about the budget' }),
          createMessage({
            role: 'assistant',
            content: "Your notes don't mention the budget.",
          }),
        ],
      }),
    ];

    const gaps = getKnowledgeGaps(conversations);

    // Should deduplicate to one gap about "budget"
    expect(gaps).toHaveLength(1);
  });
});

describe('analyzeConversations', () => {
  it('returns complete insights object', async () => {
    const conversations = [
      createConversation({
        messages: [
          createMessage({ role: 'user', content: 'What is project alpha?' }),
          createMessage({ role: 'assistant', content: "I don't have information about that." }),
          createMessage({ role: 'user', content: 'Tell me about deadlines' }),
          createMessage({ role: 'assistant', content: 'The deadline is...' }),
        ],
      }),
    ];

    const insights = await analyzeConversations(conversations);

    expect(insights.topQuestions).toBeDefined();
    expect(insights.topTopics).toBeDefined();
    expect(insights.knowledgeGaps).toBeDefined();
    expect(insights.questionCount).toBe(2);
    expect(insights.totalConversations).toBe(1);
  });
});

describe('filterConversationsByTopic', () => {
  it('filters conversations containing topic', () => {
    const conversations = [
      createConversation({
        id: 'conv1',
        messages: [
          createMessage({ role: 'user', content: 'Tell me about marketing' }),
        ],
      }),
      createConversation({
        id: 'conv2',
        messages: [
          createMessage({ role: 'user', content: 'What about sales?' }),
        ],
      }),
    ];

    const filtered = filterConversationsByTopic(conversations, 'marketing');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('conv1');
  });

  it('is case insensitive', () => {
    const conversations = [
      createConversation({
        messages: [
          createMessage({ role: 'user', content: 'MARKETING strategy' }),
        ],
      }),
    ];

    const filtered = filterConversationsByTopic(conversations, 'marketing');

    expect(filtered).toHaveLength(1);
  });
});

describe('getQuestionsFromConversation', () => {
  it('extracts only user messages', () => {
    const conversation = createConversation({
      messages: [
        createMessage({ role: 'user', content: 'Question 1' }),
        createMessage({ role: 'assistant', content: 'Answer 1' }),
        createMessage({ role: 'user', content: 'Question 2' }),
        createMessage({ role: 'assistant', content: 'Answer 2' }),
      ],
    });

    const questions = getQuestionsFromConversation(conversation);

    expect(questions).toHaveLength(2);
    expect(questions[0]).toBe('Question 1');
    expect(questions[1]).toBe('Question 2');
  });
});

describe('getConversationActivity', () => {
  it('returns activity for the specified period', () => {
    const today = new Date();
    const conversations = [
      createConversation({ createdAt: today }),
      createConversation({ createdAt: today }),
      createConversation({
        createdAt: new Date(today.getTime() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
      }),
    ];

    const activity = getConversationActivity(conversations, 30);

    // Should have 31 days of data (today plus 30 days back)
    expect(activity.length).toBeGreaterThanOrEqual(30);

    // Today should have 2 conversations
    const todayStr = today.toISOString().split('T')[0];
    const todayActivity = activity.find(a => a.date === todayStr);
    expect(todayActivity?.count).toBe(2);
  });

  it('fills in missing dates with zero', () => {
    const conversations: Conversation[] = [];

    const activity = getConversationActivity(conversations, 7);

    expect(activity.every(a => a.count === 0)).toBe(true);
  });
});

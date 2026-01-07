/**
 * Voice Command Parser
 * Detects voice commands from transcribed text and returns appropriate actions
 */

export type VoiceCommandType = 'create_note' | 'search' | 'ask' | 'none';

export interface VoiceCommandResult {
  type: VoiceCommandType;
  query: string;        // The extracted query/topic
  originalText: string; // The full original transcription
}

// Command patterns with their triggers
const CREATE_NOTE_PATTERNS = [
  /^(create|make|new|start|write)\s+(a\s+)?note\s+(about|on|for)\s+(.+)/i,
  /^(note|reminder)\s+(about|for)\s+(.+)/i,
  /^(take|jot)\s+(a\s+)?note\s+(about|on)\s+(.+)/i,
  /^(add|create)\s+(a\s+)?(quick\s+)?note[:\s]+(.+)/i,
];

const SEARCH_PATTERNS = [
  /^(find|search|look\s+for|show\s+me)\s+(notes?\s+)?(about|on|for|with|containing)\s+(.+)/i,
  /^(find|search|look\s+for)\s+(my\s+)?notes?\s+(about|on|for)\s+(.+)/i,
  /^(where\s+(is|are)\s+my)\s+(notes?\s+)?(about|on)\s+(.+)/i,
  /^(show|list)\s+(me\s+)?(all\s+)?notes?\s+(about|on|for|with)\s+(.+)/i,
];

const ASK_PATTERNS = [
  /^(what\s+did\s+I\s+write\s+about)\s+(.+)/i,
  /^(what\s+do\s+I\s+know\s+about)\s+(.+)/i,
  /^(tell\s+me\s+about)\s+(.+)/i,
  /^(summarize|summary\s+of)\s+(my\s+notes?\s+)?(about|on)\s+(.+)/i,
  /^(what\s+are\s+my\s+notes\s+about)\s+(.+)/i,
  /^(ask|question)[:\s]+(.+)/i,
];

/**
 * Extract the query from matched groups
 * Different patterns capture the query in different group positions
 */
function extractQuery(match: RegExpMatchArray): string {
  // Find the last non-empty capture group (usually the query)
  for (let i = match.length - 1; i > 0; i--) {
    if (match[i] && match[i].trim().length > 0) {
      return match[i].trim();
    }
  }
  return '';
}

/**
 * Parse transcribed text to detect voice commands
 */
export function parseVoiceCommand(text: string): VoiceCommandResult {
  const trimmed = text.trim();

  // Try create note patterns
  for (const pattern of CREATE_NOTE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        type: 'create_note',
        query: extractQuery(match),
        originalText: trimmed,
      };
    }
  }

  // Try search patterns
  for (const pattern of SEARCH_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        type: 'search',
        query: extractQuery(match),
        originalText: trimmed,
      };
    }
  }

  // Try ask patterns
  for (const pattern of ASK_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        type: 'ask',
        query: extractQuery(match),
        originalText: trimmed,
      };
    }
  }

  // No command detected - treat as regular content
  return {
    type: 'none',
    query: '',
    originalText: trimmed,
  };
}

/**
 * Check if text starts with a command trigger word
 * (Quick check before full parsing)
 */
export function mightBeCommand(text: string): boolean {
  const triggers = [
    'create', 'make', 'new', 'start', 'write',
    'note', 'reminder', 'take', 'jot', 'add',
    'find', 'search', 'look', 'show', 'list', 'where',
    'what', 'tell', 'summarize', 'summary', 'ask', 'question',
  ];

  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase();
  return triggers.includes(firstWord);
}

/**
 * Get example commands for user help
 */
export function getCommandExamples(): { type: VoiceCommandType; examples: string[] }[] {
  return [
    {
      type: 'create_note',
      examples: [
        'Create a note about my meeting with John',
        'New note for project ideas',
        'Take a note about grocery shopping',
      ],
    },
    {
      type: 'search',
      examples: [
        'Find notes about work',
        'Search for meeting notes',
        'Show me notes about recipes',
      ],
    },
    {
      type: 'ask',
      examples: [
        'What did I write about vacation plans?',
        'Tell me about my project notes',
        'Summarize my notes about learning',
      ],
    },
  ];
}

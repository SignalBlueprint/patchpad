/**
 * Template Service
 *
 * Manages templates for note creation, including storage, retrieval,
 * application, and AI-enhanced filling.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Template, TemplateValues, AppliedTemplate, BuiltInTemplate, Placeholder } from '../types/template';
import type { Note } from '../types/note';
import { searchNotes } from './semanticSearch';
import { hasAIProvider } from '../config/env';

const TEMPLATES_STORAGE_KEY = 'patchpad_templates';

// Built-in templates that ship with the app
const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    name: 'Meeting Notes',
    description: 'Template for meeting notes with attendees, agenda, and action items',
    structure: `# Meeting: {{title}}

## Date
{{date}}

## Attendees
- {{attendees}}

## Agenda
-

## Discussion Notes


## Action Items
- [ ]

## Next Steps

`,
    placeholders: [
      { key: 'title', label: 'Meeting Title', type: 'text', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'attendees', label: 'Attendees', type: 'text', required: false, defaultValue: '' },
    ],
    aiEnhanced: false,
    tags: ['meeting'],
    titlePrefix: 'Meeting:',
    category: 'work',
    builtIn: true,
  },
  {
    name: 'Research Notes',
    description: 'Template for research with topic, sources, and findings',
    structure: `# Research: {{title}}

## Topic
{{topic}}

## Key Questions
-

## Sources
-

## Findings


## Related Notes
{{ai:related_notes}}

## Open Questions

`,
    placeholders: [
      { key: 'title', label: 'Research Title', type: 'text', required: true },
      { key: 'topic', label: 'Topic', type: 'text', required: true },
      { key: 'ai:related_notes', label: 'Related Notes', type: 'ai-fill', aiPrompt: 'Find notes related to this research topic' },
    ],
    aiEnhanced: true,
    tags: ['research'],
    titlePrefix: 'Research:',
    category: 'learning',
    builtIn: true,
  },
  {
    name: 'Daily Journal',
    description: 'Template for daily reflection and planning',
    structure: `# Journal: {{date}}

## Wins Today
-

## Challenges
-

## Learnings


## Tomorrow's Focus
- [ ]

## Gratitude

`,
    placeholders: [
      { key: 'date', label: 'Date', type: 'date', required: true },
    ],
    aiEnhanced: false,
    tags: ['journal', 'daily'],
    titlePrefix: 'Journal:',
    category: 'personal',
    builtIn: true,
  },
  {
    name: 'Project Brief',
    description: 'Template for project planning and documentation',
    structure: `# Project: {{title}}

## Overview
{{description}}

## Goals
-

## Requirements
-

## Timeline
| Phase | Deadline | Status |
|-------|----------|--------|
|       |          |        |

## Resources Needed
-

## Risks
-

## Success Criteria

`,
    placeholders: [
      { key: 'title', label: 'Project Name', type: 'text', required: true },
      { key: 'description', label: 'Brief Description', type: 'text', required: false },
    ],
    aiEnhanced: false,
    tags: ['project'],
    titlePrefix: 'Project:',
    category: 'work',
    builtIn: true,
  },
  {
    name: 'Book Notes',
    description: 'Template for book summaries and takeaways',
    structure: `# Book: {{title}}

## Author
{{author}}

## Summary


## Key Takeaways
1.
2.
3.

## Favorite Quotes
>

## How This Applies to Me


## Related Books
-

`,
    placeholders: [
      { key: 'title', label: 'Book Title', type: 'text', required: true },
      { key: 'author', label: 'Author', type: 'text', required: false },
    ],
    aiEnhanced: false,
    tags: ['book', 'reading'],
    titlePrefix: 'Book:',
    category: 'learning',
    builtIn: true,
  },
  {
    name: 'Research Summary',
    description: 'AI-powered research summary with related notes and open questions from your knowledge base',
    structure: `# Research Summary: {{topic}}

## Overview
Summarizing what I know about **{{topic}}**.

## Related Notes
{{ai:related_notes}}

## Key Insights
-

## Open Questions
{{ai:open_questions}}

## Next Steps
- [ ]

## Sources & References
-

`,
    placeholders: [
      { key: 'topic', label: 'Research Topic', type: 'text', required: true },
      { key: 'ai:related_notes', label: 'Related Notes', type: 'ai-fill', aiPrompt: 'Find and summarize notes related to this topic' },
      { key: 'ai:open_questions', label: 'Open Questions', type: 'ai-fill', aiPrompt: 'Find unanswered questions from conversations about this topic' },
    ],
    aiEnhanced: true,
    tags: ['research', 'summary', 'ai-generated'],
    titlePrefix: 'Research:',
    category: 'learning',
    builtIn: true,
  },
  {
    name: 'Meeting Prep',
    description: 'AI-powered meeting preparation with context from your notes about participants and company',
    structure: `# Meeting Prep: {{title}}

## Meeting Details
- **Date:** {{date}}
- **Company:** {{company}}
- **Participants:** {{participants}}

## Context from My Notes
{{ai:context}}

## Talking Points
-

## Questions to Ask
-

## Goals for This Meeting
- [ ]

## Follow-up Items
- [ ]

`,
    placeholders: [
      { key: 'title', label: 'Meeting Title', type: 'text', required: true },
      { key: 'date', label: 'Date', type: 'date', required: false },
      { key: 'company', label: 'Company', type: 'text', required: false },
      { key: 'participants', label: 'Participants', type: 'text', required: false },
      { key: 'ai:context', label: 'Context', type: 'ai-fill', aiPrompt: 'Find notes mentioning this company or participants' },
    ],
    aiEnhanced: true,
    tags: ['meeting', 'prep', 'ai-generated'],
    titlePrefix: 'Prep:',
    category: 'work',
    builtIn: true,
  },
];

/**
 * Get all templates (built-in + user-created)
 */
export function getTemplates(): Template[] {
  const userTemplates = getUserTemplates();
  const builtInWithIds = BUILT_IN_TEMPLATES.map(t => ({
    ...t,
    id: `builtin-${t.name.toLowerCase().replace(/\s+/g, '-')}`,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }));

  return [...builtInWithIds, ...userTemplates];
}

/**
 * Get only user-created templates
 */
export function getUserTemplates(): Template[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!stored) return [];

    const templates = JSON.parse(stored);
    return templates.map((t: Template) => ({
      ...t,
      createdAt: new Date(t.createdAt),
      updatedAt: new Date(t.updatedAt),
    }));
  } catch {
    return [];
  }
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): Template | null {
  const templates = getTemplates();
  return templates.find(t => t.id === id) ?? null;
}

/**
 * Save a new template
 */
export function saveTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Template {
  const now = new Date();
  const newTemplate: Template = {
    ...template,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };

  const userTemplates = getUserTemplates();
  userTemplates.push(newTemplate);

  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(userTemplates));

  return newTemplate;
}

/**
 * Update an existing template
 */
export function updateTemplate(id: string, updates: Partial<Omit<Template, 'id' | 'createdAt'>>): Template | null {
  const userTemplates = getUserTemplates();
  const index = userTemplates.findIndex(t => t.id === id);

  if (index === -1) return null; // Can't update built-in templates

  const updated: Template = {
    ...userTemplates[index],
    ...updates,
    updatedAt: new Date(),
  };

  userTemplates[index] = updated;
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(userTemplates));

  return updated;
}

/**
 * Delete a template
 */
export function deleteTemplate(id: string): boolean {
  // Can't delete built-in templates
  if (id.startsWith('builtin-')) return false;

  const userTemplates = getUserTemplates();
  const filtered = userTemplates.filter(t => t.id !== id);

  if (filtered.length === userTemplates.length) return false;

  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Apply a template with provided values
 * Returns the filled content with placeholders replaced
 */
export function applyTemplate(template: Template, values: TemplateValues): AppliedTemplate {
  let content = template.structure;

  // Replace all placeholders (except AI ones)
  for (const placeholder of template.placeholders) {
    if (placeholder.type !== 'ai-fill') {
      const value = values[placeholder.key] ?? placeholder.defaultValue ?? '';
      const regex = new RegExp(`\\{\\{${placeholder.key}\\}\\}`, 'g');
      content = content.replace(regex, value);
    }
  }

  // Generate title
  let title = values.title ?? template.name;
  if (template.titlePrefix && !title.startsWith(template.titlePrefix)) {
    title = `${template.titlePrefix} ${title}`;
  }

  // Collect tags
  const tags = [...(template.tags ?? [])];

  return {
    title,
    content,
    tags,
  };
}

/**
 * Apply a template with AI enhancement
 * Fills AI placeholders using semantic search and AI generation
 */
export async function aiEnhanceTemplate(
  template: Template,
  values: TemplateValues,
  notes: Note[]
): Promise<AppliedTemplate> {
  // First apply basic template
  let result = applyTemplate(template, values);

  // Check if template has AI placeholders
  const aiPlaceholders = template.placeholders.filter(p => p.type === 'ai-fill');

  if (aiPlaceholders.length === 0 || !hasAIProvider()) {
    // Remove AI placeholder markers if no AI available
    for (const placeholder of aiPlaceholders) {
      const regex = new RegExp(`\\{\\{${placeholder.key}\\}\\}`, 'g');
      result.content = result.content.replace(regex, '');
    }
    return result;
  }

  // Process each AI placeholder
  for (const placeholder of aiPlaceholders) {
    try {
      const aiContent = await generateAIContent(placeholder, values, notes);
      const regex = new RegExp(`\\{\\{${placeholder.key}\\}\\}`, 'g');
      result.content = result.content.replace(regex, aiContent);
    } catch (err) {
      console.error(`Failed to generate AI content for ${placeholder.key}:`, err);
      // Remove placeholder on error
      const regex = new RegExp(`\\{\\{${placeholder.key}\\}\\}`, 'g');
      result.content = result.content.replace(regex, '');
    }
  }

  return result;
}

/**
 * Generate AI content for a placeholder
 * Uses semantic search to find related notes and formats them
 */
async function generateAIContent(
  placeholder: Placeholder,
  values: TemplateValues,
  notes: Note[]
): Promise<string> {
  const key = placeholder.key;

  // Handle different AI placeholder types
  if (key === 'ai:related_notes') {
    return generateRelatedNotesContent(values, notes);
  }

  if (key === 'ai:open_questions') {
    return generateOpenQuestionsContent(values, notes);
  }

  if (key === 'ai:context') {
    return generateContextContent(values, notes);
  }

  // Default: search for topic and return related notes
  return generateRelatedNotesContent(values, notes);
}

/**
 * Generate content for ai:related_notes placeholder
 */
async function generateRelatedNotesContent(
  values: TemplateValues,
  notes: Note[]
): Promise<string> {
  const topic = values.topic ?? values.title ?? '';

  if (!topic) {
    return '_No topic specified_';
  }

  const searchResults = await searchNotes(topic, 5, notes);

  if (searchResults.length === 0) {
    return '_No related notes found_';
  }

  return searchResults
    .map(r => {
      const excerpt = r.relevantExcerpt ?? r.note.content.slice(0, 150);
      return `- [[${r.note.title}]]: ${excerpt.trim()}...`;
    })
    .join('\n');
}

/**
 * Generate content for ai:open_questions placeholder
 * Searches for question patterns in notes and conversations
 */
async function generateOpenQuestionsContent(
  values: TemplateValues,
  notes: Note[]
): Promise<string> {
  const topic = values.topic ?? values.title ?? '';

  if (!topic) {
    return '_No topic specified_';
  }

  // Search for notes related to topic
  const searchResults = await searchNotes(topic, 10, notes);

  if (searchResults.length === 0) {
    return '_No related notes found to extract questions from_';
  }

  // Extract questions from note content
  const questions: string[] = [];
  const questionPatterns = [
    /\?\s*$/gm,  // Lines ending with ?
    /^[-*]\s*(.+\?)\s*$/gm,  // Bullet points ending with ?
    /(?:what|how|why|when|where|who|which|should|could|would|can|will|is|are|do|does)\s+[^.!?\n]+\?/gi,
  ];

  for (const result of searchResults) {
    const content = result.note.content;

    for (const pattern of questionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const cleaned = match.replace(/^[-*]\s*/, '').trim();
          if (cleaned.length > 10 && cleaned.length < 200 && !questions.includes(cleaned)) {
            questions.push(cleaned);
          }
        }
      }
    }
  }

  if (questions.length === 0) {
    return '_No open questions found in related notes_';
  }

  // Return top 5 questions
  return questions.slice(0, 5).map(q => `- ${q}`).join('\n');
}

/**
 * Generate content for ai:context placeholder
 * Searches for mentions of company/participants in notes
 */
async function generateContextContent(
  values: TemplateValues,
  notes: Note[]
): Promise<string> {
  const searchTerms: string[] = [];

  // Collect search terms from company and participants
  if (values.company) {
    searchTerms.push(values.company);
  }
  if (values.participants) {
    // Split participants by comma, "and", or semicolon
    const participants = values.participants.split(/[,;&]|\band\b/i).map(p => p.trim()).filter(Boolean);
    searchTerms.push(...participants);
  }
  if (values.title) {
    searchTerms.push(values.title);
  }

  if (searchTerms.length === 0) {
    return '_No context available - add company or participant names_';
  }

  // Search for each term and collect results
  const allResults: { note: Note; excerpt: string; term: string }[] = [];

  for (const term of searchTerms) {
    const results = await searchNotes(term, 3, notes);
    for (const r of results) {
      const excerpt = r.relevantExcerpt ?? r.note.content.slice(0, 150);
      allResults.push({
        note: r.note,
        excerpt: excerpt.trim(),
        term,
      });
    }
  }

  if (allResults.length === 0) {
    return '_No notes found mentioning company or participants_';
  }

  // Deduplicate by note ID
  const seenIds = new Set<string>();
  const uniqueResults = allResults.filter(r => {
    if (seenIds.has(r.note.id)) return false;
    seenIds.add(r.note.id);
    return true;
  });

  // Format with context about what matched
  return uniqueResults.slice(0, 5).map(r => {
    return `- [[${r.note.title}]] (mentions "${r.term}"): ${r.excerpt}...`;
  }).join('\n');
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): Template[] {
  return getTemplates().filter(t => t.category === category);
}

/**
 * Get all unique template categories
 */
export function getTemplateCategories(): string[] {
  const templates = getTemplates();
  const categories = new Set(templates.map(t => t.category).filter(Boolean) as string[]);
  return Array.from(categories).sort();
}

/**
 * Search templates by name or description
 */
export function searchTemplates(query: string): Template[] {
  const queryLower = query.toLowerCase();
  return getTemplates().filter(
    t =>
      t.name.toLowerCase().includes(queryLower) ||
      t.description.toLowerCase().includes(queryLower) ||
      t.tags?.some(tag => tag.toLowerCase().includes(queryLower))
  );
}

/**
 * Convert a NotePattern to a Template
 */
export function patternToTemplate(
  name: string,
  structure: string,
  options?: {
    description?: string;
    tags?: string[];
    titlePrefix?: string;
    category?: string;
  }
): Omit<Template, 'id' | 'createdAt' | 'updatedAt'> {
  // Extract placeholders from structure
  const placeholderRegex = /\{\{(\w+(?::\w+)?)\}\}/g;
  const matches = structure.matchAll(placeholderRegex);
  const placeholderKeys = new Set<string>();

  for (const match of matches) {
    placeholderKeys.add(match[1]);
  }

  const placeholders: Placeholder[] = Array.from(placeholderKeys).map(key => {
    if (key.startsWith('ai:')) {
      return {
        key,
        label: key.replace('ai:', '').replace(/_/g, ' '),
        type: 'ai-fill' as const,
        aiPrompt: `Generate ${key.replace('ai:', '').replace(/_/g, ' ')} based on the topic`,
      };
    }

    if (key === 'date') {
      return {
        key,
        label: 'Date',
        type: 'date' as const,
        required: false,
      };
    }

    return {
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      type: 'text' as const,
      required: key === 'title',
    };
  });

  return {
    name,
    description: options?.description ?? `Template for ${name}`,
    structure,
    placeholders,
    aiEnhanced: placeholders.some(p => p.type === 'ai-fill'),
    tags: options?.tags,
    titlePrefix: options?.titlePrefix,
    category: options?.category,
  };
}

/**
 * Get today's date formatted for templates
 */
export function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

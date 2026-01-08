/**
 * Template Types
 *
 * Types for the template system that enables pattern-based note creation.
 */

export type PlaceholderType = 'text' | 'date' | 'note-reference' | 'ai-fill';

export interface Placeholder {
  key: string;
  label: string;
  type: PlaceholderType;
  required?: boolean;
  defaultValue?: string;
  aiPrompt?: string; // For ai-fill type: prompt to generate content
}

export interface Template {
  id: string;
  name: string;
  description: string;
  structure: string; // Markdown with {{placeholders}}
  placeholders: Placeholder[];
  aiEnhanced: boolean;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[]; // Tags to auto-apply when using template
  titlePrefix?: string; // Optional prefix to add to title (e.g., "Meeting:")
  category?: string; // For organizing templates (e.g., "work", "personal")
}

export interface TemplateValues {
  [key: string]: string;
}

export interface AppliedTemplate {
  title: string;
  content: string;
  tags: string[];
}

// Built-in templates that ship with the app
export interface BuiltInTemplate extends Omit<Template, 'id' | 'createdAt' | 'updatedAt'> {
  builtIn: true;
}

// Template suggestion when user starts typing a matching title
export interface TemplateSuggestion {
  template: Template;
  confidence: number; // 0-1, how confident we are this template matches
  matchedBy: 'title-prefix' | 'keyword' | 'pattern';
}

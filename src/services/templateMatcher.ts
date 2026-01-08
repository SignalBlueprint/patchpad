/**
 * Template Matcher Service
 *
 * Detects when a note title matches a template pattern and suggests
 * using the appropriate template.
 */

import type { Template } from '../types/template';
import { getTemplates } from './templates';

export interface TemplateSuggestion {
  template: Template;
  confidence: number;
  matchType: 'prefix' | 'keyword';
}

/**
 * Extract title prefix (e.g., "Meeting:" from "Meeting: Team Sync")
 */
function extractTitlePrefix(title: string): string | null {
  // Pattern: "Prefix: rest" or "Prefix - rest" or "[Prefix] rest"
  const colonMatch = title.match(/^([A-Za-z]+):\s/);
  if (colonMatch) return colonMatch[1] + ':';

  const dashMatch = title.match(/^([A-Za-z]+)\s+-\s+/);
  if (dashMatch) return dashMatch[1];

  const bracketMatch = title.match(/^\[([A-Za-z]+)\]\s/);
  if (bracketMatch) return bracketMatch[1];

  return null;
}

/**
 * Match a note title against available templates
 * Returns suggestions sorted by confidence
 */
export function matchTitleToTemplate(title: string): TemplateSuggestion[] {
  if (!title || title.trim().length < 3) return [];

  const templates = getTemplates();
  const suggestions: TemplateSuggestion[] = [];
  const titleLower = title.toLowerCase().trim();

  // Check prefix matches first (highest confidence)
  const prefix = extractTitlePrefix(title);
  if (prefix) {
    const prefixLower = prefix.toLowerCase();
    for (const template of templates) {
      if (template.titlePrefix) {
        const templatePrefixLower = template.titlePrefix.toLowerCase().replace(/[:\s]+$/, '');
        const titlePrefixLower = prefixLower.replace(/[:\s]+$/, '');

        if (templatePrefixLower === titlePrefixLower) {
          suggestions.push({
            template,
            confidence: 0.95,
            matchType: 'prefix',
          });
        }
      }
    }
  }

  // Check keyword matches
  for (const template of templates) {
    // Skip if already matched by prefix
    if (suggestions.some(s => s.template.id === template.id)) continue;

    // Keywords from template name
    const nameKeywords = template.name
      .toLowerCase()
      .split(/\s+/)
      .filter(k => k.length > 3);

    // Keywords from title prefix (without the colon)
    const prefixKeywords = template.titlePrefix
      ? [template.titlePrefix.toLowerCase().replace(/[:\s-]+$/, '')]
      : [];

    const allKeywords = [...nameKeywords, ...prefixKeywords];
    let matchCount = 0;

    for (const keyword of allKeywords) {
      if (titleLower.includes(keyword)) {
        matchCount++;
      }
    }

    if (matchCount > 0 && allKeywords.length > 0) {
      const confidence = Math.min(0.8, (matchCount / allKeywords.length) * 0.7 + 0.2);
      if (confidence >= 0.35) {
        suggestions.push({
          template,
          confidence,
          matchType: 'keyword',
        });
      }
    }
  }

  // Sort by confidence (highest first)
  suggestions.sort((a, b) => b.confidence - a.confidence);

  // Return top 3 suggestions
  return suggestions.slice(0, 3);
}

/**
 * Check if a title is likely meant for a specific template
 * Returns the best match if confidence is high enough
 */
export function getBestTemplateMatch(title: string): TemplateSuggestion | null {
  const suggestions = matchTitleToTemplate(title);
  if (suggestions.length === 0) return null;

  // Only return if confidence is reasonably high
  const best = suggestions[0];
  if (best.confidence >= 0.5) {
    return best;
  }

  return null;
}

/**
 * Get keyword triggers for common templates
 * These are words that strongly suggest a particular template
 */
export function getTemplateTriggerKeywords(): Map<string, string> {
  return new Map([
    ['meeting', 'builtin-meeting-notes'],
    ['standup', 'builtin-meeting-notes'],
    ['sync', 'builtin-meeting-notes'],
    ['research', 'builtin-research-notes'],
    ['journal', 'builtin-daily-journal'],
    ['diary', 'builtin-daily-journal'],
    ['project', 'builtin-project-brief'],
    ['book', 'builtin-book-notes'],
    ['reading', 'builtin-book-notes'],
  ]);
}

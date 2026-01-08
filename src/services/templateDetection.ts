/**
 * Template Detection Service
 *
 * Analyzes note patterns to detect common structures and suggest templates.
 */

import { Note } from '../types/note';

// Types for pattern detection
export interface NoteStructure {
  headers: { level: number; text: string }[];
  hasBulletLists: boolean;
  hasNumberedLists: boolean;
  hasCheckboxes: boolean;
  hasCodeBlocks: boolean;
  hasQuotes: boolean;
  hasWikiLinks: boolean;
  contentLength: 'short' | 'medium' | 'long';
  sections: string[]; // Header texts that define sections
}

export interface NotePattern {
  name: string;
  frequency: number;
  structure: NoteStructure;
  exampleNoteIds: string[];
  titlePrefix?: string;
  commonTags?: string[];
  avgContentLength: number;
}

export interface PatternMatch {
  noteId: string;
  patternName: string;
  confidence: number; // 0-1
}

// Types for Phase 1: Pattern Detection Enhancement

export interface TitlePattern {
  prefix: string;
  count: number;
  noteIds: string[];
  format: 'colon' | 'dash' | 'bracket';
}

export interface StructurePattern {
  name: string;
  sections: string[];
  features: {
    hasBulletLists: boolean;
    hasNumberedLists: boolean;
    hasCheckboxes: boolean;
    hasCodeBlocks: boolean;
    hasQuotes: boolean;
  };
  count: number;
  noteIds: string[];
}

export interface TemplateSuggestion {
  title: string;
  description: string;
  templateContent: string;
  confidence: number; // 0-1
  basedOnNotes: number;
  sourcePattern: 'title' | 'structure' | 'combined';
}

/**
 * Extract structural information from note content
 */
export function extractStructure(content: string): NoteStructure {
  const lines = content.split('\n');

  // Extract headers
  const headers: { level: number; text: string }[] = [];
  const headerRegex = /^(#{1,6})\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(headerRegex);
    if (match) {
      headers.push({
        level: match[1].length,
        text: match[2].trim()
      });
    }
  }

  // Detect content features
  const hasBulletLists = /^[\s]*[-*+]\s+/m.test(content);
  const hasNumberedLists = /^[\s]*\d+\.\s+/m.test(content);
  const hasCheckboxes = /^[\s]*[-*+]\s+\[[x\s]\]/mi.test(content);
  const hasCodeBlocks = /```[\s\S]*?```/.test(content) || /`[^`]+`/.test(content);
  const hasQuotes = /^>\s+/m.test(content);
  const hasWikiLinks = /\[\[.+?\]\]/.test(content);

  // Classify content length
  const length = content.length;
  let contentLength: 'short' | 'medium' | 'long';
  if (length < 200) {
    contentLength = 'short';
  } else if (length < 1000) {
    contentLength = 'medium';
  } else {
    contentLength = 'long';
  }

  // Extract section names (H2 headers as main sections)
  const sections = headers
    .filter(h => h.level === 2)
    .map(h => h.text);

  return {
    headers,
    hasBulletLists,
    hasNumberedLists,
    hasCheckboxes,
    hasCodeBlocks,
    hasQuotes,
    hasWikiLinks,
    contentLength,
    sections
  };
}

/**
 * Extract title prefix from note title (e.g., "Meeting:" from "Meeting: Team Sync")
 */
export function extractTitlePrefix(title: string): string | null {
  // Common patterns: "Prefix: Rest", "Prefix - Rest", "[Prefix] Rest"
  const colonMatch = title.match(/^([A-Za-z]+):\s+/);
  if (colonMatch) {
    return colonMatch[1];
  }

  const dashMatch = title.match(/^([A-Za-z]+)\s+-\s+/);
  if (dashMatch) {
    return dashMatch[1];
  }

  const bracketMatch = title.match(/^\[([A-Za-z]+)\]\s+/);
  if (bracketMatch) {
    return bracketMatch[1];
  }

  return null;
}

/**
 * Calculate structure similarity between two notes (0-1)
 */
export function calculateStructureSimilarity(a: NoteStructure, b: NoteStructure): number {
  let matches = 0;
  let total = 0;

  // Compare boolean features
  const booleanFeatures: (keyof NoteStructure)[] = [
    'hasBulletLists', 'hasNumberedLists', 'hasCheckboxes',
    'hasCodeBlocks', 'hasQuotes', 'hasWikiLinks'
  ];

  for (const feature of booleanFeatures) {
    total++;
    if (a[feature] === b[feature]) {
      matches++;
    }
  }

  // Compare content length
  total++;
  if (a.contentLength === b.contentLength) {
    matches++;
  }

  // Compare sections (Jaccard similarity)
  if (a.sections.length > 0 || b.sections.length > 0) {
    total++;
    const aSet = new Set(a.sections.map(s => s.toLowerCase()));
    const bSet = new Set(b.sections.map(s => s.toLowerCase()));
    const intersection = [...aSet].filter(s => bSet.has(s)).length;
    const union = new Set([...aSet, ...bSet]).size;
    matches += union > 0 ? intersection / union : 0;
  }

  return total > 0 ? matches / total : 0;
}

/**
 * Group notes by title prefix
 */
export function groupByTitlePrefix(notes: Note[]): Map<string, Note[]> {
  const groups = new Map<string, Note[]>();

  for (const note of notes) {
    const prefix = extractTitlePrefix(note.title);
    if (prefix) {
      const existing = groups.get(prefix) || [];
      existing.push(note);
      groups.set(prefix, existing);
    }
  }

  return groups;
}

/**
 * Group notes by similar structure
 */
export function groupBySimilarStructure(notes: Note[], threshold: number = 0.7): Note[][] {
  const structures = notes.map(note => ({
    note,
    structure: extractStructure(note.content)
  }));

  const groups: Note[][] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < structures.length; i++) {
    if (assigned.has(structures[i].note.id)) continue;

    const group: Note[] = [structures[i].note];
    assigned.add(structures[i].note.id);

    for (let j = i + 1; j < structures.length; j++) {
      if (assigned.has(structures[j].note.id)) continue;

      const similarity = calculateStructureSimilarity(
        structures[i].structure,
        structures[j].structure
      );

      if (similarity >= threshold) {
        group.push(structures[j].note);
        assigned.add(structures[j].note.id);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Get common tags across a set of notes
 */
export function getCommonTags(notes: Note[]): string[] {
  if (notes.length === 0) return [];

  const tagCounts = new Map<string, number>();

  for (const note of notes) {
    const tags = note.tags || [];
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  // Return tags that appear in at least 50% of notes
  const threshold = notes.length / 2;
  return [...tagCounts.entries()]
    .filter(([_, count]) => count >= threshold)
    .map(([tag]) => tag);
}

/**
 * Create a representative structure from a group of notes
 */
export function createRepresentativeStructure(notes: Note[]): NoteStructure {
  const structures = notes.map(note => extractStructure(note.content));

  // Count occurrences of each feature
  const featureCounts = {
    hasBulletLists: 0,
    hasNumberedLists: 0,
    hasCheckboxes: 0,
    hasCodeBlocks: 0,
    hasQuotes: 0,
    hasWikiLinks: 0,
    short: 0,
    medium: 0,
    long: 0
  };

  const allSections = new Map<string, number>();
  const allHeaders: { level: number; text: string }[] = [];

  for (const structure of structures) {
    if (structure.hasBulletLists) featureCounts.hasBulletLists++;
    if (structure.hasNumberedLists) featureCounts.hasNumberedLists++;
    if (structure.hasCheckboxes) featureCounts.hasCheckboxes++;
    if (structure.hasCodeBlocks) featureCounts.hasCodeBlocks++;
    if (structure.hasQuotes) featureCounts.hasQuotes++;
    if (structure.hasWikiLinks) featureCounts.hasWikiLinks++;
    featureCounts[structure.contentLength]++;

    for (const section of structure.sections) {
      const lower = section.toLowerCase();
      allSections.set(lower, (allSections.get(lower) || 0) + 1);
    }
  }

  const threshold = structures.length / 2;

  // Get most common content length
  let contentLength: 'short' | 'medium' | 'long' = 'medium';
  if (featureCounts.short > featureCounts.medium && featureCounts.short > featureCounts.long) {
    contentLength = 'short';
  } else if (featureCounts.long > featureCounts.medium) {
    contentLength = 'long';
  }

  // Get common sections
  const sections = [...allSections.entries()]
    .filter(([_, count]) => count >= threshold)
    .map(([section]) => section);

  return {
    headers: allHeaders,
    hasBulletLists: featureCounts.hasBulletLists >= threshold,
    hasNumberedLists: featureCounts.hasNumberedLists >= threshold,
    hasCheckboxes: featureCounts.hasCheckboxes >= threshold,
    hasCodeBlocks: featureCounts.hasCodeBlocks >= threshold,
    hasQuotes: featureCounts.hasQuotes >= threshold,
    hasWikiLinks: featureCounts.hasWikiLinks >= threshold,
    contentLength,
    sections
  };
}

/**
 * Detect patterns in notes
 * Returns patterns that appear 3+ times
 */
export function detectPatterns(notes: Note[]): NotePattern[] {
  const patterns: NotePattern[] = [];

  // 1. Group by title prefix
  const prefixGroups = groupByTitlePrefix(notes);

  for (const [prefix, groupNotes] of prefixGroups) {
    if (groupNotes.length >= 3) {
      const structure = createRepresentativeStructure(groupNotes);
      const avgLength = groupNotes.reduce((sum, n) => sum + n.content.length, 0) / groupNotes.length;

      patterns.push({
        name: `${prefix} Notes`,
        frequency: groupNotes.length,
        structure,
        exampleNoteIds: groupNotes.slice(0, 3).map(n => n.id),
        titlePrefix: prefix,
        commonTags: getCommonTags(groupNotes),
        avgContentLength: Math.round(avgLength)
      });
    }
  }

  // 2. Group remaining notes by structure
  const notesWithoutPrefix = notes.filter(n => !extractTitlePrefix(n.title));
  const structureGroups = groupBySimilarStructure(notesWithoutPrefix);

  for (const group of structureGroups) {
    if (group.length >= 3) {
      const structure = createRepresentativeStructure(group);
      const avgLength = group.reduce((sum, n) => sum + n.content.length, 0) / group.length;

      // Generate name based on structure features
      let name = 'General Notes';
      if (structure.hasCheckboxes) {
        name = 'Task Lists';
      } else if (structure.hasCodeBlocks) {
        name = 'Code Snippets';
      } else if (structure.sections.length > 0) {
        name = 'Structured Notes';
      } else if (structure.hasBulletLists) {
        name = 'Bullet Notes';
      } else if (structure.contentLength === 'short') {
        name = 'Quick Notes';
      } else if (structure.contentLength === 'long') {
        name = 'Long-form Notes';
      }

      // Avoid duplicate pattern names
      const existingNames = new Set(patterns.map(p => p.name));
      let finalName = name;
      let counter = 2;
      while (existingNames.has(finalName)) {
        finalName = `${name} ${counter}`;
        counter++;
      }

      patterns.push({
        name: finalName,
        frequency: group.length,
        structure,
        exampleNoteIds: group.slice(0, 3).map(n => n.id),
        commonTags: getCommonTags(group),
        avgContentLength: Math.round(avgLength)
      });
    }
  }

  // Sort by frequency (most common first)
  patterns.sort((a, b) => b.frequency - a.frequency);

  return patterns;
}

/**
 * Generate template markdown from a pattern
 */
export function generateTemplateFromPattern(pattern: NotePattern): string {
  const lines: string[] = [];

  // Add title template
  if (pattern.titlePrefix) {
    lines.push(`# ${pattern.titlePrefix}: {{title}}`);
  } else {
    lines.push('# {{title}}');
  }
  lines.push('');

  const structure = pattern.structure;

  // Add sections if detected
  if (structure.sections.length > 0) {
    for (const section of structure.sections) {
      lines.push(`## ${section}`);
      lines.push('');

      if (structure.hasBulletLists) {
        lines.push('- ');
      } else if (structure.hasCheckboxes) {
        lines.push('- [ ] ');
      }
      lines.push('');
    }
  } else {
    // Generic structure based on features
    if (structure.hasCheckboxes) {
      lines.push('## Tasks');
      lines.push('');
      lines.push('- [ ] Task 1');
      lines.push('- [ ] Task 2');
      lines.push('');
    }

    if (structure.hasBulletLists && !structure.hasCheckboxes) {
      lines.push('## Notes');
      lines.push('');
      lines.push('- ');
      lines.push('');
    }

    if (structure.hasCodeBlocks) {
      lines.push('## Code');
      lines.push('');
      lines.push('```');
      lines.push('');
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Check if a title matches a known pattern
 */
export function matchTitleToPattern(title: string, patterns: NotePattern[]): PatternMatch | null {
  const prefix = extractTitlePrefix(title);

  if (prefix) {
    const matchingPattern = patterns.find(p =>
      p.titlePrefix?.toLowerCase() === prefix.toLowerCase()
    );

    if (matchingPattern) {
      return {
        noteId: '', // Not a note yet
        patternName: matchingPattern.name,
        confidence: 0.9
      };
    }
  }

  // Check for keyword matches in title
  const titleLower = title.toLowerCase();
  const keywordMatches: { pattern: NotePattern; confidence: number }[] = [];

  for (const pattern of patterns) {
    // Check if title contains pattern name keywords
    const patternKeywords = pattern.name.toLowerCase().split(' ');
    let matchCount = 0;

    for (const keyword of patternKeywords) {
      if (titleLower.includes(keyword) && keyword.length > 3) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      keywordMatches.push({
        pattern,
        confidence: matchCount / patternKeywords.length * 0.5
      });
    }
  }

  if (keywordMatches.length > 0) {
    keywordMatches.sort((a, b) => b.confidence - a.confidence);
    const best = keywordMatches[0];

    if (best.confidence >= 0.3) {
      return {
        noteId: '',
        patternName: best.pattern.name,
        confidence: best.confidence
      };
    }
  }

  return null;
}

// =============================================================================
// Phase 1: Pattern Detection Enhancement Functions
// =============================================================================

/**
 * Detect title prefix patterns in notes
 * Returns patterns like "Meeting:", "Research:", "[WIP]"
 */
export function detectTitlePatterns(notes: Note[]): TitlePattern[] {
  const patterns: TitlePattern[] = [];
  const prefixGroups = new Map<string, { noteIds: string[]; format: 'colon' | 'dash' | 'bracket' }>();

  for (const note of notes) {
    const title = note.title;

    // Check colon format: "Prefix: Rest"
    const colonMatch = title.match(/^([A-Za-z]+):\s+/);
    if (colonMatch) {
      const prefix = colonMatch[1];
      const existing = prefixGroups.get(prefix) || { noteIds: [], format: 'colon' as const };
      existing.noteIds.push(note.id);
      prefixGroups.set(prefix, existing);
      continue;
    }

    // Check dash format: "Prefix - Rest"
    const dashMatch = title.match(/^([A-Za-z]+)\s+-\s+/);
    if (dashMatch) {
      const prefix = dashMatch[1];
      const existing = prefixGroups.get(prefix) || { noteIds: [], format: 'dash' as const };
      existing.noteIds.push(note.id);
      prefixGroups.set(prefix, existing);
      continue;
    }

    // Check bracket format: "[Prefix] Rest"
    const bracketMatch = title.match(/^\[([A-Za-z]+)\]\s+/);
    if (bracketMatch) {
      const prefix = bracketMatch[1];
      const existing = prefixGroups.get(prefix) || { noteIds: [], format: 'bracket' as const };
      existing.noteIds.push(note.id);
      prefixGroups.set(prefix, existing);
    }
  }

  // Convert to array, filter by minimum count (3+)
  for (const [prefix, data] of prefixGroups) {
    if (data.noteIds.length >= 3) {
      patterns.push({
        prefix,
        count: data.noteIds.length,
        noteIds: data.noteIds,
        format: data.format
      });
    }
  }

  // Sort by count descending
  patterns.sort((a, b) => b.count - a.count);

  return patterns;
}

/**
 * Detect structure patterns in notes (common header sequences)
 * Returns patterns based on section headers and content features
 */
export function detectStructurePatterns(notes: Note[]): StructurePattern[] {
  const patterns: StructurePattern[] = [];

  // Group notes by their structure signature
  const structureGroups = new Map<string, { noteIds: string[]; structure: NoteStructure }>();

  for (const note of notes) {
    const structure = extractStructure(note.content);

    // Create a signature from the structure
    const sectionsKey = structure.sections.map(s => s.toLowerCase()).sort().join('|');
    const featuresKey = [
      structure.hasBulletLists ? 'b' : '',
      structure.hasNumberedLists ? 'n' : '',
      structure.hasCheckboxes ? 'c' : '',
      structure.hasCodeBlocks ? 'k' : '',
      structure.hasQuotes ? 'q' : ''
    ].filter(Boolean).join('');

    const signature = `${sectionsKey}:${featuresKey}:${structure.contentLength}`;

    const existing = structureGroups.get(signature);
    if (existing) {
      existing.noteIds.push(note.id);
    } else {
      structureGroups.set(signature, { noteIds: [note.id], structure });
    }
  }

  // Convert to patterns (minimum 3 notes)
  for (const [_, data] of structureGroups) {
    if (data.noteIds.length >= 3) {
      const structure = data.structure;

      // Generate name based on structure
      let name = 'General Notes';
      if (structure.sections.length > 0) {
        name = `${structure.sections.slice(0, 2).join(' / ')} Structure`;
      } else if (structure.hasCheckboxes) {
        name = 'Task Lists';
      } else if (structure.hasCodeBlocks) {
        name = 'Code Documentation';
      } else if (structure.hasBulletLists) {
        name = 'Bullet Point Notes';
      } else if (structure.hasNumberedLists) {
        name = 'Sequential Notes';
      } else if (structure.contentLength === 'short') {
        name = 'Quick Notes';
      } else if (structure.contentLength === 'long') {
        name = 'Long-form Content';
      }

      patterns.push({
        name,
        sections: structure.sections,
        features: {
          hasBulletLists: structure.hasBulletLists,
          hasNumberedLists: structure.hasNumberedLists,
          hasCheckboxes: structure.hasCheckboxes,
          hasCodeBlocks: structure.hasCodeBlocks,
          hasQuotes: structure.hasQuotes
        },
        count: data.noteIds.length,
        noteIds: data.noteIds
      });
    }
  }

  // Sort by count descending
  patterns.sort((a, b) => b.count - a.count);

  return patterns;
}

/**
 * Suggest a template based on detected patterns
 * Returns the best template suggestion with confidence score
 */
export function suggestTemplateFromPatterns(
  titlePatterns: TitlePattern[],
  structurePatterns: StructurePattern[]
): TemplateSuggestion | null {
  // Find the strongest pattern
  const allPatterns: { type: 'title' | 'structure'; pattern: TitlePattern | StructurePattern }[] = [
    ...titlePatterns.map(p => ({ type: 'title' as const, pattern: p })),
    ...structurePatterns.map(p => ({ type: 'structure' as const, pattern: p }))
  ];

  if (allPatterns.length === 0) {
    return null;
  }

  // Sort by count
  allPatterns.sort((a, b) => b.pattern.count - a.pattern.count);

  const best = allPatterns[0];
  const count = best.pattern.count;

  // Calculate confidence based on count
  // 3-5 notes: low confidence (0.5-0.6)
  // 6-10 notes: medium confidence (0.7-0.8)
  // 11+ notes: high confidence (0.9)
  let confidence: number;
  if (count <= 5) {
    confidence = 0.5 + (count - 3) * 0.05;
  } else if (count <= 10) {
    confidence = 0.6 + (count - 5) * 0.04;
  } else {
    confidence = 0.9;
  }

  if (best.type === 'title') {
    const titlePattern = best.pattern as TitlePattern;

    // Format prefix based on format type
    let titleTemplate: string;
    switch (titlePattern.format) {
      case 'colon':
        titleTemplate = `${titlePattern.prefix}: {{title}}`;
        break;
      case 'dash':
        titleTemplate = `${titlePattern.prefix} - {{title}}`;
        break;
      case 'bracket':
        titleTemplate = `[${titlePattern.prefix}] {{title}}`;
        break;
    }

    const templateContent = `# ${titleTemplate}

## Overview



## Details



## Notes

- `;

    return {
      title: `${titlePattern.prefix} Template`,
      description: `You have ${count} notes starting with "${titlePattern.prefix}". Create a template for them?`,
      templateContent,
      confidence,
      basedOnNotes: count,
      sourcePattern: 'title'
    };
  } else {
    const structurePattern = best.pattern as StructurePattern;

    // Generate template content
    const lines: string[] = ['# {{title}}', ''];

    if (structurePattern.sections.length > 0) {
      for (const section of structurePattern.sections) {
        lines.push(`## ${section}`);
        lines.push('');
        if (structurePattern.features.hasBulletLists) {
          lines.push('- ');
        } else if (structurePattern.features.hasCheckboxes) {
          lines.push('- [ ] ');
        }
        lines.push('');
      }
    } else {
      if (structurePattern.features.hasCheckboxes) {
        lines.push('## Tasks');
        lines.push('');
        lines.push('- [ ] ');
        lines.push('');
      } else if (structurePattern.features.hasBulletLists) {
        lines.push('## Notes');
        lines.push('');
        lines.push('- ');
        lines.push('');
      } else if (structurePattern.features.hasCodeBlocks) {
        lines.push('## Code');
        lines.push('');
        lines.push('```');
        lines.push('');
        lines.push('```');
        lines.push('');
      }
    }

    return {
      title: structurePattern.name,
      description: `You have ${count} notes with similar structure. Create a template for them?`,
      templateContent: lines.join('\n'),
      confidence,
      basedOnNotes: count,
      sourcePattern: 'structure'
    };
  }
}

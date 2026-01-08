import { describe, it, expect } from 'vitest';
import {
  extractStructure,
  extractTitlePrefix,
  calculateStructureSimilarity,
  groupByTitlePrefix,
  groupBySimilarStructure,
  getCommonTags,
  createRepresentativeStructure,
  detectPatterns,
  generateTemplateFromPattern,
  matchTitleToPattern
} from './templateDetection';
import { Note } from '../types/note';

// Helper to create test notes
function createNote(id: string, title: string, content: string, tags?: string[]): Note {
  return {
    id,
    title,
    content,
    tags,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe('extractStructure', () => {
  it('should detect headers', () => {
    const content = '# Title\n\n## Section 1\n\nContent\n\n### Subsection';
    const structure = extractStructure(content);

    expect(structure.headers).toHaveLength(3);
    expect(structure.headers[0]).toEqual({ level: 1, text: 'Title' });
    expect(structure.headers[1]).toEqual({ level: 2, text: 'Section 1' });
    expect(structure.headers[2]).toEqual({ level: 3, text: 'Subsection' });
  });

  it('should detect bullet lists', () => {
    const content = '- Item 1\n- Item 2\n* Item 3';
    const structure = extractStructure(content);

    expect(structure.hasBulletLists).toBe(true);
    expect(structure.hasNumberedLists).toBe(false);
  });

  it('should detect numbered lists', () => {
    const content = '1. First\n2. Second\n3. Third';
    const structure = extractStructure(content);

    expect(structure.hasNumberedLists).toBe(true);
    expect(structure.hasBulletLists).toBe(false);
  });

  it('should detect checkboxes', () => {
    const content = '- [ ] Todo item\n- [x] Done item';
    const structure = extractStructure(content);

    expect(structure.hasCheckboxes).toBe(true);
    expect(structure.hasBulletLists).toBe(true);
  });

  it('should detect code blocks', () => {
    const content = 'Some text\n\n```javascript\nconst x = 1;\n```\n\nMore text';
    const structure = extractStructure(content);

    expect(structure.hasCodeBlocks).toBe(true);
  });

  it('should detect inline code', () => {
    const content = 'Use the `console.log` function';
    const structure = extractStructure(content);

    expect(structure.hasCodeBlocks).toBe(true);
  });

  it('should detect quotes', () => {
    const content = '> This is a quote\n> Continued quote';
    const structure = extractStructure(content);

    expect(structure.hasQuotes).toBe(true);
  });

  it('should detect wiki links', () => {
    const content = 'See [[Related Note]] for more info';
    const structure = extractStructure(content);

    expect(structure.hasWikiLinks).toBe(true);
  });

  it('should classify short content', () => {
    const content = 'Short note';
    const structure = extractStructure(content);

    expect(structure.contentLength).toBe('short');
  });

  it('should classify medium content', () => {
    const content = 'A'.repeat(500);
    const structure = extractStructure(content);

    expect(structure.contentLength).toBe('medium');
  });

  it('should classify long content', () => {
    const content = 'A'.repeat(1500);
    const structure = extractStructure(content);

    expect(structure.contentLength).toBe('long');
  });

  it('should extract section names from H2 headers', () => {
    const content = '# Main Title\n\n## Introduction\n\n## Methods\n\n## Results';
    const structure = extractStructure(content);

    expect(structure.sections).toEqual(['Introduction', 'Methods', 'Results']);
  });
});

describe('extractTitlePrefix', () => {
  it('should extract colon prefix', () => {
    expect(extractTitlePrefix('Meeting: Team Sync')).toBe('Meeting');
    expect(extractTitlePrefix('Research: AI Models')).toBe('Research');
  });

  it('should extract dash prefix', () => {
    expect(extractTitlePrefix('Project - Website Redesign')).toBe('Project');
  });

  it('should extract bracket prefix', () => {
    expect(extractTitlePrefix('[WIP] Feature implementation')).toBe('WIP');
  });

  it('should return null for titles without prefix', () => {
    expect(extractTitlePrefix('Simple title')).toBeNull();
    expect(extractTitlePrefix('Another note')).toBeNull();
  });
});

describe('calculateStructureSimilarity', () => {
  it('should return 1 for identical structures', () => {
    const structure = extractStructure('- Item 1\n- Item 2');
    expect(calculateStructureSimilarity(structure, structure)).toBe(1);
  });

  it('should return high similarity for similar structures', () => {
    const a = extractStructure('- Item 1\n- Item 2');
    const b = extractStructure('- Different item\n- Another one');

    expect(calculateStructureSimilarity(a, b)).toBeGreaterThan(0.8);
  });

  it('should return low similarity for different structures', () => {
    const a = extractStructure('- [ ] Task 1\n- [ ] Task 2');
    const b = extractStructure('```code\nblock\n```\n\n> quote');

    expect(calculateStructureSimilarity(a, b)).toBeLessThan(0.5);
  });
});

describe('groupByTitlePrefix', () => {
  it('should group notes by title prefix', () => {
    const notes = [
      createNote('1', 'Meeting: Monday standup', 'content'),
      createNote('2', 'Meeting: Friday review', 'content'),
      createNote('3', 'Research: Machine learning', 'content'),
      createNote('4', 'Simple note', 'content')
    ];

    const groups = groupByTitlePrefix(notes);

    expect(groups.get('Meeting')?.length).toBe(2);
    expect(groups.get('Research')?.length).toBe(1);
    expect(groups.has('Simple')).toBe(false);
  });
});

describe('groupBySimilarStructure', () => {
  it('should group notes with similar structure', () => {
    const notes = [
      createNote('1', 'Note 1', '- Item 1\n- Item 2'),
      createNote('2', 'Note 2', '- Thing A\n- Thing B'),
      createNote('3', 'Note 3', '```code\nblock\n```'),
    ];

    const groups = groupBySimilarStructure(notes, 0.6);

    // Notes 1 and 2 should be grouped together
    const bulletGroup = groups.find(g => g.some(n => n.id === '1'));
    expect(bulletGroup).toBeDefined();
    expect(bulletGroup?.some(n => n.id === '2')).toBe(true);
  });
});

describe('getCommonTags', () => {
  it('should return tags appearing in majority of notes', () => {
    const notes = [
      createNote('1', 'Note 1', 'content', ['work', 'meeting']),
      createNote('2', 'Note 2', 'content', ['work', 'project']),
      createNote('3', 'Note 3', 'content', ['work']),
    ];

    const commonTags = getCommonTags(notes);

    expect(commonTags).toContain('work');
    expect(commonTags).not.toContain('meeting');
    expect(commonTags).not.toContain('project');
  });

  it('should return empty array for notes without common tags', () => {
    const notes = [
      createNote('1', 'Note 1', 'content', ['tag1']),
      createNote('2', 'Note 2', 'content', ['tag2']),
      createNote('3', 'Note 3', 'content', ['tag3']),
    ];

    const commonTags = getCommonTags(notes);

    expect(commonTags).toHaveLength(0);
  });
});

describe('createRepresentativeStructure', () => {
  it('should create structure representing common features', () => {
    const notes = [
      createNote('1', 'Note 1', '## Section A\n\n- Item'),
      createNote('2', 'Note 2', '## Section A\n\n- Thing'),
      createNote('3', 'Note 3', '## Section A\n\n## Section B\n\n- Stuff'),
    ];

    const structure = createRepresentativeStructure(notes);

    expect(structure.hasBulletLists).toBe(true);
    expect(structure.sections).toContain('section a');
  });
});

describe('detectPatterns', () => {
  it('should detect patterns from title prefixes', () => {
    const notes = [
      createNote('1', 'Meeting: Monday standup', '## Attendees\n\n## Agenda'),
      createNote('2', 'Meeting: Tuesday sync', '## Attendees\n\n## Agenda'),
      createNote('3', 'Meeting: Friday review', '## Attendees\n\n## Agenda'),
      createNote('4', 'Random note', 'Some content'),
    ];

    const patterns = detectPatterns(notes);

    expect(patterns.length).toBeGreaterThan(0);
    const meetingPattern = patterns.find(p => p.name === 'Meeting Notes');
    expect(meetingPattern).toBeDefined();
    expect(meetingPattern?.frequency).toBe(3);
    expect(meetingPattern?.titlePrefix).toBe('Meeting');
  });

  it('should detect patterns from structure similarity', () => {
    const notes = [
      createNote('1', 'Tasks for today', '- [ ] Task 1\n- [ ] Task 2'),
      createNote('2', 'Weekly todos', '- [ ] Item A\n- [ ] Item B'),
      createNote('3', 'Project checklist', '- [ ] Step 1\n- [ ] Step 2'),
      createNote('4', 'Ideas', 'Just some thoughts'),
    ];

    const patterns = detectPatterns(notes);

    expect(patterns.length).toBeGreaterThan(0);
    const taskPattern = patterns.find(p => p.name === 'Task Lists');
    expect(taskPattern).toBeDefined();
    expect(taskPattern?.structure.hasCheckboxes).toBe(true);
  });

  it('should require minimum 3 notes for a pattern', () => {
    const notes = [
      createNote('1', 'Meeting: Monday', 'content'),
      createNote('2', 'Meeting: Tuesday', 'content'),
      createNote('3', 'Random note', 'content'),
    ];

    const patterns = detectPatterns(notes);

    // Meeting pattern should not be detected (only 2 notes)
    const meetingPattern = patterns.find(p => p.titlePrefix === 'Meeting');
    expect(meetingPattern).toBeUndefined();
  });

  it('should sort patterns by frequency', () => {
    const notes = [
      createNote('1', 'Meeting: A', 'content'),
      createNote('2', 'Meeting: B', 'content'),
      createNote('3', 'Meeting: C', 'content'),
      createNote('4', 'Meeting: D', 'content'),
      createNote('5', 'Research: A', 'content'),
      createNote('6', 'Research: B', 'content'),
      createNote('7', 'Research: C', 'content'),
    ];

    const patterns = detectPatterns(notes);

    if (patterns.length >= 2) {
      expect(patterns[0].frequency).toBeGreaterThanOrEqual(patterns[1].frequency);
    }
  });
});

describe('generateTemplateFromPattern', () => {
  it('should generate template with title prefix', () => {
    const pattern = detectPatterns([
      createNote('1', 'Meeting: A', '## Attendees\n\n## Notes'),
      createNote('2', 'Meeting: B', '## Attendees\n\n## Notes'),
      createNote('3', 'Meeting: C', '## Attendees\n\n## Notes'),
    ])[0];

    const template = generateTemplateFromPattern(pattern);

    expect(template).toContain('Meeting: {{title}}');
  });

  it('should include sections in template', () => {
    const pattern = detectPatterns([
      createNote('1', 'Meeting: A', '## Attendees\n\n## Agenda'),
      createNote('2', 'Meeting: B', '## Attendees\n\n## Agenda'),
      createNote('3', 'Meeting: C', '## Attendees\n\n## Agenda'),
    ])[0];

    const template = generateTemplateFromPattern(pattern);

    expect(template).toContain('## attendees');
    expect(template).toContain('## agenda');
  });

  it('should generate checkbox template for task patterns', () => {
    const pattern = detectPatterns([
      createNote('1', 'Todo A', '- [ ] Task 1'),
      createNote('2', 'Todo B', '- [ ] Task 2'),
      createNote('3', 'Todo C', '- [ ] Task 3'),
    ])[0];

    const template = generateTemplateFromPattern(pattern);

    expect(template).toContain('- [ ]');
  });
});

describe('matchTitleToPattern', () => {
  it('should match title to pattern by prefix', () => {
    const patterns = detectPatterns([
      createNote('1', 'Meeting: A', 'content'),
      createNote('2', 'Meeting: B', 'content'),
      createNote('3', 'Meeting: C', 'content'),
    ]);

    const match = matchTitleToPattern('Meeting: New team sync', patterns);

    expect(match).toBeDefined();
    expect(match?.patternName).toBe('Meeting Notes');
    expect(match?.confidence).toBeGreaterThan(0.8);
  });

  it('should return null for non-matching titles', () => {
    const patterns = detectPatterns([
      createNote('1', 'Meeting: A', 'content'),
      createNote('2', 'Meeting: B', 'content'),
      createNote('3', 'Meeting: C', 'content'),
    ]);

    const match = matchTitleToPattern('Random thoughts', patterns);

    expect(match).toBeNull();
  });
});

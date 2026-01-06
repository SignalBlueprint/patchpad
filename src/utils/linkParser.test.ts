import { describe, it, expect } from 'vitest';
import {
  parseWikiLinks,
  findNoteByTitle,
  searchNotesByTitle,
  generateWikiLink,
  getWikiLinkDisplayText,
  getWikiLinkAtPosition,
  getWikiLinkTypingState,
  completeWikiLink,
  getBacklinks,
  updateLinksOnRename,
  findBrokenLinks,
} from './linkParser';
import type { Note } from '../types/note';

const createMockNote = (id: string, title: string, content: string = ''): Note => ({
  id,
  title,
  content,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('parseWikiLinks', () => {
  it('should parse simple wiki links', () => {
    const content = 'Check out [[My Note]] for more info.';
    const links = parseWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0].targetTitle).toBe('My Note');
    expect(links[0].from).toBe(10);
    expect(links[0].to).toBe(21);
    expect(links[0].displayText).toBeUndefined();
  });

  it('should parse wiki links with display text', () => {
    const content = 'See [[Target Note|click here]] for details.';
    const links = parseWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0].targetTitle).toBe('Target Note');
    expect(links[0].displayText).toBe('click here');
  });

  it('should parse multiple wiki links', () => {
    const content = 'Links to [[Note A]] and [[Note B]] and [[Note C]].';
    const links = parseWikiLinks(content);

    expect(links).toHaveLength(3);
    expect(links.map(l => l.targetTitle)).toEqual(['Note A', 'Note B', 'Note C']);
  });

  it('should return empty array for no links', () => {
    const content = 'No links here.';
    const links = parseWikiLinks(content);

    expect(links).toHaveLength(0);
  });

  it('should handle whitespace in titles', () => {
    const content = '[[  Trimmed Title  ]]';
    const links = parseWikiLinks(content);

    expect(links[0].targetTitle).toBe('Trimmed Title');
  });
});

describe('findNoteByTitle', () => {
  const notes = [
    createMockNote('1', 'My First Note'),
    createMockNote('2', 'Another Note'),
    createMockNote('3', 'Testing Guide'),
  ];

  it('should find exact match (case-insensitive)', () => {
    const found = findNoteByTitle('my first note', notes);
    expect(found?.id).toBe('1');
  });

  it('should find starts-with match', () => {
    const found = findNoteByTitle('Another', notes);
    expect(found?.id).toBe('2');
  });

  it('should find contains match', () => {
    const found = findNoteByTitle('Guide', notes);
    expect(found?.id).toBe('3');
  });

  it('should return null for no match', () => {
    const found = findNoteByTitle('Nonexistent', notes);
    expect(found).toBeNull();
  });
});

describe('searchNotesByTitle', () => {
  const notes = [
    createMockNote('1', 'JavaScript Guide'),
    createMockNote('2', 'TypeScript Tutorial'),
    createMockNote('3', 'Python Basics'),
  ];

  it('should search notes by query', () => {
    const results = searchNotesByTitle('script', notes);
    expect(results).toHaveLength(2);
    expect(results.map(n => n.id)).toContain('1');
    expect(results.map(n => n.id)).toContain('2');
  });

  it('should prioritize exact matches', () => {
    const results = searchNotesByTitle('JavaScript Guide', notes);
    expect(results[0].id).toBe('1');
  });

  it('should return recent notes when query is empty', () => {
    const results = searchNotesByTitle('', notes);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('generateWikiLink', () => {
  it('should generate simple link', () => {
    expect(generateWikiLink('My Note')).toBe('[[My Note]]');
  });

  it('should generate link with display text', () => {
    expect(generateWikiLink('My Note', 'click here')).toBe('[[My Note|click here]]');
  });

  it('should not add display text if same as title', () => {
    expect(generateWikiLink('My Note', 'My Note')).toBe('[[My Note]]');
  });
});

describe('getWikiLinkDisplayText', () => {
  it('should return display text if present', () => {
    const link = parseWikiLinks('[[Note|Display]]')[0];
    expect(getWikiLinkDisplayText(link)).toBe('Display');
  });

  it('should return target title if no display text', () => {
    const link = parseWikiLinks('[[Note]]')[0];
    expect(getWikiLinkDisplayText(link)).toBe('Note');
  });
});

describe('getWikiLinkAtPosition', () => {
  const content = 'Start [[Link]] end';

  it('should return link when cursor is inside', () => {
    const link = getWikiLinkAtPosition(content, 8);
    expect(link).not.toBeNull();
    expect(link?.targetTitle).toBe('Link');
  });

  it('should return null when cursor is outside', () => {
    const link = getWikiLinkAtPosition(content, 2);
    expect(link).toBeNull();
  });
});

describe('getWikiLinkTypingState', () => {
  it('should detect typing state after [[', () => {
    const content = 'Text [[my qu';
    const state = getWikiLinkTypingState(content, 12);

    expect(state).not.toBeNull();
    expect(state?.query).toBe('my qu');
    expect(state?.startPosition).toBe(5);
  });

  it('should return null when not typing a link', () => {
    const content = 'Regular text';
    const state = getWikiLinkTypingState(content, 12);

    expect(state).toBeNull();
  });

  it('should return null after link is closed', () => {
    const content = 'Text [[Link]] more';
    const state = getWikiLinkTypingState(content, 15);

    expect(state).toBeNull();
  });
});

describe('completeWikiLink', () => {
  it('should complete a wiki link', () => {
    const content = 'Text [[my qu';
    const result = completeWikiLink(content, 5, 12, 'My Query Note');

    expect(result.content).toBe('Text [[My Query Note]]');
    expect(result.cursorPosition).toBe(22);
  });
});

describe('getBacklinks', () => {
  const targetNote = createMockNote('target', 'Target Note', 'Target content');
  const allNotes = [
    targetNote,
    createMockNote('source1', 'Source One', 'Links to [[Target Note]] here.'),
    createMockNote('source2', 'Source Two', 'No links here.'),
    createMockNote('source3', 'Source Three', 'Also [[Target Note]] mentioned.'),
  ];

  it('should find backlinks to target note', () => {
    const backlinks = getBacklinks('target', 'Target Note', allNotes);

    expect(backlinks).toHaveLength(2);
    expect(backlinks.map(b => b.sourceNoteId)).toContain('source1');
    expect(backlinks.map(b => b.sourceNoteId)).toContain('source3');
  });

  it('should include context around the link', () => {
    const backlinks = getBacklinks('target', 'Target Note', allNotes);
    const sourceOneBacklink = backlinks.find(b => b.sourceNoteId === 'source1');

    expect(sourceOneBacklink?.context).toContain('[[Target Note]]');
  });

  it('should not include self as backlink', () => {
    const backlinks = getBacklinks('target', 'Target Note', allNotes);
    expect(backlinks.some(b => b.sourceNoteId === 'target')).toBe(false);
  });
});

describe('updateLinksOnRename', () => {
  it('should update wiki links when note is renamed', () => {
    const content = 'Links to [[Old Title]] and more [[Old Title]] here.';
    const updated = updateLinksOnRename('Old Title', 'New Title', content);

    expect(updated).toBe('Links to [[New Title]] and more [[New Title]] here.');
  });

  it('should preserve display text', () => {
    const content = 'See [[Old Title|custom text]] for info.';
    const updated = updateLinksOnRename('Old Title', 'New Title', content);

    expect(updated).toBe('See [[New Title|custom text]] for info.');
  });

  it('should not change unrelated links', () => {
    const content = 'Links to [[Other Note]] stay unchanged.';
    const updated = updateLinksOnRename('Old Title', 'New Title', content);

    expect(updated).toBe(content);
  });
});

describe('findBrokenLinks', () => {
  const notes = [
    createMockNote('1', 'Existing Note'),
    createMockNote('2', 'Another Note'),
  ];

  it('should find broken links', () => {
    const content = '[[Existing Note]] and [[Broken Link]] and [[Another Note]]';
    const broken = findBrokenLinks(content, notes);

    expect(broken).toHaveLength(1);
    expect(broken[0].targetTitle).toBe('Broken Link');
  });

  it('should return empty array when all links valid', () => {
    const content = '[[Existing Note]] and [[Another Note]]';
    const broken = findBrokenLinks(content, notes);

    expect(broken).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import { generatePatch, generateStitch, analyzeContent } from './patch';
import type { Note } from '../types/note';

describe('generatePatch', () => {
  describe('summarize action', () => {
    it('generates summary for content with multiple lines', async () => {
      const result = await generatePatch({
        noteId: 'test-id',
        content: 'Line 1\nLine 2\nLine 3\nLine 4',
        action: 'summarize',
      });

      expect(result.rationale).toContain('4 lines');
      expect(result.ops).toHaveLength(1);
      expect(result.ops[0].type).toBe('insert');
      expect(result.ops[0].text).toContain('Summary');
    });

    it('generates brief summary for short content', async () => {
      const result = await generatePatch({
        noteId: 'test-id',
        content: 'Short note',
        action: 'summarize',
      });

      expect(result.ops[0].text).toContain('Brief note');
    });
  });

  describe('extract-tasks action', () => {
    it('extracts tasks from content with TODO keywords', async () => {
      const result = await generatePatch({
        noteId: 'test-id',
        content: 'Meeting notes\nTODO: Send email\nNeed to review docs',
        action: 'extract-tasks',
      });

      expect(result.rationale).toContain('task');
      expect(result.ops[0].text).toContain('Tasks');
      expect(result.ops[0].text).toContain('[ ]');
    });

    it('adds placeholder tasks when no tasks found', async () => {
      const result = await generatePatch({
        noteId: 'test-id',
        content: 'Just some random notes without any tasks',
        action: 'extract-tasks',
      });

      expect(result.rationale).toContain('placeholder');
      expect(result.ops[0].text).toContain('Review this note');
    });
  });

  describe('rewrite action', () => {
    it('cleans up whitespace', async () => {
      const result = await generatePatch({
        noteId: 'test-id',
        content: 'Line 1  \n\n\n\nLine 2',
        action: 'rewrite',
      });

      expect(result.rationale).toContain('whitespace');
      expect(result.ops[0].type).toBe('replace');
    });

    it('returns empty ops for already clean content', async () => {
      const result = await generatePatch({
        noteId: 'test-id',
        content: 'Clean content',
        action: 'rewrite',
      });

      expect(result.rationale).toContain('well-formatted');
      expect(result.ops).toHaveLength(0);
    });
  });

  describe('title-tags action', () => {
    it('converts first line to heading if not already', async () => {
      const result = await generatePatch({
        noteId: 'test-id',
        content: 'My Title\nSome content here',
        action: 'title-tags',
      });

      expect(result.ops.some((op) => op.text?.includes('# My Title'))).toBe(true);
    });

    it('adds tags based on content', async () => {
      const result = await generatePatch({
        noteId: 'test-id',
        content: '# Already a Title\nThis content has project and design mentioned multiple times. Project design project.',
        action: 'title-tags',
      });

      expect(result.ops.some((op) => op.text?.includes('Tags:'))).toBe(true);
    });
  });
});

describe('generateStitch', () => {
  const createMockNote = (id: string, title: string, content: string): Note => ({
    id,
    title,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('combines multiple notes into compiled document', async () => {
    const notes = [
      createMockNote('1', 'Note One', 'Content of note one'),
      createMockNote('2', 'Note Two', 'Content of note two'),
    ];

    const result = await generateStitch({ notes });

    expect(result.rationale).toContain('2 sections');
    expect(result.content).toContain('Compiled Document');
    expect(result.content).toContain('Table of Contents');
    expect(result.content).toContain('Note One');
    expect(result.content).toContain('Note Two');
    expect(result.content).toContain('Content of note one');
    expect(result.content).toContain('Content of note two');
  });

  it('includes word count in summary', async () => {
    const notes = [
      createMockNote('1', 'Test', 'One two three four five'),
    ];

    const result = await generateStitch({ notes });

    expect(result.rationale).toContain('word count');
    expect(result.content).toContain('Summary');
  });

  it('handles empty notes', async () => {
    const notes = [
      createMockNote('1', 'Empty Note', ''),
    ];

    const result = await generateStitch({ notes });

    expect(result.content).toContain('Empty note');
  });
});

describe('analyzeContent', () => {
  it('returns null for content that matches previous hash', async () => {
    const content = 'Test content for analysis';
    const result1 = await analyzeContent(content);
    expect(result1).not.toBeNull();

    // Same content with same hash should return null
    const result2 = await analyzeContent(content, result1!.contentHash);
    expect(result2).toBeNull();
  });

  it('returns empty suggestions for very short content', async () => {
    const result = await analyzeContent('Hi');
    expect(result).not.toBeNull();
    expect(result!.suggestions).toHaveLength(0);
  });

  it('suggests title-tags when first line is not a heading', async () => {
    const content = 'My Note Title\n\nSome content here about projects and design.';
    const result = await analyzeContent(content);

    expect(result).not.toBeNull();
    const titleSuggestion = result!.suggestions.find(s => s.action === 'title-tags');
    expect(titleSuggestion).toBeDefined();
    expect(titleSuggestion!.ops[0].text).toContain('# My Note Title');
  });

  it('suggests extracting tasks when TODO patterns found', async () => {
    const content = '# Meeting Notes\n\nTODO: Review the design\nWe need to fix the bug';
    const result = await analyzeContent(content);

    expect(result).not.toBeNull();
    const taskSuggestion = result!.suggestions.find(s => s.action === 'extract-tasks');
    expect(taskSuggestion).toBeDefined();
    expect(taskSuggestion!.rationale).toContain('task');
  });

  it('suggests rewrite for content with extra whitespace', async () => {
    const content = '# Title\n\n\n\n\nContent with extra spaces  ';
    const result = await analyzeContent(content);

    expect(result).not.toBeNull();
    const rewriteSuggestion = result!.suggestions.find(s => s.action === 'rewrite');
    expect(rewriteSuggestion).toBeDefined();
  });

  it('suggests summary for long content', async () => {
    const content = '# Long Note\n\n' +
      'Line one with some words.\n'.repeat(10) +
      'This is additional content to make it longer.';
    const result = await analyzeContent(content);

    expect(result).not.toBeNull();
    const summarySuggestion = result!.suggestions.find(s => s.action === 'summarize');
    expect(summarySuggestion).toBeDefined();
  });

  it('returns content hash for deduplication', async () => {
    const content = 'Test content';
    const result = await analyzeContent(content);

    expect(result).not.toBeNull();
    expect(result!.contentHash).toBeDefined();
    expect(typeof result!.contentHash).toBe('string');
  });
});

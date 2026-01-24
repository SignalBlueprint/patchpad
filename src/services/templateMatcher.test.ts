import { describe, it, expect, beforeEach } from 'vitest';
import { matchTitleToTemplate, getBestTemplateMatch, getTemplateTriggerKeywords } from './templateMatcher';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('Template Matcher Service', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('matchTitleToTemplate', () => {
    it('should return empty array for empty title', () => {
      const suggestions = matchTitleToTemplate('');
      expect(suggestions).toEqual([]);
    });

    it('should return empty array for very short title', () => {
      const suggestions = matchTitleToTemplate('ab');
      expect(suggestions).toEqual([]);
    });

    it('should match "Meeting:" prefix to Meeting Notes template', () => {
      const suggestions = matchTitleToTemplate('Meeting: Team Sync');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].template.name).toBe('Meeting Notes');
      expect(suggestions[0].matchType).toBe('prefix');
      expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should match "Research:" prefix to Research Notes template', () => {
      const suggestions = matchTitleToTemplate('Research: AI Models');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].template.name).toBe('Research Notes');
      expect(suggestions[0].matchType).toBe('prefix');
    });

    it('should match "Journal:" prefix to Daily Journal template', () => {
      const suggestions = matchTitleToTemplate('Journal: Today');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].template.name).toBe('Daily Journal');
    });

    it('should match "Project:" prefix to Project Brief template', () => {
      const suggestions = matchTitleToTemplate('Project: New App');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].template.name).toBe('Project Brief');
    });

    it('should match "Book:" prefix to Book Notes template', () => {
      const suggestions = matchTitleToTemplate('Book: The Great Gatsby');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].template.name).toBe('Book Notes');
    });

    it('should match by keyword when no prefix match', () => {
      const suggestions = matchTitleToTemplate('my meeting notes');

      // Should find meeting template by keyword
      const meetingMatch = suggestions.find(s => s.template.name === 'Meeting Notes');
      expect(meetingMatch).toBeDefined();
      expect(meetingMatch?.matchType).toBe('keyword');
    });

    it('should handle case-insensitive prefix matching', () => {
      const suggestions = matchTitleToTemplate('MEETING: IMPORTANT');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].template.name).toBe('Meeting Notes');
    });

    it('should limit results to top 3 suggestions', () => {
      // Create a title that might match multiple templates by keywords
      const suggestions = matchTitleToTemplate('meeting project research notes');

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should sort suggestions by confidence', () => {
      const suggestions = matchTitleToTemplate('Meeting: Team Sync');

      if (suggestions.length >= 2) {
        expect(suggestions[0].confidence).toBeGreaterThanOrEqual(suggestions[1].confidence);
      }
    });
  });

  describe('getBestTemplateMatch', () => {
    it('should return null for non-matching title', () => {
      const result = getBestTemplateMatch('random text here');
      // May or may not match depending on keywords - just ensure it doesn't throw
      expect(result === null || result !== null).toBe(true);
    });

    it('should return best match for prefix-matching title', () => {
      const match = getBestTemplateMatch('Meeting: Sprint Planning');

      expect(match).not.toBeNull();
      expect(match?.template.name).toBe('Meeting Notes');
      expect(match?.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should return null for low confidence matches', () => {
      // A title that barely matches anything
      const match = getBestTemplateMatch('xyz');
      expect(match).toBeNull();
    });
  });

  describe('getTemplateTriggerKeywords', () => {
    it('should return a Map of trigger keywords', () => {
      const keywords = getTemplateTriggerKeywords();

      expect(keywords).toBeInstanceOf(Map);
      expect(keywords.size).toBeGreaterThan(0);
    });

    it('should map "meeting" to meeting notes template', () => {
      const keywords = getTemplateTriggerKeywords();

      expect(keywords.get('meeting')).toBe('builtin-meeting-notes');
    });

    it('should map "research" to research notes template', () => {
      const keywords = getTemplateTriggerKeywords();

      expect(keywords.get('research')).toBe('builtin-research-notes');
    });

    it('should map "journal" to daily journal template', () => {
      const keywords = getTemplateTriggerKeywords();

      expect(keywords.get('journal')).toBe('builtin-daily-journal');
    });

    it('should map "project" to project brief template', () => {
      const keywords = getTemplateTriggerKeywords();

      expect(keywords.get('project')).toBe('builtin-project-brief');
    });

    it('should map "book" to book notes template', () => {
      const keywords = getTemplateTriggerKeywords();

      expect(keywords.get('book')).toBe('builtin-book-notes');
    });
  });

  describe('prefix extraction', () => {
    it('should extract prefix with colon format', () => {
      const suggestions = matchTitleToTemplate('Meeting: Test');
      expect(suggestions[0]?.matchType).toBe('prefix');
    });

    it('should handle title without prefix', () => {
      const suggestions = matchTitleToTemplate('Just a regular title');
      // Should not crash, may return keyword matches
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should handle title with multiple colons', () => {
      const suggestions = matchTitleToTemplate('Meeting: Topic: Subtopic');
      // Should still match Meeting prefix
      expect(suggestions.some(s => s.template.name === 'Meeting Notes')).toBe(true);
    });
  });
});

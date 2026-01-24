/**
 * Tests for brain.ts
 * Knowledge extraction and concept mapping
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  searchConcepts,
  getConceptsForNote,
  getNotesForConcept,
  findConceptMatches,
  type KnowledgeGraph,
  type Concept,
  type ConceptType,
} from './brain';
import type { Note } from '../types/note';

describe('brain', () => {
  const createNote = (id: string, title: string, content: string): Note => ({
    id,
    title,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createConcept = (
    id: string,
    name: string,
    type: ConceptType,
    noteIds: string[]
  ): Concept => ({
    id,
    name,
    type,
    mentions: noteIds.map(noteId => ({
      noteId,
      noteTitle: `Note ${noteId}`,
      context: `Context for ${name}`,
      position: 0,
    })),
    relatedConcepts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createGraph = (concepts: Concept[]): KnowledgeGraph => ({
    concepts,
    relationships: [],
    lastUpdated: new Date(),
  });

  describe('searchConcepts', () => {
    it('should find concepts by name (case-insensitive)', () => {
      const graph = createGraph([
        createConcept('1', 'JavaScript', 'topic', ['note1']),
        createConcept('2', 'Python', 'topic', ['note2']),
        createConcept('3', 'TypeScript', 'topic', ['note3']),
      ]);

      const results = searchConcepts(graph, 'script');

      expect(results).toHaveLength(2);
      expect(results.map(c => c.name)).toContain('JavaScript');
      expect(results.map(c => c.name)).toContain('TypeScript');
    });

    it('should filter by concept type', () => {
      const graph = createGraph([
        createConcept('1', 'John Doe', 'person', ['note1']),
        createConcept('2', 'Acme Corp', 'organization', ['note2']),
        createConcept('3', 'Jane Smith', 'person', ['note3']),
      ]);

      const results = searchConcepts(graph, '', 'person');

      expect(results).toHaveLength(2);
      expect(results.every(c => c.type === 'person')).toBe(true);
    });

    it('should combine name and type filters', () => {
      const graph = createGraph([
        createConcept('1', 'Project Alpha', 'project', ['note1']),
        createConcept('2', 'Project Beta', 'project', ['note2']),
        createConcept('3', 'Alpha Company', 'organization', ['note3']),
      ]);

      const results = searchConcepts(graph, 'alpha', 'project');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Project Alpha');
    });

    it('should return empty array when no matches', () => {
      const graph = createGraph([
        createConcept('1', 'JavaScript', 'topic', ['note1']),
      ]);

      const results = searchConcepts(graph, 'nonexistent');

      expect(results).toEqual([]);
    });

    it('should handle empty query', () => {
      const graph = createGraph([
        createConcept('1', 'JavaScript', 'topic', ['note1']),
        createConcept('2', 'Python', 'topic', ['note2']),
      ]);

      const results = searchConcepts(graph, '');

      expect(results).toHaveLength(2);
    });
  });

  describe('getConceptsForNote', () => {
    it('should return all concepts mentioned in a note', () => {
      const graph = createGraph([
        createConcept('1', 'JavaScript', 'topic', ['note1', 'note2']),
        createConcept('2', 'Python', 'topic', ['note2']),
        createConcept('3', 'TypeScript', 'topic', ['note1', 'note3']),
      ]);

      const results = getConceptsForNote(graph, 'note1');

      expect(results).toHaveLength(2);
      expect(results.map(c => c.name)).toContain('JavaScript');
      expect(results.map(c => c.name)).toContain('TypeScript');
    });

    it('should return empty array for note with no concepts', () => {
      const graph = createGraph([
        createConcept('1', 'JavaScript', 'topic', ['note1']),
      ]);

      const results = getConceptsForNote(graph, 'note2');

      expect(results).toEqual([]);
    });

    it('should return empty array for non-existent note', () => {
      const graph = createGraph([
        createConcept('1', 'JavaScript', 'topic', ['note1']),
      ]);

      const results = getConceptsForNote(graph, 'nonexistent');

      expect(results).toEqual([]);
    });
  });

  describe('getNotesForConcept', () => {
    it('should return unique note IDs for a concept', () => {
      const concept = createConcept('1', 'JavaScript', 'topic', ['note1', 'note2', 'note3']);

      const noteIds = getNotesForConcept(concept);

      expect(noteIds).toHaveLength(3);
      expect(noteIds).toContain('note1');
      expect(noteIds).toContain('note2');
      expect(noteIds).toContain('note3');
    });

    it('should handle concept with duplicate note references', () => {
      const concept: Concept = {
        id: '1',
        name: 'JavaScript',
        type: 'topic',
        mentions: [
          { noteId: 'note1', noteTitle: 'Note 1', context: 'Context 1', position: 0 },
          { noteId: 'note1', noteTitle: 'Note 1', context: 'Context 2', position: 10 },
          { noteId: 'note2', noteTitle: 'Note 2', context: 'Context 3', position: 0 },
        ],
        relatedConcepts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const noteIds = getNotesForConcept(concept);

      // Should deduplicate note IDs
      expect(noteIds).toHaveLength(2);
      expect(noteIds).toContain('note1');
      expect(noteIds).toContain('note2');
    });

    it('should return empty array for concept with no mentions', () => {
      const concept: Concept = {
        id: '1',
        name: 'Unused Concept',
        type: 'topic',
        mentions: [],
        relatedConcepts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const noteIds = getNotesForConcept(concept);

      expect(noteIds).toEqual([]);
    });
  });

  describe('findConceptMatches', () => {
    it('should find concept matches in text', () => {
      const concepts = [
        createConcept('1', 'JavaScript', 'topic', []),
        createConcept('2', 'TypeScript', 'topic', []),
      ];

      const text = 'I love JavaScript and TypeScript for web development.';
      const matches = findConceptMatches(text, concepts);

      expect(matches).toHaveLength(2);
      expect(matches[0].concept.name).toBe('JavaScript');
      expect(matches[0].position).toBe(7);
      expect(matches[1].concept.name).toBe('TypeScript');
    });

    it('should respect word boundaries', () => {
      const concepts = [
        createConcept('1', 'test', 'topic', []),
      ];

      const text = 'This is a test. Testing is good.';
      const matches = findConceptMatches(text, concepts);

      // Should only match "test" as a whole word, not "Testing"
      expect(matches).toHaveLength(1);
      expect(matches[0].position).toBe(10); // position of "test" as a whole word
      expect(matches[0].term).toBe('test');
    });

    it('should be case-insensitive', () => {
      const concepts = [
        createConcept('1', 'Python', 'topic', []),
      ];

      const text = 'I use python for data analysis.';
      const matches = findConceptMatches(text, concepts);

      expect(matches).toHaveLength(1);
      expect(matches[0].term).toBe('python'); // preserves original case
    });

    it('should not match inside wiki link brackets', () => {
      const concepts = [
        createConcept('1', 'JavaScript', 'topic', []),
      ];

      const text = 'Learn more about [[JavaScript]] programming.';
      const matches = findConceptMatches(text, concepts);

      // Should not match the one inside [[...]]
      expect(matches).toHaveLength(0);
    });

    it('should match outside wiki link brackets', () => {
      const concepts = [
        createConcept('1', 'JavaScript', 'topic', []),
      ];

      const text = 'JavaScript is great. See [[OtherTopic]] for more on JavaScript.';
      const matches = findConceptMatches(text, concepts);

      expect(matches).toHaveLength(1);
      expect(matches[0].position).toBe(0);
    });

    it('should skip very short concept names', () => {
      const concepts = [
        createConcept('1', 'a', 'topic', []),
        createConcept('2', 'JavaScript', 'topic', []),
      ];

      const text = 'This is a test of JavaScript.';
      const matches = findConceptMatches(text, concepts);

      expect(matches).toHaveLength(1);
      expect(matches[0].concept.name).toBe('JavaScript');
    });

    it('should return matches sorted by position', () => {
      const concepts = [
        createConcept('1', 'Beta', 'topic', []),
        createConcept('2', 'Alpha', 'topic', []),
      ];

      const text = 'Alpha comes before Beta.';
      const matches = findConceptMatches(text, concepts);

      expect(matches).toHaveLength(2);
      expect(matches[0].concept.name).toBe('Alpha');
      expect(matches[1].concept.name).toBe('Beta');
    });

    it('should handle text with no matches', () => {
      const concepts = [
        createConcept('1', 'JavaScript', 'topic', []),
      ];

      const text = 'This text does not contain the concept.';
      const matches = findConceptMatches(text, concepts);

      expect(matches).toEqual([]);
    });

    it('should handle empty text', () => {
      const concepts = [
        createConcept('1', 'JavaScript', 'topic', []),
      ];

      const matches = findConceptMatches('', concepts);

      expect(matches).toEqual([]);
    });

    it('should handle empty concepts array', () => {
      const matches = findConceptMatches('Some text here', []);

      expect(matches).toEqual([]);
    });

    it('should match multi-word concepts', () => {
      const concepts = [
        createConcept('1', 'Project Alpha', 'project', []),
      ];

      const text = 'We are working on Project Alpha this quarter.';
      const matches = findConceptMatches(text, concepts);

      expect(matches).toHaveLength(1);
      expect(matches[0].concept.name).toBe('Project Alpha');
      expect(matches[0].term).toBe('Project Alpha');
    });

    it('should only report first match per concept', () => {
      const concepts = [
        createConcept('1', 'test', 'topic', []),
      ];

      const text = 'This is a test. Another test here. Final test.';
      const matches = findConceptMatches(text, concepts);

      // Should only match once per concept
      expect(matches).toHaveLength(1);
    });

    it('should handle punctuation at word boundaries', () => {
      const concepts = [
        createConcept('1', 'JavaScript', 'topic', []),
      ];

      const text = 'JavaScript, TypeScript, and Python.';
      const matches = findConceptMatches(text, concepts);

      expect(matches).toHaveLength(1);
      expect(matches[0].position).toBe(0);
    });

    it('should handle newlines as word boundaries', () => {
      const concepts = [
        createConcept('1', 'JavaScript', 'topic', []),
      ];

      const text = 'First line\nJavaScript\nThird line';
      const matches = findConceptMatches(text, concepts);

      expect(matches).toHaveLength(1);
    });
  });
});

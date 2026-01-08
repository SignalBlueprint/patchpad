import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTemplates,
  getUserTemplates,
  getTemplateById,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
  getTemplatesByCategory,
  getTemplateCategories,
  searchTemplates,
  patternToTemplate,
  getFormattedDate,
} from './templates';
import type { Template } from '../types/template';

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

describe('Template Service', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getTemplates', () => {
    it('should return built-in templates when no user templates exist', () => {
      const templates = getTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.name === 'Meeting Notes')).toBe(true);
      expect(templates.some(t => t.name === 'Research Notes')).toBe(true);
      expect(templates.some(t => t.name === 'Daily Journal')).toBe(true);
    });

    it('should include user templates with built-in templates', () => {
      // Save a user template
      saveTemplate({
        name: 'Custom Template',
        description: 'A custom template',
        structure: '# {{title}}\n\nContent',
        placeholders: [{ key: 'title', label: 'Title', type: 'text', required: true }],
        aiEnhanced: false,
      });

      const templates = getTemplates();

      expect(templates.some(t => t.name === 'Custom Template')).toBe(true);
      expect(templates.some(t => t.name === 'Meeting Notes')).toBe(true);
    });
  });

  describe('getUserTemplates', () => {
    it('should return empty array when no user templates exist', () => {
      const templates = getUserTemplates();
      expect(templates).toEqual([]);
    });

    it('should return saved user templates', () => {
      saveTemplate({
        name: 'User Template 1',
        description: 'Description 1',
        structure: '# {{title}}',
        placeholders: [],
        aiEnhanced: false,
      });

      saveTemplate({
        name: 'User Template 2',
        description: 'Description 2',
        structure: '## {{header}}',
        placeholders: [],
        aiEnhanced: false,
      });

      const templates = getUserTemplates();

      expect(templates.length).toBe(2);
      expect(templates[0].name).toBe('User Template 1');
      expect(templates[1].name).toBe('User Template 2');
    });
  });

  describe('getTemplateById', () => {
    it('should return built-in template by ID', () => {
      const template = getTemplateById('builtin-meeting-notes');

      expect(template).not.toBeNull();
      expect(template?.name).toBe('Meeting Notes');
    });

    it('should return user template by ID', () => {
      const saved = saveTemplate({
        name: 'Custom',
        description: 'Custom template',
        structure: '# {{title}}',
        placeholders: [],
        aiEnhanced: false,
      });

      const template = getTemplateById(saved.id);

      expect(template).not.toBeNull();
      expect(template?.name).toBe('Custom');
    });

    it('should return null for non-existent ID', () => {
      const template = getTemplateById('non-existent-id');
      expect(template).toBeNull();
    });
  });

  describe('saveTemplate', () => {
    it('should save a new template with generated ID and timestamps', () => {
      const template = saveTemplate({
        name: 'New Template',
        description: 'A new template',
        structure: '# {{title}}\n\n{{content}}',
        placeholders: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'content', label: 'Content', type: 'text' },
        ],
        aiEnhanced: false,
        tags: ['custom'],
      });

      expect(template.id).toBeDefined();
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
      expect(template.name).toBe('New Template');
    });

    it('should persist template to localStorage', () => {
      saveTemplate({
        name: 'Persistent Template',
        description: 'Should be saved',
        structure: '# {{title}}',
        placeholders: [],
        aiEnhanced: false,
      });

      const retrieved = getUserTemplates();

      expect(retrieved.length).toBe(1);
      expect(retrieved[0].name).toBe('Persistent Template');
    });
  });

  describe('updateTemplate', () => {
    it('should update an existing user template', () => {
      const saved = saveTemplate({
        name: 'Original Name',
        description: 'Original description',
        structure: '# {{title}}',
        placeholders: [],
        aiEnhanced: false,
      });

      const updated = updateTemplate(saved.id, {
        name: 'Updated Name',
        description: 'Updated description',
      });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Updated description');
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(saved.createdAt.getTime());
    });

    it('should return null when updating built-in template', () => {
      const result = updateTemplate('builtin-meeting-notes', { name: 'Hacked' });
      expect(result).toBeNull();
    });

    it('should return null for non-existent template', () => {
      const result = updateTemplate('non-existent', { name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a user template', () => {
      const saved = saveTemplate({
        name: 'To Delete',
        description: 'Will be deleted',
        structure: '# {{title}}',
        placeholders: [],
        aiEnhanced: false,
      });

      const deleted = deleteTemplate(saved.id);

      expect(deleted).toBe(true);
      expect(getUserTemplates().length).toBe(0);
    });

    it('should not delete built-in templates', () => {
      const deleted = deleteTemplate('builtin-meeting-notes');

      expect(deleted).toBe(false);
      expect(getTemplateById('builtin-meeting-notes')).not.toBeNull();
    });

    it('should return false for non-existent template', () => {
      const deleted = deleteTemplate('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('applyTemplate', () => {
    it('should replace placeholders with values', () => {
      const template: Template = {
        id: 'test',
        name: 'Test Template',
        description: 'Test',
        structure: '# {{title}}\n\nBy: {{author}}',
        placeholders: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'author', label: 'Author', type: 'text' },
        ],
        aiEnhanced: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = applyTemplate(template, {
        title: 'My Note',
        author: 'John Doe',
      });

      expect(result.content).toContain('# My Note');
      expect(result.content).toContain('By: John Doe');
      expect(result.title).toBe('My Note');
    });

    it('should use default values when not provided', () => {
      const template: Template = {
        id: 'test',
        name: 'Test Template',
        description: 'Test',
        structure: '# {{title}}\n\nStatus: {{status}}',
        placeholders: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'status', label: 'Status', type: 'text', defaultValue: 'Draft' },
        ],
        aiEnhanced: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = applyTemplate(template, { title: 'Test' });

      expect(result.content).toContain('Status: Draft');
    });

    it('should add title prefix', () => {
      const template: Template = {
        id: 'test',
        name: 'Meeting Notes',
        description: 'Test',
        structure: '# {{title}}',
        placeholders: [
          { key: 'title', label: 'Title', type: 'text', required: true },
        ],
        aiEnhanced: false,
        titlePrefix: 'Meeting:',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = applyTemplate(template, { title: 'Team Sync' });

      expect(result.title).toBe('Meeting: Team Sync');
    });

    it('should not duplicate title prefix', () => {
      const template: Template = {
        id: 'test',
        name: 'Meeting Notes',
        description: 'Test',
        structure: '# {{title}}',
        placeholders: [
          { key: 'title', label: 'Title', type: 'text', required: true },
        ],
        aiEnhanced: false,
        titlePrefix: 'Meeting:',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = applyTemplate(template, { title: 'Meeting: Team Sync' });

      expect(result.title).toBe('Meeting: Team Sync');
      expect(result.title).not.toBe('Meeting: Meeting: Team Sync');
    });

    it('should include template tags', () => {
      const template: Template = {
        id: 'test',
        name: 'Test Template',
        description: 'Test',
        structure: '# {{title}}',
        placeholders: [],
        aiEnhanced: false,
        tags: ['work', 'important'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = applyTemplate(template, { title: 'Test' });

      expect(result.tags).toContain('work');
      expect(result.tags).toContain('important');
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return templates filtered by category', () => {
      const workTemplates = getTemplatesByCategory('work');

      expect(workTemplates.length).toBeGreaterThan(0);
      expect(workTemplates.every(t => t.category === 'work')).toBe(true);
    });
  });

  describe('getTemplateCategories', () => {
    it('should return unique categories', () => {
      const categories = getTemplateCategories();

      expect(categories.length).toBeGreaterThan(0);
      expect(new Set(categories).size).toBe(categories.length); // All unique
    });
  });

  describe('searchTemplates', () => {
    it('should search by name', () => {
      const results = searchTemplates('meeting');

      expect(results.some(t => t.name === 'Meeting Notes')).toBe(true);
    });

    it('should search by description', () => {
      const results = searchTemplates('attendees');

      expect(results.some(t => t.name === 'Meeting Notes')).toBe(true);
    });

    it('should search by tags', () => {
      const results = searchTemplates('research');

      expect(results.some(t => t.name === 'Research Notes')).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const results = searchTemplates('xyznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('patternToTemplate', () => {
    it('should convert structure to template with extracted placeholders', () => {
      const template = patternToTemplate(
        'Custom Pattern',
        '# {{title}}\n\nDate: {{date}}\n\n{{content}}',
        { description: 'A custom pattern', tags: ['custom'], category: 'work' }
      );

      expect(template.name).toBe('Custom Pattern');
      expect(template.placeholders.length).toBe(3);
      expect(template.placeholders.find(p => p.key === 'title')?.required).toBe(true);
      expect(template.placeholders.find(p => p.key === 'date')?.type).toBe('date');
      expect(template.placeholders.find(p => p.key === 'content')?.type).toBe('text');
      expect(template.tags).toEqual(['custom']);
      expect(template.category).toBe('work');
    });

    it('should detect AI placeholders', () => {
      const template = patternToTemplate(
        'AI Template',
        '# {{title}}\n\n{{ai:related_notes}}'
      );

      expect(template.aiEnhanced).toBe(true);
      expect(template.placeholders.find(p => p.key === 'ai:related_notes')?.type).toBe('ai-fill');
    });
  });

  describe('getFormattedDate', () => {
    it('should return a formatted date string', () => {
      const formatted = getFormattedDate();

      // Should contain day of week and full date
      expect(formatted).toMatch(/\w+day/); // Contains a day name
      expect(formatted).toMatch(/\d{4}/); // Contains year
    });
  });
});

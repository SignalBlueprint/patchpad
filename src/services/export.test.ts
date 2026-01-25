import { describe, it, expect, vi } from 'vitest';
import { exportNotesAsZip, type ExportOptions } from './export';
import { sanitizeFilename, generateUniqueFilenames, createFilenameMap } from '../utils/sanitizeFilename';
import type { Note } from '../types/note';
import JSZip from 'jszip';

const createMockNote = (
  id: string,
  title: string,
  content: string = '',
  tags: string[] = []
): Note => ({
  id,
  title,
  content,
  tags,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-20'),
});

describe('sanitizeFilename', () => {
  it('should replace invalid characters with dashes', () => {
    expect(sanitizeFilename('file/name')).toBe('file-name');
    expect(sanitizeFilename('file\\name')).toBe('file-name');
    expect(sanitizeFilename('file:name')).toBe('file-name');
    expect(sanitizeFilename('file*name')).toBe('file-name');
    expect(sanitizeFilename('file?name')).toBe('file-name');
    expect(sanitizeFilename('file"name')).toBe('file-name');
    expect(sanitizeFilename('file<name')).toBe('file-name');
    expect(sanitizeFilename('file>name')).toBe('file-name');
    expect(sanitizeFilename('file|name')).toBe('file-name');
  });

  it('should collapse multiple dashes', () => {
    expect(sanitizeFilename('file---name')).toBe('file-name');
    expect(sanitizeFilename('file   name')).toBe('file-name');
  });

  it('should trim leading/trailing dashes', () => {
    expect(sanitizeFilename('-file-name-')).toBe('file-name');
    expect(sanitizeFilename('  file  ')).toBe('file');
  });

  it('should limit length to 100 characters', () => {
    const longTitle = 'a'.repeat(150);
    const result = sanitizeFilename(longTitle);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('should return "untitled" for empty strings', () => {
    expect(sanitizeFilename('')).toBe('untitled');
    expect(sanitizeFilename('   ')).toBe('untitled');
    expect(sanitizeFilename('---')).toBe('untitled');
  });
});

describe('generateUniqueFilenames', () => {
  it('should generate unique filenames for duplicate titles', () => {
    const titles = ['Note', 'Note', 'Note'];
    const result = generateUniqueFilenames(titles);

    expect(result.length).toBe(3);
    // All values should be unique
    const uniqueValues = new Set(result.map(v => v.toLowerCase()));
    expect(uniqueValues.size).toBe(3);
    // First should be 'Note', second 'Note-1', third 'Note-2'
    expect(result[0]).toBe('Note');
    expect(result[1]).toBe('Note-1');
    expect(result[2]).toBe('Note-2');
  });

  it('should handle case-insensitive duplicates', () => {
    const titles = ['Note', 'NOTE', 'note'];
    const result = generateUniqueFilenames(titles);

    expect(result.length).toBe(3);
    const uniqueValues = new Set(result.map(v => v.toLowerCase()));
    expect(uniqueValues.size).toBe(3);
  });
});

describe('createFilenameMap', () => {
  it('should map note IDs to unique filenames', () => {
    const notes = [
      { id: '1', title: 'My Note' },
      { id: '2', title: 'My Note' },
      { id: '3', title: 'Another Note' },
    ];

    const result = createFilenameMap(notes);

    expect(result.get('1')).toBe('My-Note');
    expect(result.get('2')).toBe('My-Note-1');
    expect(result.get('3')).toBe('Another-Note');
  });
});

describe('exportNotesAsZip', () => {
  it('should export a single note correctly', async () => {
    const note = createMockNote('1', 'Test Note', 'Hello world!');
    const options: ExportOptions = {
      notes: [note],
      includeManifest: true,
      rewriteLinks: true,
    };

    const blob = await exportNotesAsZip(options);
    expect(blob).toBeInstanceOf(Blob);

    // Load the ZIP and verify contents
    const zip = await JSZip.loadAsync(blob);

    // Check markdown file exists
    const mdFile = zip.file('Test-Note.md');
    expect(mdFile).not.toBeNull();

    const content = await mdFile!.async('string');
    expect(content).toContain('title: "Test Note"');
    expect(content).toContain('Hello world!');

    // Check manifest exists
    const manifestFile = zip.file('manifest.json');
    expect(manifestFile).not.toBeNull();

    const manifest = JSON.parse(await manifestFile!.async('string'));
    expect(manifest.noteCount).toBe(1);
    expect(manifest.notes[0].title).toBe('Test Note');
  });

  it('should rewrite wiki links to relative paths', async () => {
    const notes = [
      createMockNote('1', 'Note A', 'Links to [[Note B]] here.'),
      createMockNote('2', 'Note B', 'Content of Note B'),
    ];

    const options: ExportOptions = {
      notes,
      includeManifest: false,
      rewriteLinks: true,
    };

    const blob = await exportNotesAsZip(options);
    const zip = await JSZip.loadAsync(blob);

    const noteAContent = await zip.file('Note-A.md')!.async('string');
    expect(noteAContent).toContain('[Note B](./Note-B.md)');
    expect(noteAContent).not.toContain('[[Note B]]');
  });

  it('should preserve wiki links when rewriteLinks is false', async () => {
    const notes = [
      createMockNote('1', 'Note A', 'Links to [[Note B]] here.'),
      createMockNote('2', 'Note B', 'Content of Note B'),
    ];

    const options: ExportOptions = {
      notes,
      includeManifest: false,
      rewriteLinks: false,
    };

    const blob = await exportNotesAsZip(options);
    const zip = await JSZip.loadAsync(blob);

    const noteAContent = await zip.file('Note-A.md')!.async('string');
    expect(noteAContent).toContain('[[Note B]]');
  });

  it('should include manifest with correct metadata', async () => {
    const note = createMockNote('1', 'Test Note', 'Content', ['tag1', 'tag2']);
    const options: ExportOptions = {
      notes: [note],
      includeManifest: true,
      rewriteLinks: false,
    };

    const blob = await exportNotesAsZip(options);
    const zip = await JSZip.loadAsync(blob);

    const manifestFile = zip.file('manifest.json');
    expect(manifestFile).not.toBeNull();

    const manifest = JSON.parse(await manifestFile!.async('string'));
    expect(manifest.exported).toBeDefined();
    expect(manifest.noteCount).toBe(1);
    expect(manifest.notes[0].id).toBe('1');
    expect(manifest.notes[0].title).toBe('Test Note');
    expect(manifest.notes[0].filename).toBe('Test-Note.md');
    expect(manifest.notes[0].tags).toEqual(['tag1', 'tag2']);
  });

  it('should not include manifest when includeManifest is false', async () => {
    const note = createMockNote('1', 'Test Note', 'Content');
    const options: ExportOptions = {
      notes: [note],
      includeManifest: false,
      rewriteLinks: false,
    };

    const blob = await exportNotesAsZip(options);
    const zip = await JSZip.loadAsync(blob);

    const manifestFile = zip.file('manifest.json');
    expect(manifestFile).toBeNull();
  });

  it('should handle notes with special characters in titles', async () => {
    const note = createMockNote('1', 'My Note: A "Test" <Story>', 'Content');
    const options: ExportOptions = {
      notes: [note],
      includeManifest: false,
      rewriteLinks: false,
    };

    const blob = await exportNotesAsZip(options);
    const zip = await JSZip.loadAsync(blob);

    // Should have a sanitized filename
    const files = Object.keys(zip.files);
    expect(files.some(f => f.endsWith('.md'))).toBe(true);
    expect(files.some(f => f.includes(':'))).toBe(false);
  });

  it('should include frontmatter in exported files', async () => {
    const note = createMockNote('1', 'Test Note', 'Content', ['tag1']);
    note.favorite = true;

    const options: ExportOptions = {
      notes: [note],
      includeManifest: false,
      rewriteLinks: false,
    };

    const blob = await exportNotesAsZip(options);
    const zip = await JSZip.loadAsync(blob);

    const content = await zip.file('Test-Note.md')!.async('string');
    expect(content).toContain('---');
    expect(content).toContain('title: "Test Note"');
    expect(content).toContain('tags: ["tag1"]');
    expect(content).toContain('favorite: true');
    expect(content).toContain('created:');
    expect(content).toContain('updated:');
  });
});

/**
 * Export Service
 * Generates ZIP files containing notes as markdown files
 */

import JSZip from 'jszip';
import type { Note } from '../types/note';
import { createFilenameMap, sanitizeFilename } from '../utils/sanitizeFilename';
import { parseWikiLinks } from '../utils/linkParser';

export interface ExportOptions {
  notes: Note[];
  includeManifest?: boolean;
  rewriteLinks?: boolean;
}

export interface ExportManifest {
  exported: string;
  noteCount: number;
  notes: Array<{
    id: string;
    title: string;
    filename: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  }>;
}

/**
 * Export notes as a ZIP file
 * @param options Export options
 * @returns Blob containing the ZIP file
 */
export async function exportNotesAsZip(options: ExportOptions): Promise<Blob> {
  const { notes, includeManifest = true, rewriteLinks = true } = options;

  const zip = new JSZip();

  // Create filename map for all notes
  const filenameMap = createFilenameMap(notes);

  // Create a map from note title to filename for link rewriting
  const titleToFilename = new Map<string, string>();
  for (const note of notes) {
    const filename = filenameMap.get(note.id);
    if (filename) {
      titleToFilename.set(note.title.toLowerCase().trim(), filename);
    }
  }

  // Generate markdown files
  for (const note of notes) {
    const filename = filenameMap.get(note.id);
    if (!filename) continue;

    let content = note.content;

    // Rewrite wiki links to relative markdown links
    if (rewriteLinks) {
      content = rewriteWikiLinks(content, titleToFilename);
    }

    // Add frontmatter
    const frontmatter = generateFrontmatter(note);
    const fullContent = frontmatter + content;

    zip.file(`${filename}.md`, fullContent);
  }

  // Generate manifest
  if (includeManifest) {
    const manifest: ExportManifest = {
      exported: new Date().toISOString(),
      noteCount: notes.length,
      notes: notes.map(note => ({
        id: note.id,
        title: note.title,
        filename: `${filenameMap.get(note.id)}.md`,
        tags: note.tags || [],
        createdAt: new Date(note.createdAt).toISOString(),
        updatedAt: new Date(note.updatedAt).toISOString(),
      })),
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  }

  // Generate the ZIP blob
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

/**
 * Generate YAML frontmatter for a note
 */
function generateFrontmatter(note: Note): string {
  const lines = [
    '---',
    `title: "${escapeYamlString(note.title)}"`,
    `created: ${new Date(note.createdAt).toISOString()}`,
    `updated: ${new Date(note.updatedAt).toISOString()}`,
  ];

  if (note.tags && note.tags.length > 0) {
    lines.push(`tags: [${note.tags.map(t => `"${escapeYamlString(t)}"`).join(', ')}]`);
  }

  if (note.favorite) {
    lines.push('favorite: true');
  }

  lines.push('---', '', '');

  return lines.join('\n');
}

/**
 * Escape a string for YAML
 */
function escapeYamlString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

/**
 * Rewrite wiki links to relative markdown links
 * @param content The markdown content
 * @param titleToFilename Map from note title to filename
 * @returns Content with rewritten links
 */
function rewriteWikiLinks(
  content: string,
  titleToFilename: Map<string, string>
): string {
  const links = parseWikiLinks(content);

  // Process links in reverse order to maintain positions
  let result = content;
  const linksReversed = [...links].reverse();

  for (const link of linksReversed) {
    const targetTitleLower = link.targetTitle.toLowerCase().trim();
    const filename = titleToFilename.get(targetTitleLower);

    if (filename) {
      // Link target exists in export - convert to relative markdown link
      const displayText = link.displayText || link.targetTitle;
      const markdownLink = `[${displayText}](./${filename}.md)`;

      result = result.slice(0, link.from) + markdownLink + result.slice(link.to);
    }
    // If target doesn't exist in export, leave the wiki link as-is
  }

  return result;
}

/**
 * Trigger a file download in the browser
 * @param blob The blob to download
 * @param filename The filename for the download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export notes and trigger download
 * @param options Export options
 * @param zipFilename The name for the ZIP file (without extension)
 */
export async function exportAndDownload(
  options: ExportOptions,
  zipFilename?: string
): Promise<void> {
  const blob = await exportNotesAsZip(options);

  const filename = zipFilename
    ? `${sanitizeFilename(zipFilename)}.zip`
    : `patchpad-export-${new Date().toISOString().split('T')[0]}.zip`;

  downloadBlob(blob, filename);
}

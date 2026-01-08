/**
 * Document Export Service
 *
 * Exports notes and compiled documents to various formats.
 * Supports: Markdown document, HTML, and browser-based PDF.
 */

import type { Note } from '../types/note';

export type ExportFormat = 'markdown' | 'html' | 'pdf';

export interface DocumentExportOptions {
  title: string;
  author?: string;
  date?: Date;
  includeTableOfContents?: boolean;
  includeFrontmatter?: boolean;
  includeFooter?: boolean;
  theme?: 'light' | 'dark';
  pageSize?: 'letter' | 'a4';
}

export interface CompiledDocument {
  title: string;
  sections: DocumentSection[];
  metadata: DocumentMetadata;
}

export interface DocumentSection {
  heading: string;
  content: string;
  level: number;
  noteIds: string[];
}

export interface DocumentMetadata {
  author?: string;
  date: Date;
  wordCount: number;
  noteCount: number;
  tags: string[];
}

/**
 * Compile multiple notes into a structured document
 */
export function compileNotesIntoDocument(
  notes: Note[],
  title: string,
  options: { author?: string; organizationMethod?: 'chronological' | 'alphabetical' | 'manual' } = {}
): CompiledDocument {
  const { author, organizationMethod = 'chronological' } = options;

  // Sort notes based on organization method
  const sortedNotes = [...notes].sort((a, b) => {
    switch (organizationMethod) {
      case 'alphabetical':
        return a.title.localeCompare(b.title);
      case 'chronological':
      default:
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
  });

  // Build sections from notes
  const sections: DocumentSection[] = sortedNotes.map((note, index) => ({
    heading: note.title,
    content: note.content,
    level: 2,
    noteIds: [note.id],
  }));

  // Calculate metadata
  const allContent = notes.map((n) => n.content).join(' ');
  const wordCount = allContent.split(/\s+/).filter((w) => w.length > 0).length;
  const allTags = [...new Set(notes.flatMap((n) => n.tags || []))];

  return {
    title,
    sections,
    metadata: {
      author,
      date: new Date(),
      wordCount,
      noteCount: notes.length,
      tags: allTags,
    },
  };
}

/**
 * Generate table of contents from document sections
 */
function generateTableOfContents(sections: DocumentSection[]): string {
  const lines = ['## Table of Contents', ''];

  sections.forEach((section, index) => {
    const indent = '  '.repeat(section.level - 2);
    const anchor = section.heading.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    lines.push(`${indent}${index + 1}. [${section.heading}](#${anchor})`);
  });

  lines.push('', '---', '');
  return lines.join('\n');
}

/**
 * Generate YAML frontmatter for markdown document
 */
function generateFrontmatter(doc: CompiledDocument, options: DocumentExportOptions): string {
  const lines = ['---'];
  lines.push(`title: "${doc.title}"`);
  if (doc.metadata.author) {
    lines.push(`author: "${doc.metadata.author}"`);
  }
  lines.push(`date: ${(options.date || doc.metadata.date).toISOString().split('T')[0]}`);
  if (doc.metadata.tags.length > 0) {
    lines.push(`tags: [${doc.metadata.tags.map((t) => `"${t}"`).join(', ')}]`);
  }
  lines.push(`word_count: ${doc.metadata.wordCount}`);
  lines.push(`note_count: ${doc.metadata.noteCount}`);
  lines.push('---', '');
  return lines.join('\n');
}

/**
 * Export document to Markdown format
 */
export function exportToMarkdown(
  doc: CompiledDocument,
  options: DocumentExportOptions = { title: doc.title }
): string {
  const parts: string[] = [];

  // Add frontmatter
  if (options.includeFrontmatter !== false) {
    parts.push(generateFrontmatter(doc, options));
  }

  // Add title
  parts.push(`# ${doc.title}`, '');

  // Add metadata line
  if (doc.metadata.author || options.date) {
    const metaParts: string[] = [];
    if (doc.metadata.author) metaParts.push(`*By ${doc.metadata.author}*`);
    const date = options.date || doc.metadata.date;
    metaParts.push(`*${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*`);
    parts.push(metaParts.join(' | '), '');
  }

  // Add table of contents
  if (options.includeTableOfContents) {
    parts.push(generateTableOfContents(doc.sections));
  }

  // Add sections
  doc.sections.forEach((section) => {
    const headerPrefix = '#'.repeat(section.level);
    parts.push(`${headerPrefix} ${section.heading}`, '');
    parts.push(section.content, '');
  });

  // Add footer
  if (options.includeFooter !== false) {
    parts.push('---', '');
    parts.push(`*Document compiled from ${doc.metadata.noteCount} notes (${doc.metadata.wordCount.toLocaleString()} words)*`);
    parts.push(`*Generated on ${new Date().toLocaleString()}*`);
  }

  return parts.join('\n');
}

/**
 * Export document to HTML format
 */
export function exportToHTML(
  doc: CompiledDocument,
  options: DocumentExportOptions = { title: doc.title }
): string {
  const theme = options.theme || 'light';
  const isDark = theme === 'dark';

  // Convert markdown content to basic HTML
  const convertMarkdownToHTML = (md: string): string => {
    let html = md
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold and italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Wiki links
      .replace(/\[\[([^\]]+)\]\]/g, '<span class="wiki-link">$1</span>')
      // Lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p>')
      // Line breaks
      .replace(/\n/g, '<br>');

    // Wrap in paragraph tags
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    // Wrap consecutive li elements in ul
    html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');

    return html;
  };

  const styles = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: ${isDark ? '#1a1a2e' : '#ffffff'};
      color: ${isDark ? '#e0e0e0' : '#333333'};
    }
    h1 {
      font-size: 2.5em;
      border-bottom: 2px solid ${isDark ? '#4a4a6a' : '#e0e0e0'};
      padding-bottom: 10px;
      color: ${isDark ? '#ffffff' : '#1a1a2e'};
    }
    h2 {
      font-size: 1.8em;
      margin-top: 2em;
      color: ${isDark ? '#a0a0ff' : '#2a2a4e'};
    }
    h3 { font-size: 1.4em; }
    h4 { font-size: 1.2em; }
    pre {
      background: ${isDark ? '#2a2a4e' : '#f5f5f5'};
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
    }
    code {
      background: ${isDark ? '#2a2a4e' : '#f0f0f0'};
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Fira Code', 'Monaco', monospace;
    }
    pre code { background: none; padding: 0; }
    a { color: ${isDark ? '#6a9fff' : '#0066cc'}; }
    .wiki-link {
      background: ${isDark ? '#3a3a5e' : '#e8f0ff'};
      padding: 2px 6px;
      border-radius: 4px;
      color: ${isDark ? '#8ab4ff' : '#0066cc'};
    }
    .metadata {
      color: ${isDark ? '#888888' : '#666666'};
      font-style: italic;
      margin-bottom: 2em;
    }
    .toc {
      background: ${isDark ? '#2a2a4e' : '#f8f8f8'};
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .toc h2 { margin-top: 0; font-size: 1.2em; }
    .toc ul { margin: 0; padding-left: 20px; }
    .footer {
      margin-top: 4em;
      padding-top: 20px;
      border-top: 1px solid ${isDark ? '#4a4a6a' : '#e0e0e0'};
      color: ${isDark ? '#888888' : '#666666'};
      font-size: 0.9em;
      font-style: italic;
    }
    ul { margin: 1em 0; }
    li { margin: 0.5em 0; }
    @media print {
      body { max-width: none; padding: 0; }
      .no-print { display: none; }
    }
  `;

  const tocHTML = options.includeTableOfContents
    ? `
    <div class="toc">
      <h2>Table of Contents</h2>
      <ul>
        ${doc.sections
          .map((s, i) => {
            const anchor = s.heading.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return `<li><a href="#${anchor}">${i + 1}. ${s.heading}</a></li>`;
          })
          .join('\n')}
      </ul>
    </div>
  `
    : '';

  const sectionsHTML = doc.sections
    .map((section) => {
      const anchor = section.heading.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const tag = `h${section.level}`;
      return `
      <${tag} id="${anchor}">${section.heading}</${tag}>
      <div class="section-content">
        ${convertMarkdownToHTML(section.content)}
      </div>
    `;
    })
    .join('\n');

  const metadataHTML =
    doc.metadata.author || options.date
      ? `
    <div class="metadata">
      ${doc.metadata.author ? `By ${doc.metadata.author}` : ''}
      ${doc.metadata.author && options.date ? ' | ' : ''}
      ${(options.date || doc.metadata.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </div>
  `
      : '';

  const footerHTML =
    options.includeFooter !== false
      ? `
    <div class="footer">
      <p>Document compiled from ${doc.metadata.noteCount} notes (${doc.metadata.wordCount.toLocaleString()} words)</p>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
  `
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title}</title>
  <style>${styles}</style>
</head>
<body>
  <h1>${doc.title}</h1>
  ${metadataHTML}
  ${tocHTML}
  ${sectionsHTML}
  ${footerHTML}
</body>
</html>`;
}

/**
 * Export document to PDF using browser print functionality
 */
export async function exportToPDF(
  doc: CompiledDocument,
  options: DocumentExportOptions = { title: doc.title }
): Promise<void> {
  // Generate HTML
  const html = exportToHTML(doc, { ...options, includeFooter: true });

  // Create a new window with the HTML content
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window. Please allow popups.');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load, then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      // Close the window after a delay (user may cancel print)
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 250);
  };
}

/**
 * Download markdown file
 */
export function downloadMarkdown(doc: CompiledDocument, options?: DocumentExportOptions): void {
  const content = exportToMarkdown(doc, options);
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download HTML file
 */
export function downloadHTML(doc: CompiledDocument, options?: DocumentExportOptions): void {
  const content = exportToHTML(doc, options);
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Quick export single note to markdown
 */
export function exportNoteToMarkdown(note: Note): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push('---');
  lines.push(`title: "${note.title}"`);
  lines.push(`created: ${new Date(note.createdAt).toISOString()}`);
  lines.push(`updated: ${new Date(note.updatedAt).toISOString()}`);
  if (note.tags && note.tags.length > 0) {
    lines.push(`tags: [${note.tags.map((t) => `"${t}"`).join(', ')}]`);
  }
  if (note.favorite) {
    lines.push(`favorite: true`);
  }
  lines.push('---', '');

  // Title and content
  lines.push(`# ${note.title}`, '');
  lines.push(note.content);

  return lines.join('\n');
}

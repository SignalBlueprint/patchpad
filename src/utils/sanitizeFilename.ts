/**
 * Filename sanitization utilities
 */

// Characters that are invalid in filenames across Windows, macOS, and Linux
const INVALID_CHARS = /[/\\:*?"<>|]/g;

// Characters that might cause issues
const PROBLEMATIC_CHARS = /[\x00-\x1f\x7f]/g;

// Maximum filename length (leaving room for extension and dedup suffix)
const MAX_LENGTH = 100;

/**
 * Sanitize a string to be a valid filename
 * @param title The title to sanitize
 * @returns A filesystem-safe filename (without extension)
 */
export function sanitizeFilename(title: string): string {
  let sanitized = title
    // Replace invalid characters with dashes
    .replace(INVALID_CHARS, '-')
    // Remove control characters
    .replace(PROBLEMATIC_CHARS, '')
    // Replace multiple spaces/dashes with single dash
    .replace(/[\s-]+/g, '-')
    // Remove leading/trailing whitespace and dashes
    .trim()
    .replace(/^-+|-+$/g, '');

  // Limit length
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH).replace(/-+$/, '');
  }

  // Fallback for empty result
  if (!sanitized) {
    sanitized = 'untitled';
  }

  return sanitized;
}

/**
 * Generate unique filenames for a set of titles
 * @param titles Array of titles to convert to filenames
 * @returns Map of original title to unique filename (without extension)
 */
export function generateUniqueFilenames(titles: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const usedNames = new Set<string>();

  for (const title of titles) {
    let filename = sanitizeFilename(title);
    let uniqueFilename = filename;
    let counter = 1;

    // If name is already used, append counter
    while (usedNames.has(uniqueFilename.toLowerCase())) {
      uniqueFilename = `${filename}-${counter}`;
      counter++;
    }

    usedNames.add(uniqueFilename.toLowerCase());
    result.set(title, uniqueFilename);
  }

  return result;
}

/**
 * Create a map of note IDs to unique filenames
 * @param notes Array of objects with id and title
 * @returns Map of note ID to unique filename (without extension)
 */
export function createFilenameMap(
  notes: { id: string; title: string }[]
): Map<string, string> {
  const idToFilename = new Map<string, string>();
  const usedNames = new Set<string>();

  for (const note of notes) {
    let filename = sanitizeFilename(note.title);
    let uniqueFilename = filename;
    let counter = 1;

    // If name is already used, append counter
    while (usedNames.has(uniqueFilename.toLowerCase())) {
      uniqueFilename = `${filename}-${counter}`;
      counter++;
    }

    usedNames.add(uniqueFilename.toLowerCase());
    idToFilename.set(note.id, uniqueFilename);
  }

  return idToFilename;
}

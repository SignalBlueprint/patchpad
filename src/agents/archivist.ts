/**
 * Archivist Agent
 *
 * Organizes and connects notes, finding relationships and suggesting links.
 * Capabilities:
 * - suggestConnections: Find notes that should be linked together
 * - detectDuplicates: Find near-duplicate notes
 * - surfaceContradictions: Find conflicting information
 * - suggestMerges: Identify notes that could be combined
 */

import type { Note } from '../types/note';
import type { AgentTask, AgentTaskResult, AgentSuggestion } from '../types/agent';
import { registerTaskHandler, createSuggestion } from '../services/agentFramework';
import { findRelatedNotes } from '../services/ai';
import { getEmbeddingForNote, cosineSimilarity } from '../services/embeddings';

/**
 * Initialize the Archivist agent by registering its task handlers
 */
export function initializeArchivistAgent(): void {
  registerTaskHandler('archivist', 'suggestConnections', suggestConnections);
  registerTaskHandler('archivist', 'detectDuplicates', detectDuplicates);
  registerTaskHandler('archivist', 'surfaceContradictions', surfaceContradictions);
  registerTaskHandler('archivist', 'suggestMerges', suggestMerges);
}

/**
 * Find notes that should be linked together
 */
async function suggestConnections(task: AgentTask): Promise<AgentTaskResult> {
  const notes = task.input.notes as Note[];
  const suggestions: AgentSuggestion[] = [];
  const log: string[] = [];

  log.push(`Analyzing ${notes.length} notes for potential connections...`);

  // Find notes without outgoing links
  const unlinkedNotes = notes.filter(
    (n) => !n.content.includes('[[') && n.content.length > 100
  );

  log.push(`Found ${unlinkedNotes.length} notes without outgoing links`);

  // For each unlinked note, find related notes
  for (const note of unlinkedNotes.slice(0, 10)) {
    // Limit to 10 to conserve API budget
    try {
      // Get other notes excluding current one
      const otherNotes = notes.filter(n => n.id !== note.id);
      const related = await findRelatedNotes(note, otherNotes);

      // Take top 3 results
      for (const relatedResult of related.slice(0, 3)) {
        const targetNote = notes.find(n => n.id === relatedResult.noteId);
        if (!targetNote) continue;

        // Check if link already exists in either direction
        const linkExists =
          note.content.includes(`[[${targetNote.title}]]`) ||
          targetNote.content.includes(`[[${note.title}]]`);

        if (!linkExists) {
          const suggestion = createSuggestion(
            'archivist',
            'connect_notes',
            `Link "${note.title}" to "${targetNote.title}"`,
            `${relatedResult.reason} (similarity: ${Math.round(relatedResult.score * 100)}%)`,
            {
              sourceNoteId: note.id,
              sourceNoteTitle: note.title,
              targetNoteId: targetNote.id,
              targetNoteTitle: targetNote.title,
            },
            3
          );
          suggestions.push(suggestion);
          log.push(
            `Suggested linking "${note.title}" to "${targetNote.title}"`
          );
        }
      }
    } catch (error) {
      log.push(`Error finding related notes for "${note.title}": ${error}`);
    }
  }

  return {
    suggestions,
    summary: `Found ${suggestions.length} potential connections between notes`,
    log,
  };
}

/**
 * Find near-duplicate notes that could be merged
 */
async function detectDuplicates(task: AgentTask): Promise<AgentTaskResult> {
  const notes = task.input.notes as Note[];
  const suggestions: AgentSuggestion[] = [];
  const log: string[] = [];
  const SIMILARITY_THRESHOLD = 0.85;

  log.push(`Analyzing ${notes.length} notes for duplicates...`);

  // Get embeddings for all notes
  const embeddings: Map<string, number[]> = new Map();

  for (const note of notes) {
    if (note.content.length < 50) continue; // Skip very short notes

    try {
      const embedding = await getEmbeddingForNote(note);
      if (embedding && embedding.length > 0) {
        embeddings.set(note.id, embedding);
      }
    } catch (error) {
      log.push(`Error getting embedding for "${note.title}": ${error}`);
    }
  }

  log.push(`Got embeddings for ${embeddings.size} notes`);

  // Compare all pairs
  const noteIds = Array.from(embeddings.keys());
  const checkedPairs = new Set<string>();

  for (let i = 0; i < noteIds.length; i++) {
    for (let j = i + 1; j < noteIds.length; j++) {
      const id1 = noteIds[i];
      const id2 = noteIds[j];
      const pairKey = [id1, id2].sort().join(':');

      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      const emb1 = embeddings.get(id1)!;
      const emb2 = embeddings.get(id2)!;
      const similarity = cosineSimilarity(emb1, emb2);

      if (similarity >= SIMILARITY_THRESHOLD) {
        const note1 = notes.find((n) => n.id === id1)!;
        const note2 = notes.find((n) => n.id === id2)!;

        const suggestion = createSuggestion(
          'archivist',
          'remove_duplicate',
          `Possible duplicate: "${note1.title}" and "${note2.title}"`,
          `These notes have ${Math.round(similarity * 100)}% similarity and may contain duplicate content.`,
          {
            note1Id: id1,
            note1Title: note1.title,
            note2Id: id2,
            note2Title: note2.title,
            similarity,
          },
          2 // Higher priority
        );
        suggestions.push(suggestion);
        log.push(
          `Found ${Math.round(similarity * 100)}% similarity between "${note1.title}" and "${note2.title}"`
        );
      }
    }
  }

  return {
    suggestions,
    summary: `Found ${suggestions.length} potential duplicate notes`,
    log,
  };
}

/**
 * Find conflicting information across notes
 */
async function surfaceContradictions(task: AgentTask): Promise<AgentTaskResult> {
  const notes = task.input.notes as Note[];
  const suggestions: AgentSuggestion[] = [];
  const log: string[] = [];

  log.push(`Analyzing ${notes.length} notes for contradictions...`);

  // Extract facts/claims from notes (simplified approach)
  // In production, this would use NLP to extract structured claims

  // Look for numeric claims
  const numericPatterns = /(\d+(?:,\d{3})*(?:\.\d+)?)\s+(percent|%|dollars?|\$|euros?|pounds?|users?|customers?|employees?|people|items?|hours?|days?|weeks?|months?|years?)/gi;

  // Group notes by topics (simplified: by shared tags or title keywords)
  const topicGroups = new Map<string, Note[]>();

  for (const note of notes) {
    // Group by tags
    for (const tag of note.tags || []) {
      if (!topicGroups.has(tag)) {
        topicGroups.set(tag, []);
      }
      topicGroups.get(tag)!.push(note);
    }

    // Group by title keywords
    const keywords = note.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    for (const keyword of keywords) {
      if (!topicGroups.has(keyword)) {
        topicGroups.set(keyword, []);
      }
      topicGroups.get(keyword)!.push(note);
    }
  }

  // Look for contradictions within topic groups
  for (const [topic, topicNotes] of topicGroups) {
    if (topicNotes.length < 2) continue;

    // Extract numeric claims from each note
    const claims: Array<{ note: Note; claim: string; value: string }> = [];

    for (const note of topicNotes) {
      let match;
      while ((match = numericPatterns.exec(note.content)) !== null) {
        claims.push({
          note,
          claim: match[0],
          value: match[1],
        });
      }
    }

    // Look for conflicting values about similar topics
    // (This is a simplified heuristic - real implementation would use NLP)
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const c1 = claims[i];
        const c2 = claims[j];

        if (c1.note.id === c2.note.id) continue;

        // Check if claims are about same thing but different values
        const unit1 = c1.claim.replace(c1.value, '').trim().toLowerCase();
        const unit2 = c2.claim.replace(c2.value, '').trim().toLowerCase();

        if (unit1 === unit2 && c1.value !== c2.value) {
          const suggestion = createSuggestion(
            'archivist',
            'contradiction',
            `Possible contradiction about ${unit1}`,
            `"${c1.note.title}" says "${c1.claim}" but "${c2.note.title}" says "${c2.claim}". You may want to verify which is correct.`,
            {
              note1Id: c1.note.id,
              note1Title: c1.note.title,
              note1Claim: c1.claim,
              note2Id: c2.note.id,
              note2Title: c2.note.title,
              note2Claim: c2.claim,
              topic,
            },
            2
          );
          suggestions.push(suggestion);
          log.push(
            `Found possible contradiction about ${unit1} between "${c1.note.title}" and "${c2.note.title}"`
          );
        }
      }
    }
  }

  return {
    suggestions,
    summary: `Found ${suggestions.length} potential contradictions`,
    log,
  };
}

/**
 * Identify notes that could be combined
 */
async function suggestMerges(task: AgentTask): Promise<AgentTaskResult> {
  const notes = task.input.notes as Note[];
  const suggestions: AgentSuggestion[] = [];
  const log: string[] = [];

  log.push(`Analyzing ${notes.length} notes for merge candidates...`);

  // Group notes by title prefix patterns
  const prefixGroups = new Map<string, Note[]>();

  for (const note of notes) {
    // Check for common prefix patterns
    const prefixMatch = note.title.match(/^([^:–-]+)[:–-]\s*/);
    if (prefixMatch) {
      const prefix = prefixMatch[1].trim().toLowerCase();
      if (!prefixGroups.has(prefix)) {
        prefixGroups.set(prefix, []);
      }
      prefixGroups.get(prefix)!.push(note);
    }
  }

  // Suggest merges for groups with multiple small notes
  for (const [prefix, groupNotes] of prefixGroups) {
    if (groupNotes.length < 3) continue;

    // Check if notes are relatively short
    const shortNotes = groupNotes.filter((n) => n.content.length < 500);

    if (shortNotes.length >= 3) {
      const suggestion = createSuggestion(
        'archivist',
        'merge_notes',
        `Consider merging ${shortNotes.length} "${prefix}" notes`,
        `You have ${shortNotes.length} short notes with the "${prefix}" prefix. Consolidating them might make the information easier to find and use.`,
        {
          noteIds: shortNotes.map((n) => n.id),
          noteTitles: shortNotes.map((n) => n.title),
          prefix,
        },
        3
      );
      suggestions.push(suggestion);
      log.push(`Suggested merging ${shortNotes.length} notes with prefix "${prefix}"`);
    }
  }

  // Also check for notes with very similar titles
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const title1 = notes[i].title.toLowerCase();
      const title2 = notes[j].title.toLowerCase();

      // Check Levenshtein-like similarity
      const similarity = calculateTitleSimilarity(title1, title2);

      if (similarity > 0.8 && notes[i].title !== notes[j].title) {
        const suggestion = createSuggestion(
          'archivist',
          'merge_notes',
          `Similar titles: "${notes[i].title}" and "${notes[j].title}"`,
          `These notes have very similar titles and might cover the same topic. Consider merging them.`,
          {
            noteIds: [notes[i].id, notes[j].id],
            noteTitles: [notes[i].title, notes[j].title],
            similarity,
          },
          4
        );
        suggestions.push(suggestion);
        log.push(
          `Found similar titles: "${notes[i].title}" and "${notes[j].title}" (${Math.round(similarity * 100)}%)`
        );
      }
    }
  }

  return {
    suggestions,
    summary: `Found ${suggestions.length} potential merge candidates`,
    log,
  };
}

/**
 * Calculate similarity between two titles
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(title2.split(/\s+/).filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }

  const union = new Set([...words1, ...words2]).size;
  return intersection / union;
}

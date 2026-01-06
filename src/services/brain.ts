/**
 * Knowledge Brain Service
 * Extracts concepts, entities, and relationships from notes to build an organizational brain.
 */

import { env } from '../config/env';
import type { Note } from '../types/note';

// Types for the Knowledge Brain
export interface Concept {
  id: string;
  name: string;
  type: ConceptType;
  description?: string;
  mentions: ConceptMention[];
  relatedConcepts: string[]; // IDs of related concepts
  createdAt: Date;
  updatedAt: Date;
}

export type ConceptType =
  | 'person'
  | 'organization'
  | 'project'
  | 'topic'
  | 'location'
  | 'event'
  | 'idea'
  | 'task'
  | 'date'
  | 'other';

export interface ConceptMention {
  noteId: string;
  noteTitle: string;
  context: string; // Surrounding text
  position: number; // Character position in note
}

export interface ConceptRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  strength: number; // 0-1, how strong the relationship is
  noteIds: string[]; // Notes where this relationship was found
}

export type RelationshipType =
  | 'related_to'
  | 'part_of'
  | 'works_with'
  | 'depends_on'
  | 'similar_to'
  | 'opposite_of'
  | 'leads_to'
  | 'mentioned_with';

export interface KnowledgeGraph {
  concepts: Concept[];
  relationships: ConceptRelationship[];
  lastUpdated: Date;
}

export interface BrainInsight {
  id: string;
  type: 'pattern' | 'gap' | 'connection' | 'trend';
  title: string;
  description: string;
  relatedConcepts: string[];
  relatedNotes: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ExtractionResult {
  concepts: ExtractedConcept[];
  relationships: ExtractedRelationship[];
}

interface ExtractedConcept {
  name: string;
  type: ConceptType;
  context: string;
}

interface ExtractedRelationship {
  source: string;
  target: string;
  type: RelationshipType;
}

// AI Provider utilities (reuse from ai.ts pattern)
function getProvider() {
  if (env.aiProvider === 'openai' && env.openai.apiKey) {
    return {
      type: 'openai' as const,
      apiKey: env.openai.apiKey,
      model: env.openai.model,
    };
  }
  if (env.aiProvider === 'anthropic' && env.anthropic.apiKey) {
    return {
      type: 'anthropic' as const,
      apiKey: env.anthropic.apiKey,
      model: env.anthropic.model,
    };
  }
  return null;
}

async function aiComplete(systemPrompt: string, userContent: string, maxTokens = 1024): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error('No AI provider configured');

  if (provider.type === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error('OpenAI API error');
    const data = await response.json();
    return data.choices[0]?.message?.content ?? '';
  }

  // Anthropic
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) throw new Error('Anthropic API error');
  const data = await response.json();
  return data.content[0]?.text ?? '';
}

const EXTRACTION_PROMPT = `Extract key concepts and their relationships from the following note.

Return a JSON object with this structure:
{
  "concepts": [
    {
      "name": "Concept name",
      "type": "person|organization|project|topic|location|event|idea|task|date|other",
      "context": "Brief context of how it's mentioned"
    }
  ],
  "relationships": [
    {
      "source": "Concept name",
      "target": "Another concept name",
      "type": "related_to|part_of|works_with|depends_on|similar_to|leads_to|mentioned_with"
    }
  ]
}

Focus on:
- People, organizations, and projects mentioned
- Key topics and themes
- Important dates and events
- Ideas and tasks
- How concepts relate to each other

Be selective - only extract truly significant concepts that would be useful for building a knowledge graph.`;

const INSIGHTS_PROMPT = `Analyze the following knowledge graph data and generate insights.

The data contains:
- Concepts extracted from multiple notes
- Relationships between concepts
- Frequency of mentions

Generate insights about:
1. Patterns: Recurring themes or connections
2. Gaps: Missing information or unexplored areas
3. Connections: Non-obvious relationships between concepts
4. Trends: How topics evolve or connect over time

Return a JSON array of insights:
[
  {
    "type": "pattern|gap|connection|trend",
    "title": "Brief title",
    "description": "Detailed description of the insight",
    "relatedConcepts": ["concept1", "concept2"],
    "priority": "high|medium|low"
  }
]

Focus on actionable, interesting insights that help the user understand their knowledge better.`;

/**
 * Extract concepts and relationships from a single note
 */
export async function extractFromNote(note: Note): Promise<ExtractionResult> {
  const provider = getProvider();

  if (!provider) {
    // Fallback: basic extraction without AI
    return extractFromNoteFallback(note);
  }

  try {
    const content = `Title: ${note.title}\n\nContent:\n${note.content}`;
    const response = await aiComplete(EXTRACTION_PROMPT, content, 1024);

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Could not parse extraction response');
      return extractFromNoteFallback(note);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      concepts: parsed.concepts || [],
      relationships: parsed.relationships || [],
    };
  } catch (error) {
    console.error('Extraction failed:', error);
    return extractFromNoteFallback(note);
  }
}

/**
 * Fallback extraction using regex patterns (no AI)
 */
function extractFromNoteFallback(note: Note): ExtractionResult {
  const content = note.title + ' ' + note.content;
  const concepts: ExtractedConcept[] = [];

  // Extract potential names (capitalized words)
  const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
  const names = content.match(namePattern) || [];
  names.forEach(name => {
    if (!concepts.find(c => c.name === name)) {
      concepts.push({
        name,
        type: 'person',
        context: getContext(content, name),
      });
    }
  });

  // Extract dates
  const datePattern = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\b/gi;
  const dates = content.match(datePattern) || [];
  dates.forEach(date => {
    concepts.push({
      name: date,
      type: 'date',
      context: getContext(content, date),
    });
  });

  // Extract project-like references (words followed by "project", "initiative", etc.)
  const projectPattern = /\b([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)\s+(?:project|initiative|program|system)\b/gi;
  let match;
  while ((match = projectPattern.exec(content)) !== null) {
    const name = match[1] + ' ' + match[0].split(' ').pop();
    if (!concepts.find(c => c.name === name)) {
      concepts.push({
        name,
        type: 'project',
        context: getContext(content, match[0]),
      });
    }
  }

  // Extract hashtags as topics
  const hashtagPattern = /#([a-zA-Z][a-zA-Z0-9_-]*)/g;
  while ((match = hashtagPattern.exec(content)) !== null) {
    concepts.push({
      name: match[1],
      type: 'topic',
      context: getContext(content, match[0]),
    });
  }

  // Extract TODO/task items
  const taskPattern = /(?:TODO|TASK|ACTION):\s*(.+?)(?:\n|$)/gi;
  while ((match = taskPattern.exec(content)) !== null) {
    concepts.push({
      name: match[1].trim().substring(0, 50),
      type: 'task',
      context: match[0],
    });
  }

  return {
    concepts: concepts.slice(0, 20), // Limit to prevent noise
    relationships: [],
  };
}

function getContext(content: string, term: string): string {
  const index = content.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return '';

  const start = Math.max(0, index - 30);
  const end = Math.min(content.length, index + term.length + 30);
  return content.substring(start, end).replace(/\n/g, ' ').trim();
}

/**
 * Build a knowledge graph from multiple notes
 */
export async function buildKnowledgeGraph(notes: Note[]): Promise<KnowledgeGraph> {
  const conceptMap = new Map<string, Concept>();
  const relationshipMap = new Map<string, ConceptRelationship>();

  for (const note of notes) {
    const extraction = await extractFromNote(note);

    // Process concepts
    for (const extracted of extraction.concepts) {
      const key = extracted.name.toLowerCase();

      if (conceptMap.has(key)) {
        // Update existing concept
        const existing = conceptMap.get(key)!;
        existing.mentions.push({
          noteId: note.id,
          noteTitle: note.title,
          context: extracted.context,
          position: note.content.toLowerCase().indexOf(extracted.name.toLowerCase()),
        });
        existing.updatedAt = new Date();
      } else {
        // Create new concept
        conceptMap.set(key, {
          id: generateId(),
          name: extracted.name,
          type: extracted.type,
          mentions: [{
            noteId: note.id,
            noteTitle: note.title,
            context: extracted.context,
            position: note.content.toLowerCase().indexOf(extracted.name.toLowerCase()),
          }],
          relatedConcepts: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Process relationships
    for (const rel of extraction.relationships) {
      const sourceKey = rel.source.toLowerCase();
      const targetKey = rel.target.toLowerCase();
      const relKey = `${sourceKey}-${rel.type}-${targetKey}`;

      if (conceptMap.has(sourceKey) && conceptMap.has(targetKey)) {
        if (relationshipMap.has(relKey)) {
          const existing = relationshipMap.get(relKey)!;
          if (!existing.noteIds.includes(note.id)) {
            existing.noteIds.push(note.id);
            existing.strength = Math.min(1, existing.strength + 0.1);
          }
        } else {
          relationshipMap.set(relKey, {
            id: generateId(),
            sourceId: conceptMap.get(sourceKey)!.id,
            targetId: conceptMap.get(targetKey)!.id,
            type: rel.type,
            strength: 0.5,
            noteIds: [note.id],
          });
        }

        // Update related concepts
        const source = conceptMap.get(sourceKey)!;
        const target = conceptMap.get(targetKey)!;
        if (!source.relatedConcepts.includes(target.id)) {
          source.relatedConcepts.push(target.id);
        }
        if (!target.relatedConcepts.includes(source.id)) {
          target.relatedConcepts.push(source.id);
        }
      }
    }
  }

  // Add co-occurrence relationships for concepts in same note
  const noteConceptMap = new Map<string, string[]>();
  for (const [key, concept] of conceptMap) {
    for (const mention of concept.mentions) {
      const noteKey = mention.noteId;
      if (!noteConceptMap.has(noteKey)) {
        noteConceptMap.set(noteKey, []);
      }
      noteConceptMap.get(noteKey)!.push(key);
    }
  }

  for (const [noteId, conceptKeys] of noteConceptMap) {
    for (let i = 0; i < conceptKeys.length; i++) {
      for (let j = i + 1; j < conceptKeys.length; j++) {
        const sourceKey = conceptKeys[i];
        const targetKey = conceptKeys[j];
        const relKey = `${sourceKey}-mentioned_with-${targetKey}`;

        if (!relationshipMap.has(relKey)) {
          const source = conceptMap.get(sourceKey)!;
          const target = conceptMap.get(targetKey)!;
          relationshipMap.set(relKey, {
            id: generateId(),
            sourceId: source.id,
            targetId: target.id,
            type: 'mentioned_with',
            strength: 0.3,
            noteIds: [noteId],
          });
        }
      }
    }
  }

  return {
    concepts: Array.from(conceptMap.values()),
    relationships: Array.from(relationshipMap.values()),
    lastUpdated: new Date(),
  };
}

/**
 * Generate insights from the knowledge graph
 */
export async function generateInsights(
  graph: KnowledgeGraph,
  notes: Note[]
): Promise<BrainInsight[]> {
  const provider = getProvider();

  if (!provider) {
    return generateInsightsFallback(graph);
  }

  try {
    // Prepare graph summary for AI
    const conceptSummary = graph.concepts
      .sort((a, b) => b.mentions.length - a.mentions.length)
      .slice(0, 30)
      .map(c => `${c.name} (${c.type}, ${c.mentions.length} mentions)`)
      .join('\n');

    const relationshipSummary = graph.relationships
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 20)
      .map(r => {
        const source = graph.concepts.find(c => c.id === r.sourceId)?.name;
        const target = graph.concepts.find(c => c.id === r.targetId)?.name;
        return `${source} --[${r.type}]--> ${target}`;
      })
      .join('\n');

    const content = `Concepts:\n${conceptSummary}\n\nRelationships:\n${relationshipSummary}`;
    const response = await aiComplete(INSIGHTS_PROMPT, content, 1024);

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return generateInsightsFallback(graph);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((insight: { type: string; title: string; description: string; relatedConcepts: string[]; priority: string }) => ({
      id: generateId(),
      type: insight.type as BrainInsight['type'],
      title: insight.title,
      description: insight.description,
      relatedConcepts: insight.relatedConcepts,
      relatedNotes: [],
      priority: insight.priority as BrainInsight['priority'],
    }));
  } catch (error) {
    console.error('Generate insights failed:', error);
    return generateInsightsFallback(graph);
  }
}

/**
 * Fallback insights without AI
 */
function generateInsightsFallback(graph: KnowledgeGraph): BrainInsight[] {
  const insights: BrainInsight[] = [];

  // Find most connected concepts
  const connectionCounts = new Map<string, number>();
  for (const rel of graph.relationships) {
    connectionCounts.set(rel.sourceId, (connectionCounts.get(rel.sourceId) || 0) + 1);
    connectionCounts.set(rel.targetId, (connectionCounts.get(rel.targetId) || 0) + 1);
  }

  const topConnected = [...connectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (topConnected.length > 0) {
    const topConcept = graph.concepts.find(c => c.id === topConnected[0][0]);
    if (topConcept) {
      insights.push({
        id: generateId(),
        type: 'pattern',
        title: `"${topConcept.name}" is a central concept`,
        description: `This ${topConcept.type} appears frequently and connects to ${topConnected[0][1]} other concepts in your notes.`,
        relatedConcepts: [topConcept.id],
        relatedNotes: topConcept.mentions.map(m => m.noteId),
        priority: 'high',
      });
    }
  }

  // Find concepts mentioned many times but with few relationships
  const isolatedConcepts = graph.concepts
    .filter(c => c.mentions.length >= 3 && c.relatedConcepts.length < 2)
    .slice(0, 2);

  for (const concept of isolatedConcepts) {
    insights.push({
      id: generateId(),
      type: 'gap',
      title: `"${concept.name}" could be better connected`,
      description: `This ${concept.type} is mentioned ${concept.mentions.length} times but has few connections. Consider linking related notes.`,
      relatedConcepts: [concept.id],
      relatedNotes: concept.mentions.map(m => m.noteId),
      priority: 'medium',
    });
  }

  // Find clusters of related concepts
  const clusters = findClusters(graph);
  if (clusters.length > 0) {
    const largestCluster = clusters[0];
    const clusterConcepts = largestCluster
      .map(id => graph.concepts.find(c => c.id === id)?.name)
      .filter(Boolean)
      .slice(0, 4);

    if (clusterConcepts.length >= 3) {
      insights.push({
        id: generateId(),
        type: 'connection',
        title: 'Related concept cluster found',
        description: `These concepts often appear together: ${clusterConcepts.join(', ')}. They might represent a project or theme.`,
        relatedConcepts: largestCluster.slice(0, 5),
        relatedNotes: [],
        priority: 'medium',
      });
    }
  }

  return insights;
}

/**
 * Find clusters of related concepts
 */
function findClusters(graph: KnowledgeGraph): string[][] {
  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const concept of graph.concepts) {
    if (visited.has(concept.id)) continue;

    const cluster: string[] = [];
    const queue = [concept.id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      cluster.push(current);

      const currentConcept = graph.concepts.find(c => c.id === current);
      if (currentConcept) {
        for (const relatedId of currentConcept.relatedConcepts) {
          if (!visited.has(relatedId)) {
            queue.push(relatedId);
          }
        }
      }
    }

    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }

  return clusters.sort((a, b) => b.length - a.length);
}

/**
 * Search concepts by name or type
 */
export function searchConcepts(
  graph: KnowledgeGraph,
  query: string,
  type?: ConceptType
): Concept[] {
  const lowerQuery = query.toLowerCase();

  return graph.concepts.filter(concept => {
    const matchesQuery = concept.name.toLowerCase().includes(lowerQuery);
    const matchesType = !type || concept.type === type;
    return matchesQuery && matchesType;
  });
}

/**
 * Get concepts related to a specific note
 */
export function getConceptsForNote(graph: KnowledgeGraph, noteId: string): Concept[] {
  return graph.concepts.filter(concept =>
    concept.mentions.some(m => m.noteId === noteId)
  );
}

/**
 * Get notes related to a specific concept
 */
export function getNotesForConcept(concept: Concept): string[] {
  return [...new Set(concept.mentions.map(m => m.noteId))];
}

// Utility function to generate IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Check if brain features are available
 */
export function isBrainAvailable(): boolean {
  return !!(env.aiProvider && (env.openai.apiKey || env.anthropic.apiKey));
}

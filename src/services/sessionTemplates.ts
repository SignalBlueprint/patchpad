/**
 * Session Templates Service
 *
 * Manages session templates including built-in templates and user-created ones.
 */

import type { SessionTemplate, CanvasLayout, WorkflowStep } from '../types/sessionTemplate';

const TEMPLATES_STORAGE_KEY = 'patchpad_session_templates';

// Built-in templates
const BRAINSTORMING_TEMPLATE: SessionTemplate = {
  id: 'brainstorming',
  name: 'Brainstorming',
  description: 'Rapid idea capture with free-form canvas. Perfect for exploring new concepts and generating ideas without constraints.',
  color: '#10B981', // emerald
  icon: 'brainstorm',
  layout: {
    type: 'radial',
    initialZoom: 0.8,
    radialConfig: {
      centerLabel: 'Central Theme',
      rings: 3,
      sectorsPerRing: 6,
    },
    zones: [
      {
        id: 'center',
        label: 'Main Topic',
        color: '#10B981',
        x: 40,
        y: 40,
        width: 20,
        height: 20,
        placeholder: 'Drop your central idea here',
      },
      {
        id: 'ideas',
        label: 'Ideas Zone',
        color: '#34D399',
        x: 10,
        y: 10,
        width: 80,
        height: 80,
        placeholder: 'Scatter ideas freely',
      },
    ],
  },
  workflow: [
    {
      order: 1,
      title: 'Set the Theme',
      description: 'Place your main topic or question in the center of the canvas',
      estimatedMinutes: 2,
      tips: ['Keep it concise - one sentence max', 'Make it a question for better exploration'],
    },
    {
      order: 2,
      title: 'Rapid Capture',
      description: 'Generate as many ideas as possible without judgment',
      estimatedMinutes: 10,
      tips: ['Quantity over quality', 'No idea is too wild', 'Build on previous ideas'],
    },
    {
      order: 3,
      title: 'Cluster & Connect',
      description: 'Group related ideas together and draw connections',
      estimatedMinutes: 5,
      tips: ['Look for patterns', 'Identify unexpected connections'],
    },
    {
      order: 4,
      title: 'Identify Winners',
      description: 'Highlight the most promising ideas for further exploration',
      estimatedMinutes: 3,
      tips: ['Mark favorites', 'Note why each idea stands out'],
    },
  ],
  autoTags: ['brainstorm', 'ideation'],
  isBuiltIn: true,
};

const PROBLEM_SOLVING_TEMPLATE: SessionTemplate = {
  id: 'problem-solving',
  name: 'Problem Solving',
  description: 'Structured approach for tackling complex problems. Breaks down the problem, explores causes, and develops solutions.',
  color: '#F59E0B', // amber
  icon: 'problem',
  layout: {
    type: 'columns',
    initialZoom: 0.9,
    columnConfig: {
      columns: [
        { id: 'problem', label: 'Problem', color: '#F59E0B', width: 25 },
        { id: 'causes', label: 'Root Causes', color: '#FBBF24', width: 25 },
        { id: 'solutions', label: 'Solutions', color: '#34D399', width: 25 },
        { id: 'actions', label: 'Action Items', color: '#3B82F6', width: 25 },
      ],
      spacing: 20,
    },
    zones: [
      {
        id: 'problem-zone',
        label: 'Problem Statement',
        color: '#F59E0B',
        x: 0,
        y: 0,
        width: 25,
        height: 100,
        placeholder: 'What is the problem?',
      },
      {
        id: 'causes-zone',
        label: 'Root Causes',
        color: '#FBBF24',
        x: 25,
        y: 0,
        width: 25,
        height: 100,
        placeholder: 'Why is this happening?',
      },
      {
        id: 'solutions-zone',
        label: 'Possible Solutions',
        color: '#34D399',
        x: 50,
        y: 0,
        width: 25,
        height: 100,
        placeholder: 'How can we fix it?',
      },
      {
        id: 'actions-zone',
        label: 'Action Items',
        color: '#3B82F6',
        x: 75,
        y: 0,
        width: 25,
        height: 100,
        placeholder: 'What do we do next?',
      },
    ],
  },
  workflow: [
    {
      order: 1,
      title: 'Define the Problem',
      description: 'Write a clear problem statement. What exactly is wrong?',
      estimatedMinutes: 5,
      tips: ['Be specific', 'Include impact and scope', 'Avoid assuming solutions'],
    },
    {
      order: 2,
      title: 'Analyze Root Causes',
      description: 'Ask "Why?" repeatedly to uncover underlying causes',
      estimatedMinutes: 10,
      tips: ['Use the 5 Whys technique', 'Look for systemic issues', 'Consider multiple perspectives'],
    },
    {
      order: 3,
      title: 'Generate Solutions',
      description: 'Brainstorm potential solutions for each root cause',
      estimatedMinutes: 10,
      tips: ['One solution per cause', 'Consider feasibility', 'Think short-term and long-term'],
    },
    {
      order: 4,
      title: 'Plan Actions',
      description: 'Convert best solutions into concrete action items',
      estimatedMinutes: 5,
      tips: ['Assign owners', 'Set deadlines', 'Define success criteria'],
    },
  ],
  autoTags: ['problem-solving', 'analysis'],
  isBuiltIn: true,
};

const REVIEW_TEMPLATE: SessionTemplate = {
  id: 'review',
  name: 'Review & Organize',
  description: 'Review existing notes, identify connections, and organize your knowledge. Great for regular knowledge maintenance.',
  color: '#8B5CF6', // violet
  icon: 'review',
  layout: {
    type: 'kanban',
    initialZoom: 0.85,
    columnConfig: {
      columns: [
        { id: 'review', label: 'To Review', color: '#8B5CF6', width: 20 },
        { id: 'update', label: 'Needs Update', color: '#F59E0B', width: 20 },
        { id: 'connect', label: 'To Connect', color: '#3B82F6', width: 20 },
        { id: 'archive', label: 'To Archive', color: '#6B7280', width: 20 },
        { id: 'done', label: 'Reviewed', color: '#10B981', width: 20 },
      ],
      spacing: 16,
    },
    zones: [
      {
        id: 'review-zone',
        label: 'To Review',
        color: '#8B5CF6',
        x: 0,
        y: 0,
        width: 20,
        height: 100,
        placeholder: 'Drag notes here to review',
      },
      {
        id: 'update-zone',
        label: 'Needs Update',
        color: '#F59E0B',
        x: 20,
        y: 0,
        width: 20,
        height: 100,
        placeholder: 'Outdated information',
      },
      {
        id: 'connect-zone',
        label: 'To Connect',
        color: '#3B82F6',
        x: 40,
        y: 0,
        width: 20,
        height: 100,
        placeholder: 'Missing links',
      },
      {
        id: 'archive-zone',
        label: 'To Archive',
        color: '#6B7280',
        x: 60,
        y: 0,
        width: 20,
        height: 100,
        placeholder: 'No longer relevant',
      },
      {
        id: 'done-zone',
        label: 'Reviewed',
        color: '#10B981',
        x: 80,
        y: 0,
        width: 20,
        height: 100,
        placeholder: 'All good!',
      },
    ],
  },
  workflow: [
    {
      order: 1,
      title: 'Load Notes',
      description: 'Bring in notes from a specific topic or time period',
      estimatedMinutes: 2,
      tips: ['Focus on one topic at a time', 'Start with oldest notes'],
    },
    {
      order: 2,
      title: 'Triage',
      description: 'Quickly scan each note and categorize it',
      estimatedMinutes: 10,
      tips: ['Spend max 30 seconds per note', 'Trust your gut'],
    },
    {
      order: 3,
      title: 'Update Content',
      description: 'Refresh outdated notes with current information',
      estimatedMinutes: 15,
      tips: ['Add timestamps to updates', 'Link to newer notes'],
    },
    {
      order: 4,
      title: 'Create Connections',
      description: 'Add wiki links between related notes',
      estimatedMinutes: 10,
      tips: ['Look for implicit references', 'Build topic clusters'],
    },
  ],
  autoTags: ['review', 'organization'],
  isBuiltIn: true,
};

const FREEFORM_TEMPLATE: SessionTemplate = {
  id: 'freeform',
  name: 'Freeform',
  description: 'No structure, just a blank canvas. Use when you want complete freedom.',
  color: '#6B7280', // gray
  icon: 'freeform',
  layout: {
    type: 'freeform',
    initialZoom: 1,
  },
  workflow: [
    {
      order: 1,
      title: 'Start Creating',
      description: 'Add notes wherever inspiration strikes',
      tips: ['No rules here!'],
    },
  ],
  autoTags: [],
  isBuiltIn: true,
};

const BUILT_IN_TEMPLATES: SessionTemplate[] = [
  BRAINSTORMING_TEMPLATE,
  PROBLEM_SOLVING_TEMPLATE,
  REVIEW_TEMPLATE,
  FREEFORM_TEMPLATE,
];

// In-memory cache
let templatesCache: SessionTemplate[] | null = null;

/**
 * Get all templates (built-in + user-created)
 */
export function getAllTemplates(): SessionTemplate[] {
  if (templatesCache) return templatesCache;

  const userTemplates = loadUserTemplates();
  templatesCache = [...BUILT_IN_TEMPLATES, ...userTemplates];
  return templatesCache;
}

/**
 * Get built-in templates only
 */
export function getBuiltInTemplates(): SessionTemplate[] {
  return BUILT_IN_TEMPLATES;
}

/**
 * Get user-created templates only
 */
export function getUserTemplates(): SessionTemplate[] {
  return loadUserTemplates();
}

/**
 * Get a specific template by ID
 */
export function getTemplate(templateId: string): SessionTemplate | null {
  return getAllTemplates().find((t) => t.id === templateId) || null;
}

/**
 * Load user templates from storage
 */
function loadUserTemplates(): SessionTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((t: Record<string, unknown>) => ({
        ...t,
        createdAt: t.createdAt ? new Date(t.createdAt as string) : undefined,
      }));
    }
  } catch (error) {
    console.error('Failed to load user templates:', error);
  }
  return [];
}

/**
 * Save user templates to storage
 */
function saveUserTemplates(templates: SessionTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    templatesCache = null; // Invalidate cache
  } catch (error) {
    console.error('Failed to save user templates:', error);
  }
}

/**
 * Create a new user template
 */
export function createTemplate(
  template: Omit<SessionTemplate, 'id' | 'isBuiltIn' | 'createdAt'>
): SessionTemplate {
  const newTemplate: SessionTemplate = {
    ...template,
    id: `user-${Date.now()}`,
    isBuiltIn: false,
    createdAt: new Date(),
  };

  const userTemplates = loadUserTemplates();
  userTemplates.push(newTemplate);
  saveUserTemplates(userTemplates);

  return newTemplate;
}

/**
 * Update a user template
 */
export function updateTemplate(
  templateId: string,
  updates: Partial<SessionTemplate>
): SessionTemplate | null {
  const userTemplates = loadUserTemplates();
  const index = userTemplates.findIndex((t) => t.id === templateId);

  if (index === -1) return null;

  userTemplates[index] = {
    ...userTemplates[index],
    ...updates,
    id: templateId, // Preserve ID
    isBuiltIn: false, // User templates can never be built-in
  };

  saveUserTemplates(userTemplates);
  return userTemplates[index];
}

/**
 * Delete a user template
 */
export function deleteTemplate(templateId: string): boolean {
  // Cannot delete built-in templates
  if (BUILT_IN_TEMPLATES.some((t) => t.id === templateId)) {
    return false;
  }

  const userTemplates = loadUserTemplates();
  const index = userTemplates.findIndex((t) => t.id === templateId);

  if (index === -1) return false;

  userTemplates.splice(index, 1);
  saveUserTemplates(userTemplates);

  return true;
}

/**
 * Duplicate a template (creates a user template copy)
 */
export function duplicateTemplate(templateId: string): SessionTemplate | null {
  const original = getTemplate(templateId);
  if (!original) return null;

  return createTemplate({
    ...original,
    name: `${original.name} (Copy)`,
    icon: 'custom',
  });
}

/**
 * Calculate initial note positions based on layout
 */
export function calculateLayoutPositions(
  layout: CanvasLayout,
  noteCount: number,
  canvasWidth: number = 2000,
  canvasHeight: number = 1500
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];

  switch (layout.type) {
    case 'grid': {
      const cols = layout.gridConfig?.columns || Math.ceil(Math.sqrt(noteCount));
      const spacing = layout.gridConfig?.spacing || 250;
      const startX = (canvasWidth - cols * spacing) / 2;
      const startY = 100;

      for (let i = 0; i < noteCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.push({
          x: startX + col * spacing,
          y: startY + row * spacing,
        });
      }
      break;
    }

    case 'radial': {
      const config = layout.radialConfig;
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const ringSpacing = 200;

      // First position is center
      positions.push({ x: centerX - 100, y: centerY - 75 });

      // Remaining positions in rings
      let noteIndex = 1;
      const rings = config?.rings || 3;
      const sectorsPerRing = config?.sectorsPerRing || 6;

      for (let ring = 1; ring <= rings && noteIndex < noteCount; ring++) {
        const radius = ring * ringSpacing;
        const sectors = Math.min(sectorsPerRing * ring, noteCount - noteIndex);
        const angleStep = (2 * Math.PI) / sectors;

        for (let sector = 0; sector < sectors && noteIndex < noteCount; sector++) {
          const angle = sector * angleStep - Math.PI / 2; // Start from top
          positions.push({
            x: centerX + radius * Math.cos(angle) - 100,
            y: centerY + radius * Math.sin(angle) - 75,
          });
          noteIndex++;
        }
      }
      break;
    }

    case 'columns':
    case 'kanban': {
      const columns = layout.columnConfig?.columns || [];
      const colCount = columns.length || 3;
      const spacing = layout.columnConfig?.spacing || 20;
      const colWidth = (canvasWidth - spacing * (colCount + 1)) / colCount;
      const noteHeight = 150;
      const noteSpacing = 20;

      for (let i = 0; i < noteCount; i++) {
        const col = i % colCount;
        const row = Math.floor(i / colCount);
        positions.push({
          x: spacing + col * (colWidth + spacing),
          y: 100 + row * (noteHeight + noteSpacing),
        });
      }
      break;
    }

    case 'freeform':
    default: {
      // Random scatter with some spacing
      const margin = 200;
      const gridSize = Math.ceil(Math.sqrt(noteCount));
      const cellWidth = (canvasWidth - margin * 2) / gridSize;
      const cellHeight = (canvasHeight - margin * 2) / gridSize;

      for (let i = 0; i < noteCount; i++) {
        const col = i % gridSize;
        const row = Math.floor(i / gridSize);
        // Add some randomness within each cell
        const jitterX = (Math.random() - 0.5) * cellWidth * 0.4;
        const jitterY = (Math.random() - 0.5) * cellHeight * 0.4;
        positions.push({
          x: margin + col * cellWidth + cellWidth / 2 + jitterX,
          y: margin + row * cellHeight + cellHeight / 2 + jitterY,
        });
      }
      break;
    }
  }

  return positions;
}

/**
 * Get the workflow for a template
 */
export function getTemplateWorkflow(templateId: string): WorkflowStep[] {
  const template = getTemplate(templateId);
  return template?.workflow || [];
}

/**
 * Get total estimated time for a template workflow
 */
export function getWorkflowEstimatedTime(templateId: string): number {
  const workflow = getTemplateWorkflow(templateId);
  return workflow.reduce((sum, step) => sum + (step.estimatedMinutes || 0), 0);
}

/**
 * Get icon color class for template
 */
export function getTemplateIconClass(template: SessionTemplate): string {
  const colorMap: Record<string, string> = {
    '#10B981': 'text-emerald-500 bg-emerald-100',
    '#F59E0B': 'text-amber-500 bg-amber-100',
    '#8B5CF6': 'text-violet-500 bg-violet-100',
    '#6B7280': 'text-gray-500 bg-gray-100',
    '#3B82F6': 'text-blue-500 bg-blue-100',
    '#EF4444': 'text-red-500 bg-red-100',
  };
  return colorMap[template.color] || 'text-gray-500 bg-gray-100';
}

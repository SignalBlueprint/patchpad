/**
 * Session Template Types
 *
 * Templates for different thinking session modes that set up the canvas
 * with predefined layouts and suggested workflows.
 */

export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  /** Color theme for the template */
  color: string;
  /** Icon identifier */
  icon: 'brainstorm' | 'problem' | 'review' | 'freeform' | 'custom';
  /** Initial canvas layout configuration */
  layout: CanvasLayout;
  /** Suggested workflow steps */
  workflow: WorkflowStep[];
  /** Tags to auto-apply to the session */
  autoTags: string[];
  /** Whether this is a built-in template */
  isBuiltIn: boolean;
  /** Created timestamp for user templates */
  createdAt?: Date;
}

export interface CanvasLayout {
  /** Layout type determines how notes are initially arranged */
  type: 'freeform' | 'grid' | 'radial' | 'columns' | 'kanban';
  /** Initial viewport zoom level */
  initialZoom: number;
  /** Zones for organizing notes */
  zones?: LayoutZone[];
  /** Grid configuration for grid layout */
  gridConfig?: {
    columns: number;
    spacing: number;
  };
  /** Column configuration for columns/kanban layout */
  columnConfig?: {
    columns: ColumnDefinition[];
    spacing: number;
  };
  /** Radial configuration for radial layout */
  radialConfig?: {
    centerLabel: string;
    rings: number;
    sectorsPerRing: number;
  };
}

export interface LayoutZone {
  id: string;
  label: string;
  color: string;
  /** Position as percentage of canvas (0-100) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Placeholder text for what goes here */
  placeholder?: string;
}

export interface ColumnDefinition {
  id: string;
  label: string;
  color: string;
  width: number; // percentage
}

export interface WorkflowStep {
  order: number;
  title: string;
  description: string;
  /** Estimated time in minutes */
  estimatedMinutes?: number;
  /** Tips for this step */
  tips?: string[];
}

/**
 * Session created from a template
 */
export interface TemplatedSession {
  templateId: string;
  templateName: string;
  currentWorkflowStep: number;
}

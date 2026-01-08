/**
 * Agent Framework Service
 *
 * Core framework for running Knowledge Agents.
 * Manages agent registry, task queue, and scheduling.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Agent,
  AgentId,
  AgentTask,
  AgentTaskResult,
  AgentSuggestion,
  AgentConfig,
  SuggestionType,
} from '../types/agent';

// Storage keys
const AGENTS_STORAGE_KEY = 'patchpad_agents';
const TASKS_STORAGE_KEY = 'patchpad_agent_tasks';
const SUGGESTIONS_STORAGE_KEY = 'patchpad_agent_suggestions';
const CONFIG_STORAGE_KEY = 'patchpad_agent_config';

// Default agent definitions
const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'archivist',
    name: 'Archivist',
    description: 'Organizes and connects your notes, finding relationships and suggesting links',
    icon: '📚',
    capabilities: [
      {
        id: 'suggestConnections',
        name: 'Suggest Connections',
        description: 'Find notes that should be linked together',
        enabled: true,
      },
      {
        id: 'detectDuplicates',
        name: 'Detect Duplicates',
        description: 'Find near-duplicate notes that could be merged',
        enabled: true,
      },
      {
        id: 'surfaceContradictions',
        name: 'Surface Contradictions',
        description: 'Find conflicting information across notes',
        enabled: true,
      },
      {
        id: 'suggestMerges',
        name: 'Suggest Merges',
        description: 'Identify notes that could be combined',
        enabled: true,
      },
    ],
    enabled: true,
    schedule: null, // Manual only for now
    permissions: ['read_notes', 'use_ai'],
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Monitors topics and creates briefings about your areas of interest',
    icon: '🔬',
    capabilities: [
      {
        id: 'createBriefing',
        name: 'Create Briefing',
        description: 'Generate daily or weekly briefings about your notes',
        enabled: true,
      },
      {
        id: 'findGaps',
        name: 'Find Knowledge Gaps',
        description: 'Identify topics where you might want more information',
        enabled: true,
      },
      {
        id: 'monitorTopic',
        name: 'Monitor Topics',
        description: 'Track external sources for topics you care about',
        enabled: false, // Requires web search
      },
    ],
    enabled: true,
    schedule: null,
    permissions: ['read_notes', 'create_notes', 'use_ai'],
  },
  {
    id: 'writer',
    name: 'Writer',
    description: 'Helps transform your notes into documents and improves writing',
    icon: '✍️',
    capabilities: [
      {
        id: 'suggestOutline',
        name: 'Suggest Outline',
        description: 'Propose structure for a topic based on your notes',
        enabled: true,
      },
      {
        id: 'draftDocument',
        name: 'Draft Document',
        description: 'Compile selected notes into a cohesive document',
        enabled: true,
      },
      {
        id: 'refineText',
        name: 'Refine Text',
        description: 'Improve writing quality and clarity',
        enabled: true,
      },
    ],
    enabled: true,
    schedule: null,
    permissions: ['read_notes', 'write_notes', 'create_notes', 'use_ai'],
  },
];

const DEFAULT_CONFIG: AgentConfig = {
  dailyBudget: 50, // API calls per day
  dailyUsed: 0,
  lastResetDate: new Date().toISOString().split('T')[0],
  backgroundEnabled: false,
  idleThreshold: 30 * 60 * 1000, // 30 minutes
};

// In-memory caches
let agentsCache: Agent[] | null = null;
let tasksCache: AgentTask[] | null = null;
let suggestionsCache: AgentSuggestion[] | null = null;
let configCache: AgentConfig | null = null;

// Task handlers registry
const taskHandlers = new Map<
  string,
  (task: AgentTask) => Promise<AgentTaskResult>
>();

/**
 * Get all agents
 */
export function getAgents(): Agent[] {
  if (agentsCache) return agentsCache;

  try {
    const stored = localStorage.getItem(AGENTS_STORAGE_KEY);
    if (stored) {
      agentsCache = JSON.parse(stored);
      return agentsCache!;
    }
  } catch (error) {
    console.error('Failed to load agents:', error);
  }

  // Initialize with defaults
  agentsCache = [...DEFAULT_AGENTS];
  saveAgents(agentsCache);
  return agentsCache;
}

/**
 * Save agents to storage
 */
function saveAgents(agents: Agent[]): void {
  agentsCache = agents;
  try {
    localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(agents));
  } catch (error) {
    console.error('Failed to save agents:', error);
  }
}

/**
 * Get agent by ID
 */
export function getAgent(agentId: AgentId): Agent | null {
  return getAgents().find((a) => a.id === agentId) || null;
}

/**
 * Update agent settings
 */
export function updateAgent(
  agentId: AgentId,
  updates: Partial<Pick<Agent, 'enabled' | 'schedule' | 'capabilities'>>
): Agent | null {
  const agents = getAgents();
  const index = agents.findIndex((a) => a.id === agentId);

  if (index === -1) return null;

  agents[index] = { ...agents[index], ...updates };
  saveAgents(agents);
  return agents[index];
}

/**
 * Get agent config
 */
export function getAgentConfig(): AgentConfig {
  if (configCache) {
    // Check if we need to reset daily usage
    const today = new Date().toISOString().split('T')[0];
    if (configCache.lastResetDate !== today) {
      configCache.dailyUsed = 0;
      configCache.lastResetDate = today;
      saveAgentConfig(configCache);
    }
    return configCache;
  }

  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      configCache = JSON.parse(stored);
      // Check daily reset
      const today = new Date().toISOString().split('T')[0];
      if (configCache!.lastResetDate !== today) {
        configCache!.dailyUsed = 0;
        configCache!.lastResetDate = today;
        saveAgentConfig(configCache!);
      }
      return configCache!;
    }
  } catch (error) {
    console.error('Failed to load agent config:', error);
  }

  configCache = { ...DEFAULT_CONFIG };
  saveAgentConfig(configCache);
  return configCache;
}

/**
 * Save agent config
 */
function saveAgentConfig(config: AgentConfig): void {
  configCache = config;
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save agent config:', error);
  }
}

/**
 * Update agent config
 */
export function updateAgentConfig(updates: Partial<AgentConfig>): AgentConfig {
  const config = getAgentConfig();
  const updated = { ...config, ...updates };
  saveAgentConfig(updated);
  return updated;
}

/**
 * Check if we have budget for API calls
 */
export function hasBudget(calls: number = 1): boolean {
  const config = getAgentConfig();
  return config.dailyUsed + calls <= config.dailyBudget;
}

/**
 * Use API budget
 */
export function useBudget(calls: number = 1): boolean {
  if (!hasBudget(calls)) return false;
  const config = getAgentConfig();
  config.dailyUsed += calls;
  saveAgentConfig(config);
  return true;
}

/**
 * Get all tasks
 */
export function getTasks(): AgentTask[] {
  if (tasksCache) return tasksCache;

  try {
    const stored = localStorage.getItem(TASKS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      tasksCache = parsed.map((t: Record<string, unknown>) => ({
        ...t,
        createdAt: new Date(t.createdAt as string),
        startedAt: t.startedAt ? new Date(t.startedAt as string) : undefined,
        completedAt: t.completedAt ? new Date(t.completedAt as string) : undefined,
      }));
      return tasksCache!;
    }
  } catch (error) {
    console.error('Failed to load tasks:', error);
  }

  tasksCache = [];
  return tasksCache;
}

/**
 * Save tasks to storage
 */
function saveTasks(tasks: AgentTask[]): void {
  tasksCache = tasks;
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error('Failed to save tasks:', error);
  }
}

/**
 * Create a new task
 */
export function createTask(
  agentId: AgentId,
  capabilityId: string,
  input: Record<string, unknown> = {}
): AgentTask {
  const task: AgentTask = {
    id: uuidv4(),
    agentId,
    capabilityId,
    status: 'pending',
    input,
    progress: 0,
    createdAt: new Date(),
  };

  const tasks = getTasks();
  tasks.push(task);
  saveTasks(tasks);

  return task;
}

/**
 * Update task status
 */
export function updateTask(
  taskId: string,
  updates: Partial<Pick<AgentTask, 'status' | 'progress' | 'result' | 'error'>>
): AgentTask | null {
  const tasks = getTasks();
  const index = tasks.findIndex((t) => t.id === taskId);

  if (index === -1) return null;

  const task = tasks[index];
  tasks[index] = {
    ...task,
    ...updates,
    startedAt:
      updates.status === 'running' && !task.startedAt ? new Date() : task.startedAt,
    completedAt:
      updates.status === 'completed' || updates.status === 'failed'
        ? new Date()
        : task.completedAt,
  };

  saveTasks(tasks);
  return tasks[index];
}

/**
 * Register a task handler
 */
export function registerTaskHandler(
  agentId: AgentId,
  capabilityId: string,
  handler: (task: AgentTask) => Promise<AgentTaskResult>
): void {
  const key = `${agentId}:${capabilityId}`;
  taskHandlers.set(key, handler);
}

/**
 * Run a task
 */
export async function runTask(taskId: string): Promise<AgentTaskResult | null> {
  const tasks = getTasks();
  const task = tasks.find((t) => t.id === taskId);

  if (!task) return null;
  if (task.status === 'running') return null;

  const handlerKey = `${task.agentId}:${task.capabilityId}`;
  const handler = taskHandlers.get(handlerKey);

  if (!handler) {
    updateTask(taskId, {
      status: 'failed',
      error: `No handler registered for ${handlerKey}`,
    });
    return null;
  }

  // Check budget
  if (!hasBudget()) {
    updateTask(taskId, {
      status: 'failed',
      error: 'Daily API budget exceeded',
    });
    return null;
  }

  try {
    updateTask(taskId, { status: 'running', progress: 0 });
    const result = await handler(task);
    useBudget();
    updateTask(taskId, { status: 'completed', progress: 100, result });
    return result;
  } catch (error) {
    updateTask(taskId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Run an agent capability directly
 */
export async function runAgent(
  agentId: AgentId,
  capabilityId: string,
  input: Record<string, unknown> = {}
): Promise<AgentTaskResult | null> {
  const agent = getAgent(agentId);
  if (!agent || !agent.enabled) return null;

  const capability = agent.capabilities.find((c) => c.id === capabilityId);
  if (!capability || !capability.enabled) return null;

  const task = createTask(agentId, capabilityId, input);
  return runTask(task.id);
}

/**
 * Get all suggestions
 */
export function getSuggestions(): AgentSuggestion[] {
  if (suggestionsCache) return suggestionsCache;

  try {
    const stored = localStorage.getItem(SUGGESTIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      suggestionsCache = parsed.map((s: Record<string, unknown>) => ({
        ...s,
        createdAt: new Date(s.createdAt as string),
      }));
      return suggestionsCache!;
    }
  } catch (error) {
    console.error('Failed to load suggestions:', error);
  }

  suggestionsCache = [];
  return suggestionsCache;
}

/**
 * Save suggestions to storage
 */
function saveSuggestions(suggestions: AgentSuggestion[]): void {
  suggestionsCache = suggestions;
  try {
    localStorage.setItem(SUGGESTIONS_STORAGE_KEY, JSON.stringify(suggestions));
  } catch (error) {
    console.error('Failed to save suggestions:', error);
  }
}

/**
 * Get pending suggestions (not reviewed)
 */
export function getPendingSuggestions(): AgentSuggestion[] {
  return getSuggestions()
    .filter((s) => !s.reviewed && !s.dismissed)
    .sort((a, b) => a.priority - b.priority || b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Create a suggestion
 */
export function createSuggestion(
  agentId: AgentId,
  type: SuggestionType,
  title: string,
  description: string,
  payload: Record<string, unknown>,
  priority: number = 3
): AgentSuggestion {
  const suggestion: AgentSuggestion = {
    id: uuidv4(),
    agentId,
    type,
    title,
    description,
    payload,
    priority,
    reviewed: false,
    applied: false,
    dismissed: false,
    createdAt: new Date(),
  };

  const suggestions = getSuggestions();
  suggestions.push(suggestion);
  saveSuggestions(suggestions);

  return suggestion;
}

/**
 * Apply a suggestion
 */
export function applySuggestion(suggestionId: string): AgentSuggestion | null {
  const suggestions = getSuggestions();
  const index = suggestions.findIndex((s) => s.id === suggestionId);

  if (index === -1) return null;

  suggestions[index] = {
    ...suggestions[index],
    reviewed: true,
    applied: true,
  };

  saveSuggestions(suggestions);
  return suggestions[index];
}

/**
 * Dismiss a suggestion
 */
export function dismissSuggestion(suggestionId: string): AgentSuggestion | null {
  const suggestions = getSuggestions();
  const index = suggestions.findIndex((s) => s.id === suggestionId);

  if (index === -1) return null;

  suggestions[index] = {
    ...suggestions[index],
    reviewed: true,
    dismissed: true,
  };

  saveSuggestions(suggestions);
  return suggestions[index];
}

/**
 * Clear old suggestions
 */
export function clearOldSuggestions(maxAgeDays: number = 30): void {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const suggestions = getSuggestions();
  const filtered = suggestions.filter(
    (s) => s.createdAt.getTime() > cutoff || (!s.reviewed && !s.dismissed)
  );
  saveSuggestions(filtered);
}

/**
 * Get tasks for an agent
 */
export function getTasksForAgent(agentId: AgentId): AgentTask[] {
  return getTasks()
    .filter((t) => t.agentId === agentId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get suggestions for an agent
 */
export function getSuggestionsForAgent(agentId: AgentId): AgentSuggestion[] {
  return getSuggestions()
    .filter((s) => s.agentId === agentId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

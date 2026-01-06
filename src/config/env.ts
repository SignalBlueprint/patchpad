// Environment configuration with type safety and defaults

export type AIProvider = 'openai' | 'anthropic' | 'mock';

export interface EnvConfig {
  aiProvider: AIProvider;
  openai: {
    apiKey: string | undefined;
    model: string;
  };
  anthropic: {
    apiKey: string | undefined;
    model: string;
  };
  features: {
    enableAutoSuggestions: boolean;
    idleTimeoutMs: number;
  };
}

function getEnvVar(key: string, defaultValue: string = ''): string {
  // Handle test environment where import.meta.env might be undefined
  if (typeof import.meta.env === 'undefined') {
    return defaultValue;
  }
  return import.meta.env[key] ?? defaultValue;
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  if (typeof import.meta.env === 'undefined') {
    return defaultValue;
  }
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

function getEnvNumber(key: string, defaultValue: number): number {
  if (typeof import.meta.env === 'undefined') {
    return defaultValue;
  }
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const env: EnvConfig = {
  aiProvider: (getEnvVar('VITE_AI_PROVIDER', 'mock') as AIProvider),
  openai: {
    apiKey: getEnvVar('VITE_OPENAI_API_KEY') || undefined,
    model: getEnvVar('VITE_OPENAI_MODEL', 'gpt-4o-mini'),
  },
  anthropic: {
    apiKey: getEnvVar('VITE_ANTHROPIC_API_KEY') || undefined,
    model: getEnvVar('VITE_ANTHROPIC_MODEL', 'claude-3-haiku-20240307'),
  },
  features: {
    enableAutoSuggestions: getEnvBool('VITE_ENABLE_AUTO_SUGGESTIONS', true),
    idleTimeoutMs: getEnvNumber('VITE_IDLE_TIMEOUT_MS', 3000),
  },
};

// Helper to check if real AI is available
export function hasAIProvider(): boolean {
  if (env.aiProvider === 'openai' && env.openai.apiKey) return true;
  if (env.aiProvider === 'anthropic' && env.anthropic.apiKey) return true;
  return false;
}

// Get the active API key based on provider
export function getActiveAPIKey(): string | undefined {
  if (env.aiProvider === 'openai') return env.openai.apiKey;
  if (env.aiProvider === 'anthropic') return env.anthropic.apiKey;
  return undefined;
}

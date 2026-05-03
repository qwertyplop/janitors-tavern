import type { ConnectionPreset, ChatCompletionPreset, RegexScript, UsageStats } from './types';
import { getAuthHeaders } from './auth';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options?.headers as Record<string, string> || {}),
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface ServerSettings {
  activeConnectionPreset: ConnectionPreset | null;
  activeChatCompletionPreset: ChatCompletionPreset | null;
  defaultPostProcessing: string;
  strictPlaceholderMessage: string;
  logging: {
    logRequests: boolean;
    logResponses: boolean;
    logRawRequestBody: boolean;
  };
  stats: UsageStats;
  timeUntilReset: { hours: number; minutes: number };
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

export interface ModelsResult {
  data?: Array<{ id: string; [key: string]: unknown }>;
  models?: string[];
  [key: string]: unknown;
}

export const api = {
  settings: {
    get: (): Promise<ServerSettings> => request<ServerSettings>('/settings'),
    update: (data: Partial<{
      activeConnectionPreset: ConnectionPreset | null;
      activeChatCompletionPreset: ChatCompletionPreset | null;
      activeRegexScripts: RegexScript[];
      defaultPostProcessing: string;
      strictPlaceholderMessage: string;
      logging: Record<string, boolean>;
    }>): Promise<{ success: boolean }> => request('/settings', { method: 'POST', body: JSON.stringify(data) }),
  },

  stats: {
    get: (): Promise<{ stats: UsageStats; timeUntilReset: { hours: number; minutes: number } }> =>
      request('/settings/stats'),
    reset: (): Promise<{ success: boolean; stats: UsageStats }> =>
      request('/settings/stats/reset', { method: 'POST' }),
  },

  proxy: {
    testConnection: (data: { baseUrl: string; apiKey: string; model: string }): Promise<TestConnectionResult> =>
      request<TestConnectionResult>('/proxy/test-connection', { method: 'POST', body: JSON.stringify(data) }),

    getModels: (data: { baseUrl: string; apiKey: string }): Promise<ModelsResult> =>
      request<ModelsResult>(`/proxy/models?baseUrl=${encodeURIComponent(data.baseUrl)}&apiKey=${encodeURIComponent(data.apiKey)}`),
  },

  apiKey: {
    get: (): Promise<{ apiKey: string }> => request('/auth/api-key'),
    rotate: (): Promise<{ success: boolean; apiKey: string }> =>
      request('/auth/api-key/rotate', { method: 'POST' }),
  },

  keyStats: {
    get: (): Promise<{ keyStats: Array<{ keyId: string; name: string; usageCount: number; isLastUsed: boolean }> }> =>
      request('/settings/key-stats'),
  },
};

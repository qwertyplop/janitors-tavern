import type { ServerState, ConnectionPreset, ChatCompletionPreset, RegexScript, PromptPostProcessingMode, UsageStats } from './types.js';

const RESET_HOUR_UTC = 7;

function getDefaultStats(): UsageStats {
  return {
    totalRequests: 0,
    totalTokens: 0,
    dailyRequests: 0,
    dailyTokens: 0,
    lastDailyReset: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

function shouldResetDaily(lastReset: string): boolean {
  const now = new Date();
  const lastResetDate = new Date(lastReset);
  const todayReset = new Date(now);
  todayReset.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);
  if (now < todayReset) todayReset.setUTCDate(todayReset.getUTCDate() - 1);
  return lastResetDate < todayReset;
}

export const serverState: ServerState = {
  activeConnectionPreset: null,
  activeChatCompletionPreset: null,
  activeRegexScripts: [],
  defaultPostProcessing: 'none',
  strictPlaceholderMessage: '[Start a new chat]',
  logging: {
    enabled: false,
    logRequests: false,
    logResponses: false,
    logRawRequestBody: false,
  },
  stats: getDefaultStats(),
};

export function checkAndResetDailyStats(): void {
  if (shouldResetDaily(serverState.stats.lastDailyReset)) {
    serverState.stats.dailyRequests = 0;
    serverState.stats.dailyTokens = 0;
    serverState.stats.lastDailyReset = new Date().toISOString();
  }
}

export function recordUsage(inputTokens: number, outputTokens: number): void {
  checkAndResetDailyStats();
  const totalTokensUsed = inputTokens + outputTokens;
  serverState.stats.totalRequests += 1;
  serverState.stats.totalTokens += totalTokensUsed;
  serverState.stats.dailyRequests += 1;
  serverState.stats.dailyTokens += totalTokensUsed;
  serverState.stats.lastUpdated = new Date().toISOString();
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.trim().split(/\s+/).length * 1.33);
}

export function calculateMessageTokens(messages: Array<{ content?: string }>): number {
  return messages.reduce((total, msg) => total + (msg.content ? estimateTokens(msg.content) : 0) + 4, 0);
}

export function extractTokenCountsFromResponse(body: string): { promptTokens: number; completionTokens: number } | null {
  try {
    const data = JSON.parse(body);
    if (data.usage?.prompt_tokens !== undefined || data.usage?.completion_tokens !== undefined) {
      return {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
      };
    }
  } catch {}
  return null;
}

export function extractTokenCountsFromStreamChunk(chunkText: string): { promptTokens: number; completionTokens: number } | null {
  try {
    const clean = chunkText.startsWith('data: ') ? chunkText.slice(6) : chunkText;
    if (!clean.trim() || clean.trim() === '[DONE]') return null;
    const data = JSON.parse(clean);
    if (data.usage?.prompt_tokens !== undefined || data.usage?.completion_tokens !== undefined) {
      return { promptTokens: data.usage.prompt_tokens || 0, completionTokens: data.usage.completion_tokens || 0 };
    }
  } catch {}
  return null;
}

export function getTimeUntilReset(): { hours: number; minutes: number } {
  const now = new Date();
  const nextReset = new Date(now);
  nextReset.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);
  if (now >= nextReset) nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  const diffMs = nextReset.getTime() - now.getTime();
  return {
    hours: Math.floor(diffMs / (1000 * 60 * 60)),
    minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
  };
}

export const keyUsageCounts = new Map<string, number>();
export const roundRobinIndex = new Map<string, number>();
export const lastUsedKeyId = new Map<string, string>();

export function recordKeyUsage(connectionId: string, keyId: string): void {
  keyUsageCounts.set(keyId, (keyUsageCounts.get(keyId) || 0) + 1);
  lastUsedKeyId.set(connectionId, keyId);
}

export function selectKeyRoundRobin(connectionPreset: ConnectionPreset): { keyId: string; apiKey: string } | null {
  const keys = connectionPreset.apiKeys;
  if (!keys || keys.length === 0) return null;

  if (keys.length === 1) {
    const k = keys[0];
    recordKeyUsage(connectionPreset.id, k.id);
    return { keyId: k.id, apiKey: k.value };
  }

  const currentIndex = roundRobinIndex.get(connectionPreset.id) || 0;
  const nextIndex = currentIndex % keys.length;
  roundRobinIndex.set(connectionPreset.id, nextIndex + 1);

  const k = keys[nextIndex];
  recordKeyUsage(connectionPreset.id, k.id);
  return { keyId: k.id, apiKey: k.value };
}

export function advanceToNextKey(connectionPreset: ConnectionPreset, currentKeyId: string): { keyId: string; apiKey: string } | null {
  const keys = connectionPreset.apiKeys;
  if (!keys || keys.length <= 1) return null;

  const currentIdx = keys.findIndex(k => k.id === currentKeyId);
  const nextIdx = (currentIdx + 1) % keys.length;
  roundRobinIndex.set(connectionPreset.id, nextIdx + 1);

  const k = keys[nextIdx];
  recordKeyUsage(connectionPreset.id, k.id);
  return { keyId: k.id, apiKey: k.value };
}

export function getKeyStats(connectionPreset: ConnectionPreset): Array<{ keyId: string; name: string; usageCount: number; isLastUsed: boolean }> {
  const lastKey = lastUsedKeyId.get(connectionPreset.id);
  return (connectionPreset.apiKeys || []).map(k => ({
    keyId: k.id,
    name: k.name,
    usageCount: keyUsageCounts.get(k.id) || 0,
    isLastUsed: k.id === lastKey,
  }));
}

// ============================================
// Usage Statistics Tracking
// ============================================
// Tracks request counts and token usage with daily resets
// Optimized to minimize Firebase operations

import { storageManager } from './storage-provider';

// ============================================
// Types
// ============================================

export interface UsageStats {
  // Totals (never reset)
  totalRequests: number;
  totalTokens: number;

  // Daily stats (reset at 10 AM GMT+3)
  dailyRequests: number;
  dailyTokens: number;

  // Last reset timestamp (ISO string)
  lastDailyReset: string;

  // Last updated
  lastUpdated: string;
}

// ============================================
// Constants
// ============================================

const STATS_KEY = 'stats';
const RESET_HOUR_UTC = 7; // 10 AM GMT+3 = 7 AM UTC

// Save to Firebase every N requests (reduces operations drastically)
const SAVE_INTERVAL = 10;

// ============================================
// In-Memory Cache
// ============================================

let cachedStats: UsageStats | null = null;
let pendingChanges = 0;
let lastLoadTime = 0;
const CACHE_TTL = 60000; // 1 minute cache for reads

// ============================================
// Helper Functions
// ============================================

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

/**
 * Check if daily stats should be reset
 * Resets at 10 AM GMT+3 (7 AM UTC)
 */
function shouldResetDaily(lastReset: string): boolean {
  const now = new Date();
  const lastResetDate = new Date(lastReset);

  // Get today's reset time (7 AM UTC)
  const todayReset = new Date(now);
  todayReset.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);

  // If current time is before today's reset hour, use yesterday's reset time
  if (now < todayReset) {
    todayReset.setUTCDate(todayReset.getUTCDate() - 1);
  }

  // Should reset if last reset was before the most recent reset time
  return lastResetDate < todayReset;
}

/**
 * Estimate token count from text
 * Using approximation: 1 token ≈ 0.75 words (or ~4 characters)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Count words (split by whitespace)
  const words = text.trim().split(/\s+/).length;
  // 1 token ≈ 0.75 words, so tokens ≈ words / 0.75 ≈ words * 1.33
  return Math.ceil(words * 1.33);
}

/**
 * Calculate tokens from messages array
 */
export function calculateMessageTokens(messages: Array<{ content?: string; role?: string }>): number {
  let total = 0;
  for (const msg of messages) {
    if (msg.content) {
      total += estimateTokens(msg.content);
    }
    // Add small overhead for role and structure
    total += 4;
  }
  return total;
}

/**
 * Extract token counts from OpenAI-compatible response body
 * Returns { promptTokens: number, completionTokens: number } or null if not found
 */
export function extractTokenCountsFromResponse(responseBody: string): { promptTokens: number; completionTokens: number } | null {
  try {
    const data = JSON.parse(responseBody);
    
    // Check for OpenAI-compatible usage field
    if (data.usage && typeof data.usage === 'object') {
      const usage = data.usage;
      const promptTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
      const completionTokens = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;
      
      if (promptTokens > 0 || completionTokens > 0) {
        return { promptTokens, completionTokens };
      }
    }
    
    // Check for alternative field names (some providers might use different names)
    if (data.prompt_tokens !== undefined || data.completion_tokens !== undefined) {
      const promptTokens = typeof data.prompt_tokens === 'number' ? data.prompt_tokens : 0;
      const completionTokens = typeof data.completion_tokens === 'number' ? data.completion_tokens : 0;
      
      if (promptTokens > 0 || completionTokens > 0) {
        return { promptTokens, completionTokens };
      }
    }
    
    return null;
  } catch {
    // If parsing fails, return null
    return null;
  }
}

/**
 * Extract token counts from streaming response chunk
 * Streaming responses might have usage in the final chunk
 */
export function extractTokenCountsFromStreamChunk(chunkText: string): { promptTokens: number; completionTokens: number } | null {
  try {
    // Remove "data: " prefix if present
    const cleanText = chunkText.startsWith('data: ') ? chunkText.substring(6) : chunkText;
    
    // Skip empty chunks or [DONE] marker
    if (cleanText.trim() === '' || cleanText.trim() === '[DONE]') {
      return null;
    }
    
    const data = JSON.parse(cleanText);
    
    // Check for usage field in streaming chunk
    if (data.usage && typeof data.usage === 'object') {
      const usage = data.usage;
      const promptTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
      const completionTokens = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;
      
      if (promptTokens > 0 || completionTokens > 0) {
        return { promptTokens, completionTokens };
      }
    }
    
    return null;
  } catch {
    // If parsing fails, return null
    return null;
  }
}

// ============================================
// Firebase Storage Functions (Optimized)
// ============================================

/**
 * Load stats from Firebase (with caching)
 */
async function loadStats(): Promise<UsageStats> {
  // Return cached if fresh enough
  if (cachedStats && Date.now() - lastLoadTime < CACHE_TTL) {
    return cachedStats;
  }

  try {
    // Use storage manager to get stats
    const data = await storageManager.get(STATS_KEY as any);
    if (data && typeof data === 'object') {
      cachedStats = data as UsageStats;
      lastLoadTime = Date.now();
      return cachedStats;
    }
  } catch {
    // Firebase doesn't exist or error
  }

  cachedStats = getDefaultStats();
  lastLoadTime = Date.now();
  return cachedStats;
}

/**
 * Save stats to Firebase
 */
async function saveStats(stats: UsageStats): Promise<void> {
  try {
    // Use storage manager to save stats
    await storageManager.set(STATS_KEY as any, stats);
    console.log('[Stats] Saved to Firebase');
  } catch (error) {
    console.error('[Stats] Failed to save stats:', error);
  }
}

// ============================================
// Public Functions
// ============================================

/**
 * Get current usage stats
 */
export async function getStats(): Promise<UsageStats> {
  try {
    let stats = await loadStats();

    // Check if daily reset is needed
    if (shouldResetDaily(stats.lastDailyReset)) {
      stats = {
        ...stats,
        dailyRequests: 0,
        dailyTokens: 0,
        lastDailyReset: new Date().toISOString(),
      };
      cachedStats = stats;
      // Save the reset immediately
      await saveStats(stats);
    }

    return stats;
  } catch (error) {
    console.error('[Stats] Failed to get stats:', error);
    return getDefaultStats();
  }
}

/**
 * Increment request count and add tokens
 * Batches writes to Firebase - only saves every SAVE_INTERVAL requests
 */
export async function recordUsage(inputTokens: number, outputTokens: number): Promise<UsageStats> {
  try {
    // Load or use cached stats
    const stats = cachedStats || await loadStats();

    // Check if daily reset is needed first
    if (shouldResetDaily(stats.lastDailyReset)) {
      stats.dailyRequests = 0;
      stats.dailyTokens = 0;
      stats.lastDailyReset = new Date().toISOString();
    }

    const totalTokensUsed = inputTokens + outputTokens;

    // Update stats in memory
    stats.totalRequests += 1;
    stats.totalTokens += totalTokensUsed;
    stats.dailyRequests += 1;
    stats.dailyTokens += totalTokensUsed;
    stats.lastUpdated = new Date().toISOString();

    // Update cache
    cachedStats = stats;
    pendingChanges++;

    // Only save to Firebase every N requests (reduces operations by ~90%)
    if (pendingChanges >= SAVE_INTERVAL) {
      pendingChanges = 0;
      saveStats(stats).catch(() => {}); // Fire and forget
    }

    return stats;
  } catch (error) {
    console.error('[Stats] Failed to record usage:', error);
    return cachedStats || getDefaultStats();
  }
}

/**
 * Force save pending stats (call on shutdown or periodically)
 */
export async function flushStats(): Promise<void> {
  if (cachedStats && pendingChanges > 0) {
    pendingChanges = 0;
    await saveStats(cachedStats);
  }
}

/**
 * Get time until next daily reset
 */
export function getTimeUntilReset(): { hours: number; minutes: number } {
  const now = new Date();

  // Get next reset time (7 AM UTC)
  const nextReset = new Date(now);
  nextReset.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);

  // If we've passed today's reset, use tomorrow's
  if (now >= nextReset) {
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  }

  const diffMs = nextReset.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return { hours: diffHours, minutes: diffMinutes };
}

// ============================================
// Usage Statistics Tracking
// ============================================
// Tracks request counts and token usage with daily resets

import { head, put, del } from '@vercel/blob';

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

const STATS_BLOB_PATH = 'janitors-tavern/stats.json';
const RESET_HOUR_UTC = 7; // 10 AM GMT+3 = 7 AM UTC

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

// ============================================
// Blob Storage Functions
// ============================================

async function isBlobConfigured(): Promise<boolean> {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function loadStats(): Promise<UsageStats> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return getDefaultStats();
    }

    const blobInfo = await head(STATS_BLOB_PATH);
    if (blobInfo) {
      const response = await fetch(blobInfo.url);
      const data = await response.json();
      return data as UsageStats;
    }
  } catch (error) {
    // Blob doesn't exist or error - log and continue
    console.error('[Stats] Failed to load stats:', error);
  }

  return getDefaultStats();
}

async function saveStats(stats: UsageStats): Promise<void> {
  if (!(await isBlobConfigured())) return;

  try {
    // Delete existing blob
    try {
      const existingBlob = await head(STATS_BLOB_PATH);
      if (existingBlob) {
        await del(existingBlob.url);
      }
    } catch {
      // Blob doesn't exist
    }

    // Save new stats
    await put(STATS_BLOB_PATH, JSON.stringify(stats, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch (error) {
    console.error('[Stats] Failed to save stats:', error);
  }
}

// ============================================
// Public Functions
// ============================================

/**
 * Get current usage stats
 *
 * NOTE: This function is designed to never throw - all errors are caught and logged
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
 * @param inputTokens - Tokens in the request (prompt)
 * @param outputTokens - Tokens in the response (completion)
 *
 * NOTE: This function is designed to never throw - all errors are caught and logged
 */
export async function recordUsage(inputTokens: number, outputTokens: number): Promise<UsageStats> {
  try {
    let stats = await loadStats();

    // Check if daily reset is needed first
    if (shouldResetDaily(stats.lastDailyReset)) {
      stats.dailyRequests = 0;
      stats.dailyTokens = 0;
      stats.lastDailyReset = new Date().toISOString();
    }

    const totalTokensUsed = inputTokens + outputTokens;

    // Update stats
    stats.totalRequests += 1;
    stats.totalTokens += totalTokensUsed;
    stats.dailyRequests += 1;
    stats.dailyTokens += totalTokensUsed;
    stats.lastUpdated = new Date().toISOString();

    await saveStats(stats);

    return stats;
  } catch (error) {
    // Never let stats recording fail the main request
    console.error('[Stats] Failed to record usage:', error);
    return getDefaultStats();
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

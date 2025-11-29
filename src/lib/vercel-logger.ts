// ============================================
// Vercel-Compatible Logger
// ============================================
// Logs to console (Vercel Functions logs) and Vercel Blob for persistence

import { put, head, del } from '@vercel/blob';

// ============================================
// Types
// ============================================

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  requestId: string;
  data: unknown;
  durationMs?: number;
}

export interface LogStore {
  entries: LogEntry[];
  maxEntries: number;
  lastUpdated: string;
}

// ============================================
// Constants
// ============================================

const LOG_BLOB_PATH = 'janitors-tavern/logs.json';
const MAX_LOG_ENTRIES = 100; // Keep last 100 entries
const LOG_PREFIX = '[JT]';

// ============================================
// Console Logging (Always enabled - shows in Vercel dashboard)
// ============================================

function consoleLog(level: 'info' | 'warn' | 'error', requestId: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const prefix = `${LOG_PREFIX} [${timestamp}] [${requestId}]`;

  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (data) {
    logFn(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    logFn(`${prefix} ${message}`);
  }
}

// ============================================
// Blob Storage (Persistent logs)
// ============================================

async function isBlobConfigured(): Promise<boolean> {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function loadLogStore(): Promise<LogStore> {
  const defaultStore: LogStore = {
    entries: [],
    maxEntries: MAX_LOG_ENTRIES,
    lastUpdated: new Date().toISOString(),
  };

  try {
    const blobInfo = await head(LOG_BLOB_PATH);
    if (blobInfo) {
      const response = await fetch(blobInfo.url);
      const data = await response.json();
      return data as LogStore;
    }
  } catch {
    // Blob doesn't exist or error - return default
  }

  return defaultStore;
}

async function saveLogStore(store: LogStore): Promise<void> {
  try {
    // Delete existing blob
    try {
      const existingBlob = await head(LOG_BLOB_PATH);
      if (existingBlob) {
        await del(existingBlob.url);
      }
    } catch {
      // Blob doesn't exist
    }

    // Save new data
    await put(LOG_BLOB_PATH, JSON.stringify(store, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to save logs to blob:`, error);
  }
}

async function appendToLogStore(entry: LogEntry): Promise<void> {
  if (!(await isBlobConfigured())) return;

  try {
    const store = await loadLogStore();

    // Add new entry
    store.entries.push(entry);

    // Trim to max entries (keep most recent)
    if (store.entries.length > store.maxEntries) {
      store.entries = store.entries.slice(-store.maxEntries);
    }

    store.lastUpdated = new Date().toISOString();

    await saveLogStore(store);
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to append log:`, error);
  }
}

// ============================================
// Public Logging Functions
// ============================================

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function logRequest(
  requestId: string,
  data: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    incomingMessages?: unknown[];
    connectionPreset?: { name: string; baseUrl: string; model: string };
    chatCompletionPreset?: { name: string };
  }
): Promise<void> {
  // Always log to console
  consoleLog('info', requestId, 'REQUEST', {
    url: data.url,
    method: data.method,
    connection: data.connectionPreset?.name,
    model: data.connectionPreset?.model,
    preset: data.chatCompletionPreset?.name,
    messageCount: data.incomingMessages?.length,
  });

  // Detailed log to console for debugging
  console.log(`${LOG_PREFIX} [${requestId}] Full request body:`, JSON.stringify(data.body, null, 2));

  // Store in Blob
  const entry: LogEntry = {
    id: `req-${requestId}`,
    timestamp: new Date().toISOString(),
    type: 'request',
    requestId,
    data: {
      url: data.url,
      method: data.method,
      connection: data.connectionPreset ? {
        name: data.connectionPreset.name,
        baseUrl: data.connectionPreset.baseUrl,
        model: data.connectionPreset.model,
      } : undefined,
      preset: data.chatCompletionPreset?.name,
      messageCount: data.incomingMessages?.length,
      messages: data.incomingMessages,
      rawBody: data.body,
    },
  };

  await appendToLogStore(entry);
}

export async function logProcessedRequest(
  requestId: string,
  data: {
    processedMessages: unknown[];
    samplerSettings?: unknown;
    providerUrl: string;
    model: string;
  }
): Promise<void> {
  // Log to console
  consoleLog('info', requestId, 'PROCESSED REQUEST', {
    providerUrl: data.providerUrl,
    model: data.model,
    messageCount: data.processedMessages.length,
  });

  // Detailed processed messages
  console.log(`${LOG_PREFIX} [${requestId}] Processed messages being sent to provider:`,
    JSON.stringify(data.processedMessages, null, 2));

  // Store in Blob
  const entry: LogEntry = {
    id: `proc-${requestId}`,
    timestamp: new Date().toISOString(),
    type: 'info',
    requestId,
    data: {
      stage: 'processed',
      providerUrl: data.providerUrl,
      model: data.model,
      samplerSettings: data.samplerSettings,
      messageCount: data.processedMessages.length,
      processedMessages: data.processedMessages,
    },
  };

  await appendToLogStore(entry);
}

export async function logResponse(
  requestId: string,
  data: {
    status: number;
    response?: unknown;
    message?: string;
    usage?: unknown;
  },
  durationMs: number
): Promise<void> {
  // Log to console
  consoleLog('info', requestId, `RESPONSE (${durationMs}ms)`, {
    status: data.status,
    message: data.message?.substring(0, 100),
    usage: data.usage,
  });

  // Full response to console
  console.log(`${LOG_PREFIX} [${requestId}] Full response:`, JSON.stringify(data.response, null, 2));

  // Store in Blob
  const entry: LogEntry = {
    id: `res-${requestId}`,
    timestamp: new Date().toISOString(),
    type: 'response',
    requestId,
    durationMs,
    data: {
      status: data.status,
      message: data.message,
      usage: data.usage,
      fullResponse: data.response,
    },
  };

  await appendToLogStore(entry);
}

export async function logError(
  requestId: string,
  error: unknown,
  context?: string
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log to console
  consoleLog('error', requestId, `ERROR${context ? ` (${context})` : ''}`, {
    message: errorMessage,
    stack: errorStack,
  });

  // Store in Blob
  const entry: LogEntry = {
    id: `err-${requestId}`,
    timestamp: new Date().toISOString(),
    type: 'error',
    requestId,
    data: {
      context,
      message: errorMessage,
      stack: errorStack,
      raw: String(error),
    },
  };

  await appendToLogStore(entry);
}

// ============================================
// Log Reading (for UI)
// ============================================

export async function getLogs(): Promise<LogEntry[]> {
  if (!(await isBlobConfigured())) {
    return [];
  }

  try {
    const store = await loadLogStore();
    // Return in reverse chronological order
    return [...store.entries].reverse();
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read logs:`, error);
    return [];
  }
}

export async function clearLogs(): Promise<void> {
  if (!(await isBlobConfigured())) return;

  try {
    const store: LogStore = {
      entries: [],
      maxEntries: MAX_LOG_ENTRIES,
      lastUpdated: new Date().toISOString(),
    };
    await saveLogStore(store);
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to clear logs:`, error);
  }
}

export async function getLogStats(): Promise<{ count: number; lastUpdated: string | null }> {
  if (!(await isBlobConfigured())) {
    return { count: 0, lastUpdated: null };
  }

  try {
    const store = await loadLogStore();
    return {
      count: store.entries.length,
      lastUpdated: store.lastUpdated,
    };
  } catch {
    return { count: 0, lastUpdated: null };
  }
}

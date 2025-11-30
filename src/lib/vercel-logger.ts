// ============================================
// Vercel-Compatible Logger
// ============================================
// Logs to console only (visible in Vercel Function logs)
// No blob storage to save on quota

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

// ============================================
// Constants
// ============================================

const LOG_PREFIX = '[JT]';

// ============================================
// Console Logging (Shows in Vercel dashboard)
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
  try {
    // Log summary to console
    consoleLog('info', requestId, 'REQUEST', {
      url: data.url,
      method: data.method,
      connection: data.connectionPreset?.name,
      model: data.connectionPreset?.model,
      preset: data.chatCompletionPreset?.name,
      messageCount: data.incomingMessages?.length,
    });

    // Detailed log for debugging (can be disabled in production if too verbose)
    if (process.env.VERBOSE_LOGGING === 'true') {
      console.log(`${LOG_PREFIX} [${requestId}] Full request body:`, JSON.stringify(data.body, null, 2));
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} [${requestId}] Failed to log request:`, error);
  }
}

export async function logProcessedRequest(
  requestId: string,
  data: {
    processedMessages: unknown[];
    samplerSettings?: unknown;
    providerUrl: string;
    model: string;
    streaming?: boolean;
  }
): Promise<void> {
  try {
    consoleLog('info', requestId, 'PROCESSED REQUEST', {
      providerUrl: data.providerUrl,
      model: data.model,
      messageCount: data.processedMessages.length,
      streaming: data.streaming ?? false,
    });

    // Detailed log for debugging
    if (process.env.VERBOSE_LOGGING === 'true') {
      console.log(`${LOG_PREFIX} [${requestId}] Processed messages:`,
        JSON.stringify(data.processedMessages, null, 2));
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} [${requestId}] Failed to log processed request:`, error);
  }
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
  try {
    consoleLog('info', requestId, `RESPONSE (${durationMs}ms)`, {
      status: data.status,
      messagePreview: data.message?.substring(0, 100),
      usage: data.usage,
    });

    // Detailed log for debugging
    if (process.env.VERBOSE_LOGGING === 'true') {
      console.log(`${LOG_PREFIX} [${requestId}] Full response:`, JSON.stringify(data.response, null, 2));
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} [${requestId}] Failed to log response:`, error);
  }
}

export async function logError(
  requestId: string,
  error: unknown,
  context?: string
): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    consoleLog('error', requestId, `ERROR${context ? ` (${context})` : ''}`, {
      message: errorMessage,
      stack: errorStack,
    });
  } catch (loggingError) {
    console.error(`${LOG_PREFIX} [${requestId}] Failed to log error:`, loggingError);
  }
}

// ============================================
// Stub functions for backward compatibility
// (These no longer use blob storage)
// ============================================

export async function getLogs(): Promise<LogEntry[]> {
  // Logs are in Vercel Function logs, not stored in blob
  console.log(`${LOG_PREFIX} getLogs() called - logs are available in Vercel Function logs dashboard`);
  return [];
}

export async function clearLogs(): Promise<void> {
  // No-op - logs are managed by Vercel
  console.log(`${LOG_PREFIX} clearLogs() called - logs are managed by Vercel dashboard`);
}

export async function getLogStats(): Promise<{ count: number; lastUpdated: string | null }> {
  // No blob storage for logs
  return { count: 0, lastUpdated: null };
}

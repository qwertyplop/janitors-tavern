import { promises as fs } from 'fs';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  type: 'request' | 'response' | 'error';
  requestId: string;
  data: unknown;
}

export interface LoggingConfig {
  enabled: boolean;
  logRequests: boolean;
  logResponses: boolean;
  logFilePath: string;
}

// Generate a unique request ID
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Ensure the log directory exists
async function ensureLogDirectory(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Format log entry as a string
function formatLogEntry(entry: LogEntry): string {
  const separator = '='.repeat(80);
  const header = `[${entry.timestamp}] [${entry.type.toUpperCase()}] [${entry.requestId}]`;
  const content = JSON.stringify(entry.data, null, 2);
  return `${separator}\n${header}\n${separator}\n${content}\n\n`;
}

// Write log entry to file
export async function writeLog(
  config: LoggingConfig,
  entry: LogEntry
): Promise<void> {
  if (!config.enabled) return;

  // Check if we should log this type
  if (entry.type === 'request' && !config.logRequests) return;
  if (entry.type === 'response' && !config.logResponses) return;

  try {
    const logPath = path.resolve(process.cwd(), config.logFilePath);
    await ensureLogDirectory(logPath);

    const formattedEntry = formatLogEntry(entry);
    await fs.appendFile(logPath, formattedEntry, 'utf-8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

// Log a request
export async function logRequest(
  config: LoggingConfig,
  requestId: string,
  requestBody: unknown
): Promise<void> {
  await writeLog(config, {
    timestamp: new Date().toISOString(),
    type: 'request',
    requestId,
    data: requestBody,
  });
}

// Log a response
export async function logResponse(
  config: LoggingConfig,
  requestId: string,
  responseBody: unknown,
  durationMs?: number
): Promise<void> {
  await writeLog(config, {
    timestamp: new Date().toISOString(),
    type: 'response',
    requestId,
    data: {
      response: responseBody,
      durationMs,
    },
  });
}

// Log an error
export async function logError(
  config: LoggingConfig,
  requestId: string,
  error: unknown
): Promise<void> {
  await writeLog(config, {
    timestamp: new Date().toISOString(),
    type: 'error',
    requestId,
    data: {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
  });
}

// Read recent log entries (for viewing in UI)
export async function readRecentLogs(
  filePath: string,
  maxEntries: number = 50
): Promise<string> {
  try {
    const logPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(logPath, 'utf-8');

    // Split by separator and get last N entries
    const entries = content.split('='.repeat(80)).filter(Boolean);
    const recentEntries = entries.slice(-maxEntries);

    return recentEntries.join('='.repeat(80));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'No logs found.';
    }
    throw error;
  }
}

// Clear log file
export async function clearLogs(filePath: string): Promise<void> {
  try {
    const logPath = path.resolve(process.cwd(), filePath);
    await fs.writeFile(logPath, '', 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

// Get log file size
export async function getLogFileSize(filePath: string): Promise<number> {
  try {
    const logPath = path.resolve(process.cwd(), filePath);
    const stats = await fs.stat(logPath);
    return stats.size;
  } catch {
    return 0;
  }
}

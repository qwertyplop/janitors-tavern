import { Router } from 'express';
import type { Request, Response } from 'express';
import { requestLog } from '../lib/server-state.js';

const router = Router();

const inMemoryLogs: Array<{ timestamp: string; level: string; message: string; data?: unknown }> = [];

export function appendLog(level: string, message: string, data?: unknown) {
  inMemoryLogs.push({ timestamp: new Date().toISOString(), level, message, data });
  if (inMemoryLogs.length > 500) inMemoryLogs.shift();
}

router.get('/', (req: Request, res: Response) => {
  const maxEntries = Math.min(parseInt((req.query as Record<string, string>).max || '50', 10), 500);
  const recent = inMemoryLogs.slice(-maxEntries);
  res.json({
    logs: recent,
    fileSize: recent.length,
    filePath: 'console-only',
    message: 'Logs are available in the server console output.',
  });
});

router.delete('/', (req: Request, res: Response) => {
  inMemoryLogs.length = 0;
  res.json({ success: true, message: 'In-memory logs cleared.' });
});

router.get('/requests', (req: Request, res: Response) => {
  res.json({ logs: requestLog });
});

router.delete('/requests', (req: Request, res: Response) => {
  requestLog.length = 0;
  res.json({ success: true });
});

export default router;

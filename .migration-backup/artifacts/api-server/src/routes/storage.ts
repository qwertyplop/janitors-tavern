import { Router } from 'express';
import type { Request, Response } from 'express';
import { serverState, checkAndResetDailyStats, getTimeUntilReset } from '../lib/server-state.js';

const router = Router();

const DEFAULTS = {
  connections: [],
  presets: [],
  settings: {
    theme: 'system',
    language: 'en',
    showAdvancedOptions: false,
    defaultPostProcessing: 'none',
    strictPlaceholderMessage: '[Start a new chat]',
    logging: {
      enabled: false,
      logRequests: false,
      logResponses: false,
      logRawRequestBody: false,
    },
  },
  regexScripts: [],
};

router.get('/all', (req: Request, res: Response) => {
  res.json({
    connections: [],
    presets: [],
    settings: {
      theme: 'system',
      language: 'en',
      showAdvancedOptions: false,
      defaultPostProcessing: serverState.defaultPostProcessing,
      strictPlaceholderMessage: serverState.strictPlaceholderMessage,
      logging: serverState.logging,
    },
    regexScripts: [],
  });
});

router.put('/all', (req: Request, res: Response) => {
  const data = req.body as Partial<typeof DEFAULTS>;
  if (data.settings) {
    if (data.settings.defaultPostProcessing !== undefined) {
      serverState.defaultPostProcessing = data.settings.defaultPostProcessing as typeof serverState.defaultPostProcessing;
    }
    if (data.settings.strictPlaceholderMessage !== undefined) {
      serverState.strictPlaceholderMessage = data.settings.strictPlaceholderMessage;
    }
    if (data.settings.logging) {
      serverState.logging = { ...serverState.logging, ...data.settings.logging };
    }
  }
  res.json({ success: true });
});

router.delete('/all', (req: Request, res: Response) => {
  serverState.activeConnectionPreset = null;
  serverState.activeChatCompletionPreset = null;
  serverState.activeRegexScripts = [];
  serverState.defaultPostProcessing = 'none';
  serverState.logging = { enabled: false, logRequests: false, logResponses: false, logRawRequestBody: false };
  res.json({ success: true });
});

router.get('/stats', (req: Request, res: Response) => {
  checkAndResetDailyStats();
  res.json({
    ...serverState.stats,
    timeUntilReset: getTimeUntilReset(),
  });
});

router.get('/status', (req: Request, res: Response) => {
  res.json({
    configured: true,
    provider: 'local',
    storageType: 'localStorage + Express in-memory',
    note: 'This app uses localStorage for client data and Express server state — no Firebase.',
  });
});

router.get('/logs', (req: Request, res: Response) => {
  res.json({
    logs: [],
    fileSize: 0,
    filePath: 'console-only',
    message: 'Logs are available in the server console output.',
  });
});

router.get('/:key', (req: Request, res: Response) => {
  const { key } = req.params as { key: string };
  switch (key) {
    case 'settings':
      res.json({
        defaultPostProcessing: serverState.defaultPostProcessing,
        strictPlaceholderMessage: serverState.strictPlaceholderMessage,
        logging: serverState.logging,
      });
      break;
    case 'connections':
      res.json([]);
      break;
    case 'presets':
      res.json([]);
      break;
    case 'regexScripts':
      res.json([]);
      break;
    default:
      res.status(404).json({ error: `Key '${key}' not found in server storage` });
  }
});

router.put('/:key', (req: Request, res: Response) => {
  const { key } = req.params as { key: string };
  if (key === 'settings') {
    const data = req.body as Record<string, unknown>;
    if (data.defaultPostProcessing !== undefined) {
      serverState.defaultPostProcessing = data.defaultPostProcessing as typeof serverState.defaultPostProcessing;
    }
    if (data.strictPlaceholderMessage !== undefined) {
      serverState.strictPlaceholderMessage = data.strictPlaceholderMessage as string;
    }
    if (data.logging) {
      serverState.logging = { ...serverState.logging, ...(data.logging as Record<string, boolean>) };
    }
    res.json({ success: true });
  } else {
    res.json({ success: true, note: `Client-side key '${key}' is managed by localStorage in this app.` });
  }
});

export default router;

import { Router } from 'express';
import type { Request, Response } from 'express';
import { serverState, checkAndResetDailyStats, getTimeUntilReset, getKeyStats } from '../lib/server-state.js';
import type { ConnectionPreset, ChatCompletionPreset, RegexScript, PromptPostProcessingMode } from '../lib/types.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  checkAndResetDailyStats();
  res.json({
    activeConnectionPreset: serverState.activeConnectionPreset,
    activeChatCompletionPreset: serverState.activeChatCompletionPreset,
    defaultPostProcessing: serverState.defaultPostProcessing,
    strictPlaceholderMessage: serverState.strictPlaceholderMessage,
    logging: serverState.logging,
    stats: serverState.stats,
    timeUntilReset: getTimeUntilReset(),
  });
});

router.post('/', (req: Request, res: Response) => {
  const body = req.body as {
    activeConnectionPreset?: ConnectionPreset | null;
    activeChatCompletionPreset?: ChatCompletionPreset | null;
    activeRegexScripts?: RegexScript[];
    defaultPostProcessing?: PromptPostProcessingMode;
    strictPlaceholderMessage?: string;
    logging?: {
      enabled?: boolean;
      logRequests?: boolean;
      logResponses?: boolean;
      logRawRequestBody?: boolean;
    };
  };

  if ('activeConnectionPreset' in body) {
    serverState.activeConnectionPreset = body.activeConnectionPreset ?? null;
  }
  if ('activeChatCompletionPreset' in body) {
    serverState.activeChatCompletionPreset = body.activeChatCompletionPreset ?? null;
  }
  if ('activeRegexScripts' in body && Array.isArray(body.activeRegexScripts)) {
    serverState.activeRegexScripts = body.activeRegexScripts;
  }
  if (body.defaultPostProcessing !== undefined) {
    serverState.defaultPostProcessing = body.defaultPostProcessing;
  }
  if (body.strictPlaceholderMessage !== undefined) {
    serverState.strictPlaceholderMessage = body.strictPlaceholderMessage;
  }
  if (body.logging) {
    serverState.logging = { ...serverState.logging, ...body.logging };
  }

  res.json({ success: true, state: serverState });
});

router.get('/stats', (req: Request, res: Response) => {
  checkAndResetDailyStats();
  res.json({ stats: serverState.stats, timeUntilReset: getTimeUntilReset() });
});

router.post('/stats/reset', (req: Request, res: Response) => {
  serverState.stats = {
    totalRequests: 0,
    totalTokens: 0,
    dailyRequests: 0,
    dailyTokens: 0,
    lastDailyReset: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
  res.json({ success: true, stats: serverState.stats });
});

router.get('/key-stats', (req: Request, res: Response) => {
  const conn = serverState.activeConnectionPreset;
  if (!conn) {
    res.json({ keyStats: [] });
    return;
  }
  res.json({ keyStats: getKeyStats(conn) });
});

export default router;

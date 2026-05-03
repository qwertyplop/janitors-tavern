import { Router } from 'express';
import type { Request, Response } from 'express';
import { serverState, recordUsage, recordKeyUsage, calculateMessageTokens, estimateTokens, extractTokenCountsFromResponse, extractTokenCountsFromStreamChunk, selectKeyRoundRobin, advanceToNextKey } from '../lib/server-state.js';
import { verifyJanitorApiKey, authState as _authState } from '../lib/auth-state.js';
import { parseJanitorRequest, janitorDataToMacroContext } from '../lib/janitor-parser.js';
import { buildMessages } from '../lib/prompt-builder.js';
import { processMacros } from '../lib/macros.js';
import { applyRegexScripts } from '../lib/regex-processor.js';
import type { ConnectionPreset, ChatCompletionPreset, ChatMessage, PromptPostProcessingMode } from '../lib/types.js';
import { DEFAULT_SAMPLER_SETTINGS } from '../lib/types.js';

const router = Router();

interface OutputMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function mergeConsecutiveMessages(messages: OutputMessage[]): OutputMessage[] {
  if (messages.length === 0) return [];
  const result: OutputMessage[] = [];
  let currentRole: string | null = null;
  let currentContent: string[] = [];
  for (const msg of messages) {
    if (msg.role === currentRole) {
      currentContent.push(msg.content);
    } else {
      if (currentRole && currentContent.length > 0) {
        result.push({ role: currentRole as OutputMessage['role'], content: currentContent.join('\n\n') });
      }
      currentRole = msg.role;
      currentContent = [msg.content];
    }
  }
  if (currentRole && currentContent.length > 0) {
    result.push({ role: currentRole as OutputMessage['role'], content: currentContent.join('\n\n') });
  }
  return result;
}

function semiStrictProcess(messages: OutputMessage[]): OutputMessage[] {
  const merged = mergeConsecutiveMessages(messages);
  if (merged.length === 0) return [];
  const processed: OutputMessage[] = [];
  let firstSystemFound = false;
  for (const msg of merged) {
    if (msg.role === 'system') {
      if (!firstSystemFound) { processed.push(msg); firstSystemFound = true; }
      else processed.push({ role: 'user', content: msg.content });
    } else {
      processed.push(msg);
    }
  }
  const finalMessages: OutputMessage[] = [];
  for (let i = 0; i < processed.length; i++) {
    const current = processed[i];
    if (current.role === 'user') {
      let j = i + 1;
      while (j < processed.length && processed[j].role === 'user') j++;
      if (j > i + 1) {
        finalMessages.push({ role: 'user', content: processed.slice(i, j).map(m => m.content).join('\n\n') });
        i = j - 1;
      } else { finalMessages.push(current); }
    } else { finalMessages.push(current); }
  }
  return mergeConsecutiveMessages(finalMessages);
}

function strictProcess(messages: OutputMessage[], placeholderMessage: string = '[Start a new chat]'): OutputMessage[] {
  const semiStrict = semiStrictProcess(messages);
  if (semiStrict.length === 0) return [];
  const systemIndex = semiStrict.findIndex(m => m.role === 'system');
  if (systemIndex === -1) return semiStrict;
  const nextIndex = systemIndex + 1;
  if (nextIndex < semiStrict.length && semiStrict[nextIndex].role === 'user') return semiStrict;
  const result: OutputMessage[] = [];
  for (let i = 0; i < semiStrict.length; i++) {
    result.push(semiStrict[i]);
    if (i === systemIndex) result.push({ role: 'user', content: placeholderMessage });
  }
  return result;
}

function singleUserProcess(messages: OutputMessage[]): OutputMessage[] {
  if (messages.length === 0) return [];
  const allContent = messages.map(m => `[${m.role.charAt(0).toUpperCase() + m.role.slice(1)}]\n${m.content}`).join('\n\n');
  return [{ role: 'user', content: allContent }];
}

function anthropicProcess(messages: OutputMessage[], mergeConsecutives: boolean = false): OutputMessage[] {
  const strictProcessed = strictProcess(messages);
  if (mergeConsecutives) return mergeConsecutiveMessages(strictProcessed);
  return strictProcessed;
}

function applyPostProcessing(messages: OutputMessage[], mode: PromptPostProcessingMode, settings?: { strictPlaceholderMessage?: string }): OutputMessage[] {
  switch (mode) {
    case 'none': return messages;
    case 'merge': case 'merge-tools': return mergeConsecutiveMessages(messages);
    case 'semi-strict': case 'semi-strict-tools': return semiStrictProcess(messages);
    case 'strict': case 'strict-tools': return strictProcess(messages, settings?.strictPlaceholderMessage);
    case 'single-user': return singleUserProcess(messages);
    case 'anthropic': return anthropicProcess(messages, false);
    case 'anthropic-merge-consecutives': return anthropicProcess(messages, true);
    default: return messages;
  }
}

function isAnthropicUrl(url: string): boolean {
  return url.toLowerCase().includes('anthropic.com');
}

function getAuthHeaders(baseUrl: string, apiKey: string, extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'JanitorsTavern/1.0' };
  if (isAnthropicUrl(baseUrl)) {
    headers['X-Api-Key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return { ...headers, ...extraHeaders };
}

function buildExtraQueryUrl(baseUrl: string, path: string, extraQueryParams?: Record<string, string>): string {
  const base = baseUrl.replace(/\/$/, '');
  let url = `${base}${path}`;
  if (extraQueryParams && Object.keys(extraQueryParams).length > 0) {
    url += `?${new URLSearchParams(extraQueryParams).toString()}`;
  }
  return url;
}

function buildOpenAIRequest(messages: OutputMessage[], model: string, params: Record<string, unknown>, stream: boolean) {
  return { model, messages, stream, ...params };
}

function buildAnthropicRequest(messages: OutputMessage[], model: string, params: Record<string, unknown>, stream: boolean) {
  const msgs = [...messages];
  const systemIndex = msgs.findIndex(m => m.role === 'system');
  let systemMessage = '';
  if (systemIndex !== -1) { systemMessage = msgs[systemIndex].content; msgs.splice(systemIndex, 1); }
  const req: Record<string, unknown> = {
    model,
    messages: msgs.map(m => ({ role: m.role, content: m.content })),
    max_tokens: (params.max_tokens as number) || 4096,
  };
  if (stream) req.stream = true;
  if (systemMessage) req.system = systemMessage;
  if (params.temperature !== undefined) req.temperature = params.temperature;
  if (params.top_p !== undefined) req.top_p = params.top_p;
  return req;
}

function transformAnthropicStreamEvent(eventData: Record<string, unknown>): string | null {
  const eventType = eventData.type;
  if (!eventType) return null;
  switch (eventType) {
    case 'message_start': {
      return `data: ${JSON.stringify({ id: `chatcmpl-${Date.now()}`, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'claude-unknown', choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })}\n\n`;
    }
    case 'content_block_delta': {
      const delta = eventData.delta as Record<string, unknown> | undefined;
      if (delta?.type === 'text_delta' && delta.text) {
        return `data: ${JSON.stringify({ id: `chatcmpl-${Date.now()}`, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'claude-unknown', choices: [{ index: 0, delta: { content: delta.text }, finish_reason: null }] })}\n\n`;
      }
      return null;
    }
    case 'message_delta': {
      const delta = eventData.delta as Record<string, unknown> | undefined;
      const stopReason = delta?.stop_reason as string | undefined;
      let finishReason = 'stop';
      if (stopReason === 'max_tokens') finishReason = 'length';
      return `data: ${JSON.stringify({ id: `chatcmpl-${Date.now()}`, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'claude-unknown', choices: [{ index: 0, delta: {}, finish_reason: finishReason }] })}\n\n`;
    }
    case 'message_stop':
      return `data: ${JSON.stringify({ id: `chatcmpl-${Date.now()}`, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'claude-unknown', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`;
    default:
      return null;
  }
}

function transformAnthropicStreamChunk(chunkText: string): string {
  const lines = chunkText.split('\n');
  let result = '';
  let currentEvent: { event?: string; data?: string } = {};
  for (const line of lines) {
    if (line.startsWith('event:')) { currentEvent.event = line.substring(6).trim(); }
    else if (line.startsWith('data:')) { currentEvent.data = line.substring(5).trim(); }
    else if (line === '') {
      if (currentEvent.data) {
        try {
          const data = JSON.parse(currentEvent.data);
          const transformed = transformAnthropicStreamEvent(data);
          if (transformed) result += transformed;
        } catch {}
      }
      currentEvent = {};
    }
  }
  if (currentEvent.data) {
    try {
      const data = JSON.parse(currentEvent.data);
      const transformed = transformAnthropicStreamEvent(data);
      if (transformed) result += transformed;
    } catch {}
  }
  return result;
}

function transformAnthropicToOpenAI(anthropicResponse: Record<string, unknown>): Record<string, unknown> {
  let textContent = '';
  if (Array.isArray(anthropicResponse.content)) {
    for (const item of anthropicResponse.content as Array<{ type: string; text?: string }>) {
      if (item.type === 'text' && item.text) textContent += item.text;
    }
  }
  const usage = anthropicResponse.usage as { input_tokens?: number; output_tokens?: number } | undefined;
  return {
    id: anthropicResponse.id || `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: anthropicResponse.model || 'claude-unknown',
    choices: [{ index: 0, message: { role: 'assistant', content: textContent }, finish_reason: 'stop' }],
    usage: usage ? { prompt_tokens: usage.input_tokens || 0, completion_tokens: usage.output_tokens || 0, total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0) } : undefined,
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

router.options('/preview', (req: Request, res: Response) => {
  res.set(CORS_HEADERS).status(200).end();
});

router.post('/preview', async (req: Request, res: Response) => {
  res.set(CORS_HEADERS);
  try {
    const body = req.body as {
      messages?: ChatMessage[];
      model?: string;
      connectionPreset?: ConnectionPreset;
      chatCompletionPreset?: ChatCompletionPreset;
    };

    if (!body.messages || body.messages.length === 0) {
      res.status(400).json({ error: 'Messages are required' });
      return;
    }

    const connectionPreset = body.connectionPreset || serverState.activeConnectionPreset;
    const chatCompletionPreset = body.chatCompletionPreset || serverState.activeChatCompletionPreset;

    let postProcessingMode: PromptPostProcessingMode;
    if (connectionPreset?.promptPostProcessing && connectionPreset.promptPostProcessing !== 'none') {
      postProcessingMode = connectionPreset.promptPostProcessing;
    } else if (serverState.defaultPostProcessing && serverState.defaultPostProcessing !== 'none') {
      postProcessingMode = serverState.defaultPostProcessing;
    } else {
      postProcessingMode = 'none';
    }

    const janitorRequest = {
      messages: body.messages,
      model: body.model || connectionPreset?.model || '',
      stream: false as const,
    };

    const janitorData = parseJanitorRequest(janitorRequest);
    const macroContext = janitorDataToMacroContext(janitorData);
    const regexScripts = serverState.activeRegexScripts.filter(s => !s.disabled);

    let processedMessages: OutputMessage[];
    if (chatCompletionPreset) {
      processedMessages = buildMessages(chatCompletionPreset, janitorData, macroContext);
    } else {
      processedMessages = body.messages.map(msg => ({
        role: msg.role,
        content: processMacros(msg.content, macroContext),
      }));
    }

    if (regexScripts.length > 0) {
      const inputScripts = regexScripts.filter(s => s.placement.includes(1));
      if (inputScripts.length > 0) {
        processedMessages = processedMessages.map(msg => ({
          ...msg,
          content: applyRegexScripts(msg.content, inputScripts, macroContext, 1, undefined, msg.role),
        }));
      }
    }

    if (postProcessingMode !== 'none') {
      processedMessages = applyPostProcessing(processedMessages, postProcessingMode, {
        strictPlaceholderMessage: serverState.strictPlaceholderMessage,
      });
    }

    const samplerParams = chatCompletionPreset?.sampler ?? DEFAULT_SAMPLER_SETTINGS;
    const samplerEnabled = chatCompletionPreset?.samplerEnabled ?? {};

    const isEnabled = (key: string): boolean => {
      const enabled = samplerEnabled as Record<string, boolean | undefined>;
      if (enabled[key] !== undefined) return enabled[key] === true;
      if (key === 'openai_max_tokens') return true;
      const value = (samplerParams as Record<string, unknown>)[key];
      const defaultValue = (DEFAULT_SAMPLER_SETTINGS as Record<string, unknown>)[key];
      return value !== defaultValue;
    };

    const buildParams: Record<string, unknown> = {};
    if (isEnabled('temperature')) buildParams.temperature = samplerParams.temperature;
    if (isEnabled('top_p')) buildParams.top_p = samplerParams.top_p;
    if (isEnabled('openai_max_tokens')) buildParams.max_tokens = samplerParams.openai_max_tokens;
    if (isEnabled('frequency_penalty')) buildParams.frequency_penalty = samplerParams.frequency_penalty;
    if (isEnabled('presence_penalty')) buildParams.presence_penalty = samplerParams.presence_penalty;
    if (isEnabled('top_k') && samplerParams.top_k > 0) buildParams.top_k = samplerParams.top_k;
    if (isEnabled('min_p') && samplerParams.min_p > 0) buildParams.min_p = samplerParams.min_p;
    if (isEnabled('repetition_penalty') && samplerParams.repetition_penalty !== 1) buildParams.repetition_penalty = samplerParams.repetition_penalty;
    if (isEnabled('seed') && samplerParams.seed !== -1) buildParams.seed = samplerParams.seed;

    const messagesWithTokens = processedMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
      tokens: estimateTokens(msg.content) + 4,
    }));

    const totalTokens = messagesWithTokens.reduce((acc, m) => acc + m.tokens, 0);
    const byRole: Record<string, number> = {};
    for (const m of messagesWithTokens) {
      byRole[m.role] = (byRole[m.role] || 0) + m.tokens;
    }

    res.json({
      messages: messagesWithTokens,
      samplerParams: buildParams,
      postProcessingMode,
      model: connectionPreset?.model || body.model || '(not set)',
      baseUrl: connectionPreset?.baseUrl || '(not set)',
      presetName: chatCompletionPreset?.name || null,
      connectionName: connectionPreset?.name || null,
      totalMessages: messagesWithTokens.length,
      totalTokens,
      byRole,
      inputMessageCount: body.messages.length,
    });
  } catch (error) {
    console.error('[Preview] Error:', error);
    res.status(500).json({ error: `Preview error: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
});

router.options('/chat-completion', (req: Request, res: Response) => {
  res.set(CORS_HEADERS).status(200).end();
});

router.post('/chat-completion', async (req: Request, res: Response) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const body = req.body as {
      messages?: ChatMessage[];
      model?: string;
      stream?: boolean;
      temperature?: number;
      max_tokens?: number;
      connectionPreset?: ConnectionPreset;
      chatCompletionPreset?: ChatCompletionPreset;
    };

    res.set(CORS_HEADERS);

    // Validate JanitorAI API key if one is configured
    const storedKey = _authState.data.janitorApiKey;
    if (storedKey) {
      const incomingKey =
        req.headers['x-api-key'] as string ||
        (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
      if (!incomingKey || !verifyJanitorApiKey(incomingKey)) {
        res.status(401).json({ error: 'Invalid or missing API key. Set the API key shown on your Janitor\'s Tavern dashboard in the JanitorAI API key field.' });
        return;
      }
    }

    if (!body.messages || body.messages.length === 0) {
      res.status(400).json({ error: 'Messages are required' });
      return;
    }

    const connectionPreset = body.connectionPreset || serverState.activeConnectionPreset;
    const chatCompletionPreset = body.chatCompletionPreset || serverState.activeChatCompletionPreset;

    if (!connectionPreset) {
      res.status(400).json({ error: 'No connection preset configured. Please set an active connection in the dashboard.' });
      return;
    }

    let apiKey = '';
    let selectedKeyId: string | undefined;
    if (connectionPreset.apiKeyRef === 'env' && connectionPreset.apiKeyEnvVar) {
      apiKey = process.env[connectionPreset.apiKeyEnvVar] || '';
    } else if (
      connectionPreset.apiKeys &&
      connectionPreset.apiKeys.length > 1 &&
      (connectionPreset.roundRobinEnabled || !connectionPreset.selectedKeyId)
    ) {
      const rrKey = selectKeyRoundRobin(connectionPreset);
      apiKey = rrKey?.apiKey || '';
      selectedKeyId = rrKey?.keyId;
    } else {
      const selectedKey = connectionPreset.selectedKeyId
        ? connectionPreset.apiKeys?.find(k => k.id === connectionPreset.selectedKeyId)
        : null;
      const resolvedKey = selectedKey || connectionPreset.apiKeys?.[0] || null;
      apiKey = resolvedKey?.value || '';
      selectedKeyId = resolvedKey?.id;
      if (selectedKeyId) {
        recordKeyUsage(connectionPreset.id, selectedKeyId);
      }
    }

    if (!apiKey) {
      res.status(400).json({ error: 'API key not configured for the active connection' });
      return;
    }

    const janitorRequest = {
      messages: body.messages,
      model: body.model || connectionPreset.model,
      stream: body.stream,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
    };

    const janitorData = parseJanitorRequest(janitorRequest);
    const macroContext = janitorDataToMacroContext(janitorData);

    let postProcessingMode: PromptPostProcessingMode;
    if (connectionPreset.promptPostProcessing && connectionPreset.promptPostProcessing !== 'none') {
      postProcessingMode = connectionPreset.promptPostProcessing;
    } else if (serverState.defaultPostProcessing && serverState.defaultPostProcessing !== 'none') {
      postProcessingMode = serverState.defaultPostProcessing;
    } else {
      postProcessingMode = 'none';
    }

    const regexScripts = serverState.activeRegexScripts.filter(s => !s.disabled);

    let processedMessages: OutputMessage[];
    if (chatCompletionPreset) {
      processedMessages = buildMessages(chatCompletionPreset, janitorData, macroContext);
    } else {
      processedMessages = body.messages.map(msg => ({
        role: msg.role,
        content: processMacros(msg.content, macroContext),
      }));
    }

    if (regexScripts.length > 0) {
      const inputScripts = regexScripts.filter(s => s.placement.includes(1));
      if (inputScripts.length > 0) {
        processedMessages = processedMessages.map(msg => ({
          ...msg,
          content: applyRegexScripts(msg.content, inputScripts, macroContext, 1, undefined, msg.role),
        }));
      }
    }

    if (postProcessingMode !== 'none') {
      processedMessages = applyPostProcessing(processedMessages, postProcessingMode, {
        strictPlaceholderMessage: serverState.strictPlaceholderMessage,
      });
    }

    const samplerParams = chatCompletionPreset?.sampler ?? DEFAULT_SAMPLER_SETTINGS;
    const samplerEnabled = chatCompletionPreset?.samplerEnabled ?? {};

    const isEnabled = (key: string): boolean => {
      const enabled = samplerEnabled as Record<string, boolean | undefined>;
      if (enabled[key] !== undefined) return enabled[key] === true;
      if (key === 'openai_max_tokens') return true;
      const value = (samplerParams as Record<string, unknown>)[key];
      const defaultValue = (DEFAULT_SAMPLER_SETTINGS as Record<string, unknown>)[key];
      return value !== defaultValue;
    };

    const buildParams: Record<string, unknown> = {};
    if (isEnabled('temperature')) buildParams.temperature = samplerParams.temperature;
    if (isEnabled('top_p')) buildParams.top_p = samplerParams.top_p;
    if (isEnabled('openai_max_tokens')) buildParams.max_tokens = samplerParams.openai_max_tokens;
    if (isEnabled('frequency_penalty')) buildParams.frequency_penalty = samplerParams.frequency_penalty;
    if (isEnabled('presence_penalty')) buildParams.presence_penalty = samplerParams.presence_penalty;
    if (isEnabled('top_k') && samplerParams.top_k > 0) buildParams.top_k = samplerParams.top_k;
    if (isEnabled('min_p') && samplerParams.min_p > 0) buildParams.min_p = samplerParams.min_p;
    if (isEnabled('repetition_penalty') && samplerParams.repetition_penalty !== 1) buildParams.repetition_penalty = samplerParams.repetition_penalty;
    if (isEnabled('seed') && samplerParams.seed !== -1) buildParams.seed = samplerParams.seed;

    const startReplyWith = chatCompletionPreset?.advancedSettings?.startReplyWith;
    const startReplyContent = startReplyWith?.enabled ? startReplyWith.content : '';

    const model = connectionPreset.model;
    const baseUrl = connectionPreset.baseUrl;
    let activeHeaders = getAuthHeaders(baseUrl, apiKey, connectionPreset.extraHeaders);
    const inputTokensEstimate = calculateMessageTokens(processedMessages);
    const isAnthropic = isAnthropicUrl(baseUrl);

    const keyName = connectionPreset.apiKeys?.find(k => k.id === selectedKeyId)?.name || selectedKeyId || 'env';

    if (body.stream === true) {
      let requestBody: Record<string, unknown>;
      let endpoint: string;
      if (isAnthropic) {
        requestBody = buildAnthropicRequest(processedMessages, model, buildParams, true);
        endpoint = buildExtraQueryUrl(baseUrl, '/v1/messages', connectionPreset.extraQueryParams);
      } else {
        requestBody = buildOpenAIRequest(processedMessages, model, buildParams, true);
        endpoint = buildExtraQueryUrl(baseUrl, '/chat/completions', connectionPreset.extraQueryParams);
      }

      let upstreamRes = await fetch(endpoint, {
        method: 'POST',
        headers: { ...activeHeaders, Accept: 'text/event-stream' },
        body: JSON.stringify(requestBody),
      });

      let activeApiKey = apiKey;
      let activeKeyId = selectedKeyId;
      let activeKeyName = keyName;

      if (upstreamRes.status === 429 && connectionPreset.roundRobinEnabled && selectedKeyId) {
        const nextKey = advanceToNextKey(connectionPreset, selectedKeyId);
        if (nextKey) {
          activeApiKey = nextKey.apiKey;
          activeKeyId = nextKey.keyId;
          activeKeyName = connectionPreset.apiKeys?.find(k => k.id === nextKey.keyId)?.name || nextKey.keyId;
          activeHeaders = getAuthHeaders(baseUrl, activeApiKey, connectionPreset.extraHeaders);
          upstreamRes = await fetch(endpoint, {
            method: 'POST',
            headers: { ...activeHeaders, Accept: 'text/event-stream' },
            body: JSON.stringify(requestBody),
          });
        }
      }

      if (!upstreamRes.ok) {
        const errorText = await upstreamRes.text();
        res.status(upstreamRes.status).json({ error: `Provider error: ${upstreamRes.status} - ${errorText}` });
        return;
      }

      if (!upstreamRes.body) {
        res.status(500).json({ error: 'No response body from provider' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Key-Used', activeKeyName);

      const reader = upstreamRes.body.getReader();
      const decoder = new TextDecoder();
      let outputTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          let text = decoder.decode(value, { stream: true });

          if (isAnthropic && text.includes('event:') && text.includes('data:')) {
            text = transformAnthropicStreamChunk(text);
            if (text === '') continue;
          }

          const tokenCounts = extractTokenCountsFromStreamChunk(text);
          if (tokenCounts) outputTokens = tokenCounts.completionTokens;

          if (startReplyContent && text.includes('"delta"') && text.includes('"content"')) {
            const contentMatch = text.match(/("content":\s*")([^"]*)(")/);
            if (contentMatch) {
              const outputScripts = regexScripts.filter(s => s.placement.includes(2));
              let newContent = startReplyContent + contentMatch[2];
              if (outputScripts.length > 0) {
                newContent = applyRegexScripts(newContent, outputScripts, macroContext, 2, undefined, 'assistant');
              }
              const escaped = newContent.replace(/"/g, '\\"').replace(/\n/g, '\\n');
              text = text.replace(/("content":\s*")([^"]*)(")/,  `$1${escaped}$3`);
            }
          }

          res.write(text);
        }
      } finally {
        reader.releaseLock();
      }

      recordUsage(inputTokensEstimate, outputTokens);
      res.end();
      return;
    }

    let requestBody: Record<string, unknown>;
    let endpoint: string;
    if (isAnthropic) {
      requestBody = buildAnthropicRequest(processedMessages, model, buildParams, false);
      endpoint = buildExtraQueryUrl(baseUrl, '/v1/messages', connectionPreset.extraQueryParams);
    } else {
      requestBody = buildOpenAIRequest(processedMessages, model, buildParams, false);
      endpoint = buildExtraQueryUrl(baseUrl, '/chat/completions', connectionPreset.extraQueryParams);
    }

    let upstreamRes = await fetch(endpoint, {
      method: 'POST',
      headers: { ...activeHeaders, Accept: 'application/json' },
      body: JSON.stringify(requestBody),
    });

    let activeKeyName = keyName;

    if (upstreamRes.status === 429 && connectionPreset.roundRobinEnabled && selectedKeyId) {
      const nextKey = advanceToNextKey(connectionPreset, selectedKeyId);
      if (nextKey) {
        activeKeyName = connectionPreset.apiKeys?.find(k => k.id === nextKey.keyId)?.name || nextKey.keyId;
        const retryHeaders = getAuthHeaders(baseUrl, nextKey.apiKey, connectionPreset.extraHeaders);
        upstreamRes = await fetch(endpoint, {
          method: 'POST',
          headers: { ...retryHeaders, Accept: 'application/json' },
          body: JSON.stringify(requestBody),
        });
      }
    }

    res.setHeader('X-Key-Used', activeKeyName);

    const rawBody = await upstreamRes.text();

    let outputTokens = 0;
    try {
      const tokenCounts = extractTokenCountsFromResponse(rawBody);
      if (tokenCounts) outputTokens = tokenCounts.completionTokens;
    } catch {}
    recordUsage(inputTokensEstimate, outputTokens);

    try {
      let responseJson = JSON.parse(rawBody);
      if (isAnthropic && responseJson.type === 'message' && Array.isArray(responseJson.content)) {
        responseJson = transformAnthropicToOpenAI(responseJson);
      }

      if (responseJson.choices?.[0]?.message?.content) {
        let content = responseJson.choices[0].message.content;
        if (startReplyContent) content = startReplyContent + content;
        const outputScripts = regexScripts.filter(s => s.placement.includes(2));
        if (outputScripts.length > 0) {
          content = applyRegexScripts(content, outputScripts, macroContext, 2, undefined, 'assistant');
        }
        responseJson.choices[0].message.content = content;
      }

      res.status(upstreamRes.status).json(responseJson);
    } catch {
      res.status(upstreamRes.status).set('Content-Type', 'application/json').send(rawBody);
    }
  } catch (error) {
    console.error('[Proxy] Error:', error);
    res.status(500).json({ error: `Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
});

router.get('/models', async (req: Request, res: Response) => {
  res.set(CORS_HEADERS);
  try {
    const { baseUrl, apiKey: apiKeyParam } = req.query as { baseUrl?: string; apiKey?: string };
    const connectionId = req.query.connectionId as string | undefined;

    let finalBaseUrl = baseUrl;
    let finalApiKey = apiKeyParam;

    if (!finalBaseUrl || !finalApiKey) {
      const conn = serverState.activeConnectionPreset;
      if (conn) {
        finalBaseUrl = finalBaseUrl || conn.baseUrl;
        if (!finalApiKey) {
          const selectedKey = conn.selectedKeyId ? conn.apiKeys?.find(k => k.id === conn.selectedKeyId) : null;
          finalApiKey = selectedKey?.value || conn.apiKeys?.[0]?.value || '';
        }
      }
    }

    if (!finalBaseUrl || !finalApiKey) {
      res.status(400).json({ error: 'baseUrl and apiKey are required' });
      return;
    }

    const headers = getAuthHeaders(finalBaseUrl, finalApiKey);
    const endpoint = `${finalBaseUrl.replace(/\/$/, '')}/models`;
    const upstreamRes = await fetch(endpoint, { headers });

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text();
      res.status(upstreamRes.status).json({ error: `Failed to fetch models: ${errorText}` });
      return;
    }

    const data = await upstreamRes.json() as Record<string, unknown>;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch models: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
});

router.post('/test-connection', async (req: Request, res: Response) => {
  res.set(CORS_HEADERS);
  try {
    const { baseUrl, apiKey, model } = req.body as { baseUrl?: string; apiKey?: string; model?: string };
    if (!baseUrl || !apiKey || !model) {
      res.status(400).json({ error: 'baseUrl, apiKey, and model are required' });
      return;
    }

    const headers = getAuthHeaders(baseUrl, apiKey);
    const isAnthropic = isAnthropicUrl(baseUrl);

    if (isAnthropic) {
      const requestBody = { model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 };
      const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
      const upstreamRes = await fetch(endpoint, {
        method: 'POST',
        headers: { ...headers, Accept: 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (upstreamRes.ok) {
        const data = await upstreamRes.json() as Record<string, unknown>;
        if (Array.isArray(data.content) && data.content.length > 0) {
          res.json({ success: true, message: 'Connection successful - API key validated' });
        } else {
          res.json({ success: false, message: 'Connection failed: Invalid response format' });
        }
      } else {
        const errorText = await upstreamRes.text();
        res.json({ success: false, message: `Connection failed: ${upstreamRes.status} - ${errorText}` });
      }
    } else {
      const requestBody = { model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 };
      const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      const upstreamRes = await fetch(endpoint, {
        method: 'POST',
        headers: { ...headers, Accept: 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (upstreamRes.ok) {
        const data = await upstreamRes.json() as Record<string, unknown>;
        const choices = data.choices as Array<unknown> | undefined;
        if (choices && choices.length > 0) {
          res.json({ success: true, message: 'Connection successful - API key validated' });
        } else {
          res.json({ success: false, message: 'Connection failed: Invalid response format' });
        }
      } else {
        const errorText = await upstreamRes.text();
        res.json({ success: false, message: `Connection failed: ${upstreamRes.status} - ${errorText}` });
      }
    }
  } catch (error) {
    res.json({ success: false, message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
});

export default router;

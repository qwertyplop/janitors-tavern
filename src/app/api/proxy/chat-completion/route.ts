import { NextRequest, NextResponse } from 'next/server';
import { createProviderFromPreset } from '@/providers';
import { ProviderRequest } from '@/providers/base';
import {
  ConnectionPreset,
  ChatCompletionPreset,
  ChatMessage,
} from '@/types';
import {
  logRequest,
  logProcessedRequest,
  logResponse,
  logError,
  generateRequestId,
} from '@/lib/vercel-logger';
import { parseJanitorRequest, janitorDataToMacroContext, JanitorRequest } from '@/lib/janitor-parser';
import { processMacros, MacroContext } from '@/lib/macros';
import { buildMessages as buildPresetMessages, OutputMessage } from '@/lib/prompt-builder';
import {
  getDefaultConnectionPreset,
  getDefaultChatCompletionPreset,
} from '@/lib/server-storage';
import { recordUsage, calculateMessageTokens, estimateTokens } from '@/lib/stats';

// ============================================
// Request Types
// ============================================

interface ProxyRequest {
  // Raw messages from JanitorAI
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;

  // Presets (loaded from client localStorage and sent with request)
  connectionPreset?: ConnectionPreset;
  chatCompletionPreset?: ChatCompletionPreset;
}

// ============================================
// Message Building (Legacy fallback)
// ============================================

function buildMessagesLegacy(
  messages: ChatMessage[],
  context: MacroContext
): OutputMessage[] {
  // Simple passthrough with macro processing
  return messages.map(msg => ({
    role: msg.role,
    content: processMacros(msg.content, context),
  }));
}

// ============================================
// Full Message Building with ChatCompletionPreset
// ============================================

function buildMessagesWithPreset(
  preset: ChatCompletionPreset,
  janitorRequest: JanitorRequest,
  context: MacroContext
): OutputMessage[] {
  const janitorData = parseJanitorRequest(janitorRequest);

  // Enrich context with parsed Janitor data
  const enrichedContext: MacroContext = {
    ...context,
    ...janitorDataToMacroContext(janitorData),
  };

  // Use the prompt builder to construct messages
  return buildPresetMessages(preset, janitorData, enrichedContext);
}

// ============================================
// Squash Consecutive System Messages
// ============================================

function squashSystemMessages(messages: OutputMessage[]): OutputMessage[] {
  if (messages.length === 0) return [];

  const result: OutputMessage[] = [];
  let currentSystemContent: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      currentSystemContent.push(msg.content);
    } else {
      // Flush accumulated system messages
      if (currentSystemContent.length > 0) {
        result.push({
          role: 'system',
          content: currentSystemContent.join('\n'),
        });
        currentSystemContent = [];
      }
      result.push(msg);
    }
  }

  // Flush any remaining system messages
  if (currentSystemContent.length > 0) {
    result.push({
      role: 'system',
      content: currentSystemContent.join('\n'),
    });
  }

  return result;
}

// ============================================
// Main Route Handler
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  try {
    const body: ProxyRequest = await request.json();

    // Use provided presets or load defaults from storage
    let connectionPreset = body.connectionPreset;
    let chatCompletionPreset = body.chatCompletionPreset;

    // If no presets provided, load defaults from Blob storage
    if (!connectionPreset) {
      connectionPreset = await getDefaultConnectionPreset() || undefined;
    }
    if (!chatCompletionPreset) {
      chatCompletionPreset = await getDefaultChatCompletionPreset() || undefined;
    }

    // Log the raw incoming request
    await logRequest(requestId, {
      url: request.url,
      method: 'POST',
      headers: Object.fromEntries(request.headers.entries()),
      body: body,
      incomingMessages: body.messages,
      connectionPreset: connectionPreset ? {
        name: connectionPreset.name,
        baseUrl: connectionPreset.baseUrl,
        model: connectionPreset.model,
      } : undefined,
      chatCompletionPreset: chatCompletionPreset ? {
        name: chatCompletionPreset.name,
      } : undefined,
    });

    // Validate required fields
    if (!body.messages || body.messages.length === 0) {
      const errorResponse = { error: 'Messages are required' };
      await logError(requestId, 'Messages are required', 'validation');
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Connection preset is required
    if (!connectionPreset) {
      const errorResponse = { error: 'Connection preset is required' };
      await logError(requestId, 'Connection preset is required', 'validation');
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Get API key
    let apiKey = '';
    if (connectionPreset.apiKeyRef === 'env' && connectionPreset.apiKeyEnvVar) {
      apiKey = process.env[connectionPreset.apiKeyEnvVar] || '';
    } else if (connectionPreset.apiKeyLocalEncrypted) {
      apiKey = connectionPreset.apiKeyLocalEncrypted;
    }

    if (!apiKey) {
      const errorResponse = { error: 'API key not configured' };
      await logError(requestId, 'API key not configured', 'validation');
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Build the JanitorAI request object
    const janitorRequest: JanitorRequest = {
      messages: body.messages,
      model: body.model || connectionPreset.model,
      stream: body.stream,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
    };

    // Parse Janitor data for context
    const janitorData = parseJanitorRequest(janitorRequest);
    const macroContext = janitorDataToMacroContext(janitorData);

    // Build messages
    let processedMessages: OutputMessage[];

    if (chatCompletionPreset) {
      // Use full ChatCompletionPreset processing
      processedMessages = buildMessagesWithPreset(
        chatCompletionPreset,
        janitorRequest,
        macroContext
      );

      // Apply squash if enabled in preset
      if (chatCompletionPreset.providerSettings?.squashSystemMessages) {
        processedMessages = squashSystemMessages(processedMessages);
      }
    } else {
      // Legacy: just process macros in existing messages
      processedMessages = buildMessagesLegacy(body.messages, macroContext);
    }

    // Get sampler parameters from preset
    const samplerParams = chatCompletionPreset?.sampler ?? {
      temperature: 1,
      top_p: 1,
      openai_max_tokens: 4096,
      frequency_penalty: 0,
      presence_penalty: 0,
      top_k: 0,
      repetition_penalty: 1,
    };

    // Create provider and send request
    const provider = createProviderFromPreset(connectionPreset, apiKey);

    const providerRequest: ProviderRequest = {
      messages: processedMessages as ChatMessage[],
      model: connectionPreset.model,
      parameters: {
        temperature: samplerParams.temperature,
        topP: samplerParams.top_p,
        maxTokens: samplerParams.openai_max_tokens,
        frequencyPenalty: samplerParams.frequency_penalty,
        presencePenalty: samplerParams.presence_penalty,
        topK: samplerParams.top_k,
        repetitionPenalty: samplerParams.repetition_penalty,
      },
      extraHeaders: connectionPreset.extraHeaders,
    };

    // Log the processed request being sent to provider
    await logProcessedRequest(requestId, {
      processedMessages,
      samplerSettings: samplerParams,
      providerUrl: connectionPreset.baseUrl,
      model: connectionPreset.model,
    });

    const result = await provider.sendChatCompletion(providerRequest);

    if (result.error) {
      const errorResponse = { error: result.error };
      await logError(requestId, result.error, 'provider');
      await logResponse(requestId, {
        status: 502,
        response: errorResponse,
      }, Date.now() - startTime);
      return NextResponse.json(errorResponse, { status: 502 });
    }

    const successResponse = {
      message: result.message,
      usage: result.usage,
      debug: result.debug,
    };

    // Log the successful response
    await logResponse(requestId, {
      status: 200,
      response: successResponse,
      message: result.message?.content,
      usage: result.usage,
    }, Date.now() - startTime);

    // Record usage statistics
    try {
      let inputTokens: number;
      let outputTokens: number;

      if (result.usage?.promptTokens && result.usage?.completionTokens) {
        // Use actual token counts from API response
        inputTokens = result.usage.promptTokens;
        outputTokens = result.usage.completionTokens;
      } else {
        // Estimate tokens from messages
        inputTokens = calculateMessageTokens(processedMessages);
        outputTokens = result.message?.content ? estimateTokens(result.message.content) : 0;
      }

      await recordUsage(inputTokens, outputTokens);
    } catch (statsError) {
      // Don't fail the request if stats recording fails
      console.error('Failed to record usage stats:', statsError);
    }

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error('Proxy error:', error);

    await logError(requestId, error, 'proxy');

    const errorResponse = {
      error: `Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };

    await logResponse(requestId, {
      status: 500,
      response: errorResponse,
    }, Date.now() - startTime);

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

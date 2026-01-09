import { NextRequest, NextResponse } from 'next/server';
import { createProviderFromPreset } from '@/providers';
import { ProviderRequest } from '@/providers/base';
import { OpenAICompatibleProvider } from '@/providers/openai-compatible';
import {
  ConnectionPreset,
  ChatCompletionPreset,
  ChatMessage,
  PromptPostProcessingMode,
} from '@/types';
import {
  logRequest,
  logProcessedRequest,
  logResponse,
  logError,
  generateRequestId,
} from '@/lib/logger';
import { parseJanitorRequest, janitorDataToMacroContext, JanitorRequest } from '@/lib/janitor-parser';
import { processMacros, MacroContext } from '@/lib/macros';
import { buildMessages as buildPresetMessages, OutputMessage } from '@/lib/prompt-builder';
import {
  getDefaultConnectionPreset,
  getDefaultChatCompletionPreset,
  getServerSettings,
  getServerRegexScripts,
} from '@/lib/server-storage';
import { recordUsage, calculateMessageTokens } from '@/lib/stats';
import { applyRegexScripts } from '@/lib/regex-processor';

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
// Post-Processing Functions
// ============================================

/**
 * Merge consecutive messages from the same role
 */
function mergeConsecutiveMessages(messages: OutputMessage[]): OutputMessage[] {
  if (messages.length === 0) return [];

  const result: OutputMessage[] = [];
  let currentRole: string | null = null;
  let currentContent: string[] = [];

  for (const msg of messages) {
    if (msg.role === currentRole) {
      currentContent.push(msg.content);
    } else {
      // Flush accumulated messages
      if (currentRole && currentContent.length > 0) {
        result.push({
          role: currentRole as 'system' | 'user' | 'assistant',
          content: currentContent.join('\n\n'),
        });
      }
      currentRole = msg.role;
      currentContent = [msg.content];
    }
  }

  // Flush remaining messages
  if (currentRole && currentContent.length > 0) {
    result.push({
      role: currentRole as 'system' | 'user' | 'assistant',
      content: currentContent.join('\n\n'),
    });
  }

  return result;
}

/**
 * Semi-strict mode: Merge roles, allow only one optional system message at start
 */
function semiStrictProcess(messages: OutputMessage[]): OutputMessage[] {
  const merged = mergeConsecutiveMessages(messages);
  if (merged.length === 0) return [];

  // Collect all system messages into one at the start
  const systemContents: string[] = [];
  const nonSystemMessages: OutputMessage[] = [];

  for (const msg of merged) {
    if (msg.role === 'system') {
      systemContents.push(msg.content);
    } else {
      nonSystemMessages.push(msg);
    }
  }

  const result: OutputMessage[] = [];
  if (systemContents.length > 0) {
    result.push({
      role: 'system',
      content: systemContents.join('\n\n'),
    });
  }

  return [...result, ...nonSystemMessages];
}

/**
 * Strict mode: Merge roles, one system msg, ensure user message comes first after system
 */
function strictProcess(messages: OutputMessage[]): OutputMessage[] {
  const semiStrict = semiStrictProcess(messages);
  if (semiStrict.length === 0) return [];

  // Find system message and non-system messages
  const systemMsg = semiStrict.find(m => m.role === 'system');
  const nonSystem = semiStrict.filter(m => m.role !== 'system');

  // Ensure first non-system message is from user
  if (nonSystem.length > 0 && nonSystem[0].role !== 'user') {
    // Prepend an empty user message or adjust
    nonSystem.unshift({
      role: 'user',
      content: '[Start]',
    });
  }

  const result: OutputMessage[] = [];
  if (systemMsg) result.push(systemMsg);
  result.push(...nonSystem);

  return result;
}

/**
 * Single user mode: Merge all messages into a single user message
 */
function singleUserProcess(messages: OutputMessage[]): OutputMessage[] {
  if (messages.length === 0) return [];

  const allContent = messages.map(m => {
    const roleLabel = m.role.charAt(0).toUpperCase() + m.role.slice(1);
    return `[${roleLabel}]\n${m.content}`;
  }).join('\n\n');

  return [{
    role: 'user',
    content: allContent,
  }];
}

/**
 * Apply post-processing based on mode
 */
function applyPostProcessing(
  messages: OutputMessage[],
  mode: PromptPostProcessingMode
): OutputMessage[] {
  switch (mode) {
    case 'none':
      return messages;
    case 'merge':
    case 'merge-tools':
      return mergeConsecutiveMessages(messages);
    case 'semi-strict':
    case 'semi-strict-tools':
      return semiStrictProcess(messages);
    case 'strict':
    case 'strict-tools':
      return strictProcess(messages);
    case 'single-user':
      return singleUserProcess(messages);
    default:
      return messages;
  }
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

    // If no presets provided, load defaults from Firebase storage
    if (!connectionPreset) {
      connectionPreset = await getDefaultConnectionPreset() || undefined;
    }
    if (!chatCompletionPreset) {
      chatCompletionPreset = await getDefaultChatCompletionPreset() || undefined;
    }

    // Filter out identifying headers for logging (privacy)
    const safeHeaders: Record<string, string> = {};
    const sensitiveHeaderPrefixes = ['cf-', 'x-forwarded', 'x-real', 'origin', 'referer', 'sec-'];
    for (const [key, value] of request.headers.entries()) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveHeaderPrefixes.some(prefix => lowerKey.startsWith(prefix));
      if (!isSensitive) {
        safeHeaders[key] = value;
      }
    }

    // Fire-and-forget: Log the raw incoming request (don't block processing)
    logRequest(requestId, {
      url: request.url,
      method: 'POST',
      headers: safeHeaders,
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
    }).catch(() => {});

    // Helper for error responses with CORS
    const errorWithCors = (message: string, status: number) => {
      logError(requestId, message, 'validation').catch(() => {});
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    };

    // Validate required fields
    if (!body.messages || body.messages.length === 0) {
      return errorWithCors('Messages are required', 400);
    }

    // Connection preset is required
    if (!connectionPreset) {
      return errorWithCors('Connection preset is required', 400);
    }

    // Get API key
    let apiKey = '';
    if (connectionPreset.apiKeyRef === 'env' && connectionPreset.apiKeyEnvVar) {
      apiKey = process.env[connectionPreset.apiKeyEnvVar] || '';
    } else if (connectionPreset.apiKeyLocalEncrypted) {
      apiKey = connectionPreset.apiKeyLocalEncrypted;
    }

    if (!apiKey) {
      return errorWithCors('API key not configured', 400);
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

    // Get settings for post-processing mode
    const settings = await getServerSettings();
    console.log(`[JT] [${requestId}] Settings retrieved:`, JSON.stringify(settings, null, 2));
    console.log(`[JT] [${requestId}] Connection preset promptPostProcessing:`, connectionPreset.promptPostProcessing);
    console.log(`[JT] [${requestId}] Settings defaultPostProcessing:`, settings.defaultPostProcessing);
    const postProcessingMode: PromptPostProcessingMode =
      connectionPreset.promptPostProcessing ||
      settings.defaultPostProcessing ||
      'none';
    console.log(`[JT] [${requestId}] Final postProcessingMode:`, postProcessingMode);

    // Load regex scripts for processing
    const regexScripts = await getServerRegexScripts();
    console.log(`[JT] [${requestId}] Regex scripts loaded: Found ${regexScripts.length} scripts`);
    if (regexScripts.length > 0) {
      regexScripts.forEach((script, index) => {
        console.log(`[JT] [${requestId}] Script ${index + 1}: "${script.scriptName}" - Affects: ${script.placement.map(p => p === 1 ? 'Input' : 'Output').join(', ')}`);
      });
    } else {
      console.log(`[JT] [${requestId}] No regex scripts found or loaded`);
    }

    // Build messages
    let processedMessages: OutputMessage[];

    if (chatCompletionPreset) {
      // Use full ChatCompletionPreset processing
      processedMessages = buildMessagesWithPreset(
        chatCompletionPreset,
        janitorRequest,
        macroContext
      );
    } else {
      // Legacy: just process macros in existing messages
      processedMessages = buildMessagesLegacy(body.messages, macroContext);
    }

    // Apply regex scripts (placement 1) to each message
    if (regexScripts.length > 0) {
      const inputScripts = regexScripts.filter(s => s.placement.includes(1));
      if (inputScripts.length > 0) {
        console.log(`[JT] [${requestId}] Applying ${inputScripts.length} regex script(s) to input messages (placement 1)`);
        processedMessages = processedMessages.map(msg => ({
          ...msg,
          content: applyRegexScripts(msg.content, inputScripts, macroContext, 1, undefined, msg.role)
        }));
      }
    }

    // Apply post-processing based on mode
    if (postProcessingMode !== 'none') {
      processedMessages = applyPostProcessing(processedMessages, postProcessingMode);
    }

    // Get sampler parameters from preset (only include enabled ones)
    const samplerParams = chatCompletionPreset?.sampler ?? {
      temperature: 1,
      top_p: 1,
      openai_max_tokens: 4096,
      frequency_penalty: 0,
      presence_penalty: 0,
      top_k: 0,
      repetition_penalty: 1,
    };
    const samplerEnabled = chatCompletionPreset?.samplerEnabled ?? {};

    // Helper to check if a setting is enabled (default: true)
    const isEnabled = (key: string): boolean => {
      return samplerEnabled[key as keyof typeof samplerEnabled] !== false;
    };

    // Build parameters object with only enabled settings
    const parameters: ProviderRequest['parameters'] = {};
    if (isEnabled('temperature')) {
      parameters.temperature = samplerParams.temperature;
    }
    if (isEnabled('top_p')) {
      parameters.topP = samplerParams.top_p;
    }
    if (isEnabled('openai_max_tokens')) {
      parameters.maxTokens = samplerParams.openai_max_tokens;
    }
    if (isEnabled('frequency_penalty')) {
      parameters.frequencyPenalty = samplerParams.frequency_penalty;
    }
    if (isEnabled('presence_penalty')) {
      parameters.presencePenalty = samplerParams.presence_penalty;
    }
    if (isEnabled('top_k') && samplerParams.top_k !== undefined) {
      parameters.topK = samplerParams.top_k;
    }
    if (isEnabled('repetition_penalty') && samplerParams.repetition_penalty !== undefined) {
      parameters.repetitionPenalty = samplerParams.repetition_penalty;
    }

    // Get "Start Reply With" settings
    const startReplyWith = chatCompletionPreset?.advancedSettings?.startReplyWith;
    const startReplyContent = startReplyWith?.enabled ? startReplyWith.content : '';

    // Create provider and send request
    const provider = createProviderFromPreset(connectionPreset, apiKey);

    const providerRequest: ProviderRequest = {
      messages: processedMessages as ChatMessage[],
      model: connectionPreset.model,
      parameters,
      extraHeaders: connectionPreset.extraHeaders,
    };

    // Fire-and-forget: Log the processed request (don't block the actual request)
    logProcessedRequest(requestId, {
      processedMessages,
      samplerSettings: parameters, // Only log enabled settings
      providerUrl: connectionPreset.baseUrl,
      model: connectionPreset.model,
      streaming: body.stream === true,
      postProcessingMode: postProcessingMode,
    }).catch(() => {});

    // Calculate input tokens once for stats (used in both streaming and non-streaming)
    const inputTokensEstimate = calculateMessageTokens(processedMessages);

    // Handle streaming requests
    if (body.stream === true && provider instanceof OpenAICompatibleProvider) {
      const streamResult = await provider.sendChatCompletionStream(providerRequest);

      if (streamResult.error) {
        logError(requestId, streamResult.error, 'provider').catch(() => {});
        logResponse(requestId, {
          status: 502,
          response: { error: streamResult.error },
        }, Date.now() - startTime).catch(() => {});
        return new Response(JSON.stringify({ error: streamResult.error }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      // Build response headers - pass through provider headers except excluded ones
      // (Same approach as Python proxy)
      const excludedHeaders = ['content-encoding', 'content-length', 'transfer-encoding', 'connection'];
      const responseHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Pass through provider's headers (filtered)
      streamResult.headers.forEach((value, key) => {
        if (!excludedHeaders.includes(key.toLowerCase())) {
          responseHeaders[key] = value;
        }
      });

      // Log streaming response initiation
      console.log(`[JT] [${requestId}] STREAMING RESPONSE initiated (status: ${streamResult.status})`);

      // Fire-and-forget: Log and record stats without blocking the stream
      // This is critical - awaiting these would delay/break the stream response
      logResponse(requestId, {
        status: streamResult.status,
        response: { streaming: true },
      }, Date.now() - startTime).catch(() => {});

      recordUsage(inputTokensEstimate, 0).catch(() => {});

      // If startReplyWith is enabled, create a transform stream to prepend content
      if (startReplyContent) {
        let prefixSent = false;
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const transformStream = new TransformStream({
          transform(chunk, controller) {
            // Log raw chunk before any processing
            const rawText = decoder.decode(chunk, { stream: true });
            console.log(`[JT] [${requestId}] RAW STREAM CHUNK:`, rawText);

            // If prefix already sent, pass through as-is
            if (prefixSent) {
              controller.enqueue(chunk);
              return;
            }

            // Decode chunk to inspect it
            const text = decoder.decode(chunk, { stream: true });

            // Check if this chunk contains content delta
            if (text.includes('"delta"') && text.includes('"content"')) {
              // Extract the content string, apply startReplyWith and regex scripts
              const contentMatch = text.match(/("content":\s*")([^"]*)(")/);
              let newContent = '';
              if (contentMatch) {
                const original = contentMatch[2];
                // Apply startReplyWith prefix
                const withPrefix = startReplyContent + original;
                // Apply regex scripts (placement 2) to the content
                // For streaming, we assume it's assistant output (role: 'assistant')
                const outputScripts = regexScripts.filter(s => s.placement.includes(2));
                if (outputScripts.length > 0) {
                  console.log(`[JT] [${requestId}] Applying ${outputScripts.length} regex script(s) to streaming AI output (placement 2)`);
                  newContent = applyRegexScripts(
                    withPrefix,
                    outputScripts,
                    macroContext,
                    2,
                    undefined,
                    'assistant'
                  );
                } else {
                  newContent = withPrefix;
                }
                // Escape any double quotes in the new content for JSON safety
                const escaped = newContent.replace(/"/g, '\\"').replace(/\n/g, '\\n');
                // Reconstruct the chunk with modified content
                const modifiedText = text.replace(
                  /("content":\s*")([^"]*)(")/,
                  `$1${escaped}$3`
                );
                controller.enqueue(encoder.encode(modifiedText));
              } else {
                // Fallback: no content field found, just pass through
                controller.enqueue(chunk);
              }
              prefixSent = true;
            } else {
              controller.enqueue(chunk);
            }
          },
        });

        const modifiedStream = streamResult.stream.pipeThrough(transformStream);

        return new Response(modifiedStream, {
          status: streamResult.status,
          headers: responseHeaders,
        });
      }

      // Return SSE stream response immediately - pure passthrough like Python proxy
      return new Response(streamResult.stream, {
        status: streamResult.status,
        headers: responseHeaders,
      });
    }

    // Non-streaming request - use raw passthrough like Python proxy
    if (provider instanceof OpenAICompatibleProvider) {
      const rawResult = await provider.sendChatCompletionRaw(providerRequest);

      // Log the FULL raw response body before any processing
      console.log(`[JT] [${requestId}] RAW RESPONSE BODY (before processing):`, rawResult.body);

      // Fire-and-forget logging
      logResponse(requestId, {
        status: rawResult.status,
        response: { raw: true, length: rawResult.body.length },
      }, Date.now() - startTime).catch(() => {});

      recordUsage(inputTokensEstimate, 0).catch(() => {});

      // Build response headers - pass through provider headers except excluded ones
      const excludedHeaders = ['content-encoding', 'content-length', 'transfer-encoding', 'connection'];
      const responseHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
      };

      rawResult.headers.forEach((value, key) => {
        if (!excludedHeaders.includes(key.toLowerCase())) {
          responseHeaders[key] = value;
        }
      });

      // Apply regex scripts (placement 2) and startReplyWith to AI output
      try {
        // Log the raw response body before JSON parsing
        console.log(`[JT] [${requestId}] RAW RESPONSE BODY (before JSON parsing):`, rawResult.body);
        
        const responseJson = JSON.parse(rawResult.body);
        if (responseJson.choices?.[0]?.message?.content) {
          let content = responseJson.choices[0].message.content;
          // Apply startReplyWith prefix if enabled
          if (startReplyContent) {
            content = startReplyContent + content;
          }
          // Apply regex scripts (placement 2)
          if (regexScripts.length > 0) {
            const outputScripts = regexScripts.filter(s => s.placement.includes(2));
            if (outputScripts.length > 0) {
              console.log(`[JT] [${requestId}] Applying ${outputScripts.length} regex script(s) to AI output (placement 2)`);
              content = applyRegexScripts(content, outputScripts, macroContext, 2, undefined, 'assistant');
            }
          }
          responseJson.choices[0].message.content = content;
        }
        return new Response(JSON.stringify(responseJson), {
          status: rawResult.status,
          headers: responseHeaders,
        });
      } catch (parseError) {
        // If parsing fails, log the error and return as-is (no regex processing)
        console.log(`[JT] [${requestId}] Failed to parse JSON response:`, parseError);
      }

      // Pure passthrough - return provider's response as-is
      return new Response(rawResult.body, {
        status: rawResult.status,
        headers: responseHeaders,
      });
    }

    // Fallback for non-OpenAI providers (shouldn't happen normally)
    const result = await provider.sendChatCompletion(providerRequest);

    if (result.error) {
      logError(requestId, result.error, 'provider').catch(() => {});
      return new Response(JSON.stringify({ error: result.error }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Log the raw response before processing
    console.log(`[JT] [${requestId}] RAW RESPONSE (fallback provider):`, JSON.stringify(result, null, 2));

    // Process AI output content with startReplyWith and regex scripts
    let aiContent = result.message?.content || '';
    if (startReplyContent) {
      aiContent = startReplyContent + aiContent;
    }
    if (regexScripts.length > 0) {
      const outputScripts = regexScripts.filter(s => s.placement.includes(2));
      if (outputScripts.length > 0) {
        console.log(`[JT] [${requestId}] Applying ${outputScripts.length} regex script(s) to AI output (placement 2)`);
        aiContent = applyRegexScripts(aiContent, outputScripts, macroContext, 2, undefined, 'assistant');
      }
    }

    const successResponse = {
      id: `chatcmpl-${requestId}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: connectionPreset.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant' as const,
            content: aiContent,
          },
          finish_reason: 'stop',
        },
      ],
    };

    recordUsage(inputTokensEstimate, 0).catch(() => {});
    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    // Log full error details for debugging
    console.error('Proxy error:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }

    // Fire-and-forget logging (don't block error response)
    logError(requestId, error, 'proxy').catch(() => {});

    const errorResponse = {
      error: `Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };

    logResponse(requestId, {
      status: 500,
      response: errorResponse,
    }, Date.now() - startTime).catch(() => {});

    // Include CORS headers in error response
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
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

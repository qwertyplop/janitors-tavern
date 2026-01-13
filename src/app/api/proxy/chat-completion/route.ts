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
import { recordUsage, calculateMessageTokens, extractTokenCountsFromResponse, extractTokenCountsFromStreamChunk } from '@/lib/stats';
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
 * Semi-strict mode: SillyTavern behavior
 * 1. Merge consecutive same-role messages
 * 2. Change system role to user for any system message after first
 * 3. Handle [assistant - system - user] or [user - system - assistant] patterns
 * 4. Second cycle of merging consecutives after role reassignment
 */
function semiStrictProcess(messages: OutputMessage[]): OutputMessage[] {
  // Step 1: First cycle of merging consecutive same-role messages
  const merged = mergeConsecutiveMessages(messages);
  if (merged.length === 0) return [];

  // Step 2: Process system messages after the first
  const processed: OutputMessage[] = [];
  let firstSystemFound = false;

  for (let i = 0; i < merged.length; i++) {
    const msg = merged[i];
    
    if (msg.role === 'system') {
      if (!firstSystemFound) {
        // Keep first system message as system
        processed.push(msg);
        firstSystemFound = true;
      } else {
        // Change subsequent system messages to user role
        processed.push({
          role: 'user',
          content: msg.content,
        });
      }
    } else {
      processed.push(msg);
    }
  }

  // Step 3: Handle [assistant - system - user] and [user - system - assistant] patterns
  // After role reassignment, system messages are now user messages
  // We need to merge them with adjacent user messages
  const finalMessages: OutputMessage[] = [];
  for (let i = 0; i < processed.length; i++) {
    const current = processed[i];
    
    if (current.role === 'user') {
      // Check if next message is also user (could be converted system or original user)
      let j = i + 1;
      while (j < processed.length && processed[j].role === 'user') {
        j++;
      }
      
      // Merge all consecutive user messages
      if (j > i + 1) {
        const mergedContent = processed.slice(i, j).map(m => m.content).join('\n\n');
        finalMessages.push({
          role: 'user',
          content: mergedContent,
        });
        i = j - 1; // Skip merged messages
      } else {
        finalMessages.push(current);
      }
    } else {
      finalMessages.push(current);
    }
  }

  // Step 4: Final merge of consecutive same-role messages
  return mergeConsecutiveMessages(finalMessages);
}

/**
 * Strict mode: SillyTavern behavior
 * 1. Do everything Semi-Strict does
 * 2. Additionally, add user message placeholder after first system message if not already user
 */
function strictProcess(messages: OutputMessage[], placeholderMessage: string = '[Start a new chat]'): OutputMessage[] {
  const semiStrict = semiStrictProcess(messages);
  if (semiStrict.length === 0) return [];

  // Find the first system message index
  const systemIndex = semiStrict.findIndex(m => m.role === 'system');
  
  // If there's no system message, return as-is
  if (systemIndex === -1) {
    return semiStrict;
  }

  // Check if message immediately after system is a user message
  const nextIndex = systemIndex + 1;
  if (nextIndex < semiStrict.length && semiStrict[nextIndex].role === 'user') {
    // Already has user message after system, return as-is
    return semiStrict;
  }

  // Need to insert placeholder user message after system
  const result: OutputMessage[] = [];
  for (let i = 0; i < semiStrict.length; i++) {
    result.push(semiStrict[i]);
    if (i === systemIndex) {
      // Insert placeholder user message after system
      result.push({
        role: 'user',
        content: placeholderMessage,
      });
    }
  }

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
 * Anthropic mode: Extract first system message, keep consecutive assistant/user messages
 * Similar to Strict but optimized for Anthropic's API which has separate 'system' parameter
 */
function anthropicProcess(messages: OutputMessage[], mergeConsecutives: boolean = false): OutputMessage[] {
  if (messages.length === 0) return [];

  // First, apply strict processing to handle system messages properly
  const strictProcessed = strictProcess(messages, '[Start a new chat]');
  
  // Find the first system message
  const systemIndex = strictProcessed.findIndex(m => m.role === 'system');
  
  if (systemIndex === -1) {
    // No system message, return as-is (but optionally merge consecutives)
    if (mergeConsecutives) {
      return mergeConsecutiveMessages(strictProcessed);
    }
    return strictProcessed;
  }

  // Extract the system message (will be placed in separate 'system' parameter by provider)
  // For Anthropic API, we keep it as a system message in the messages array
  // but the provider will extract it to the 'system' parameter
  
  // Optionally merge consecutive same-role messages if requested
  if (mergeConsecutives) {
    return mergeConsecutiveMessages(strictProcessed);
  }
  
  return strictProcessed;
}

/**
 * Apply post-processing based on mode
 */
function applyPostProcessing(
  messages: OutputMessage[],
  mode: PromptPostProcessingMode,
  settings?: { strictPlaceholderMessage?: string }
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
      return strictProcess(messages, settings?.strictPlaceholderMessage);
    case 'single-user':
      return singleUserProcess(messages);
    case 'anthropic':
      return anthropicProcess(messages, false);
    case 'anthropic-merge-consecutives':
      return anthropicProcess(messages, true);
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

  // Get settings for logging and post-processing
  const settings = await getServerSettings();

  // Helper function to check if logging is enabled
  const shouldLogRequest = () => settings.logging?.logRequests;
  const shouldLogResponse = () => settings.logging?.logResponses;
  const shouldLogRawRequestBody = () => settings.logging?.logRawRequestBody;
  const shouldLogError = () => true; // Always log errors for debugging

  try {
    // Read raw request body for logging
    const rawBodyText = await request.text();
    
    // Log raw request body if enabled
    if (shouldLogRawRequestBody()) {
      console.log(`[JT] [${requestId}] RAW REQUEST BODY:`, rawBodyText);
    }
    
    // Parse the JSON body
    const body: ProxyRequest = JSON.parse(rawBodyText);

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
    if (shouldLogRequest()) {
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
    }

    // Helper for error responses with CORS
    const errorWithCors = (message: string, status: number) => {
      if (shouldLogError()) {
        logError(requestId, message, 'validation').catch(() => {});
      }
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

    // Get API key from the new multi-key system
    let apiKey = '';
    
    if (connectionPreset.apiKeyRef === 'env' && connectionPreset.apiKeyEnvVar) {
      // Environment variable reference
      apiKey = process.env[connectionPreset.apiKeyEnvVar] || '';
    } else {
      // Get selected API key from the connection preset
      const selectedKeyId = connectionPreset.selectedKeyId;
      if (selectedKeyId) {
        const selectedKey = connectionPreset.apiKeys?.find(key => key.id === selectedKeyId);
        if (selectedKey) {
          apiKey = selectedKey.value;
        }
      }
      
      // Fallback: if no selected key but there are keys, use the first one
      if (!apiKey && connectionPreset.apiKeys && connectionPreset.apiKeys.length > 0) {
        apiKey = connectionPreset.apiKeys[0].value;
      }
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

    // Use settings already retrieved for post-processing mode
    if (shouldLogRequest() || shouldLogResponse()) {
      console.log(`[JT] [${requestId}] Settings retrieved:`, JSON.stringify(settings, null, 2));
      console.log(`[JT] [${requestId}] Connection preset promptPostProcessing:`, connectionPreset.promptPostProcessing);
      console.log(`[JT] [${requestId}] Settings defaultPostProcessing:`, settings.defaultPostProcessing);
    }

    // Priority: connection preset (if not 'none') → app settings → default 'none'
    // 'none' in connection preset means "use app default", not "force no processing"
    let postProcessingMode: PromptPostProcessingMode;
    if (connectionPreset.promptPostProcessing && connectionPreset.promptPostProcessing !== 'none') {
      postProcessingMode = connectionPreset.promptPostProcessing;
    } else if (settings.defaultPostProcessing !== undefined) {
      postProcessingMode = settings.defaultPostProcessing;
    } else {
      postProcessingMode = 'none';
    }

    if (shouldLogRequest() || shouldLogResponse()) {
      console.log(`[JT] [${requestId}] Final postProcessingMode:`, postProcessingMode);
    }

    // Load regex scripts for processing
    const regexScripts = await getServerRegexScripts();
    
    // Filter out disabled scripts (extra safety measure)
    const enabledScripts = regexScripts.filter(script => !script.disabled);
    
    if (shouldLogRequest() || shouldLogResponse()) {
      console.log(`[JT] [${requestId}] Regex scripts loaded: Found ${enabledScripts.length} enabled scripts (${regexScripts.length} total)`);
      if (enabledScripts.length > 0) {
        enabledScripts.forEach((script, index) => {
          console.log(`[JT] [${requestId}] Script ${index + 1}: "${script.scriptName}" - Affects: ${script.placement.map(p => p === 1 ? 'Input' : 'Output').join(', ')}`);
        });
      } else {
        console.log(`[JT] [${requestId}] No enabled regex scripts found`);
      }
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
    if (enabledScripts.length > 0) {
      const inputScripts = enabledScripts.filter(s => s.placement.includes(1));
      if (inputScripts.length > 0) {
        if (shouldLogRequest() || shouldLogResponse()) {
          console.log(`[JT] [${requestId}] Applying ${inputScripts.length} regex script(s) to input messages (placement 1)`);
        }
        processedMessages = processedMessages.map(msg => ({
          ...msg,
          content: applyRegexScripts(msg.content, inputScripts, macroContext, 1, undefined, msg.role)
        }));
      }
    }

    // Apply post-processing based on mode
    if (postProcessingMode !== 'none') {
      processedMessages = applyPostProcessing(processedMessages, postProcessingMode, {
        strictPlaceholderMessage: settings.strictPlaceholderMessage,
      });
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
    if (shouldLogRequest()) {
      logProcessedRequest(requestId, {
        processedMessages,
        samplerSettings: parameters, // Only log enabled settings
        providerUrl: connectionPreset.baseUrl,
        model: connectionPreset.model,
        streaming: body.stream === true,
        postProcessingMode: postProcessingMode,
      }).catch(() => {});
    }

    // Calculate input tokens once for stats (used in both streaming and non-streaming)
    const inputTokensEstimate = calculateMessageTokens(processedMessages);

    // Handle streaming requests
    if (body.stream === true && provider instanceof OpenAICompatibleProvider) {
      const streamResult = await provider.sendChatCompletionStream(providerRequest);

      if (streamResult.error) {
        if (shouldLogError()) {
          logError(requestId, streamResult.error, 'provider').catch(() => {});
        }
        if (shouldLogResponse()) {
          logResponse(requestId, {
            status: 502,
            response: { error: streamResult.error },
          }, Date.now() - startTime).catch(() => {});
        }
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
      if (shouldLogResponse()) {
        console.log(`[JT] [${requestId}] STREAMING RESPONSE initiated (status: ${streamResult.status})`);
      }

      // Fire-and-forget: Log and record stats without blocking the stream
      // This is critical - awaiting these would delay/break the stream response
      if (shouldLogResponse()) {
        logResponse(requestId, {
          status: streamResult.status,
          response: { streaming: true },
        }, Date.now() - startTime).catch(() => {});
      }

      // For streaming, we need to process chunks for token counting and startReplyWith
      let outputTokens = 0;
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      const streamingTransform = new TransformStream({
        transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          
          // Try to extract token counts from this chunk
          const tokenCounts = extractTokenCountsFromStreamChunk(text);
          if (tokenCounts) {
            outputTokens = tokenCounts.completionTokens;
            // Record usage with actual output tokens
            recordUsage(inputTokensEstimate, outputTokens).catch(() => {});
          }
          
          // Process startReplyWith and regex scripts if enabled
          let processedChunk = chunk;
          if (startReplyContent) {
            // Check if this chunk contains content delta
            if (text.includes('"delta"') && text.includes('"content"')) {
              // Extract the content string, apply startReplyWith and regex scripts
              const contentMatch = text.match(/("content":\s*")([^"]*)(")/);
              if (contentMatch) {
                const original = contentMatch[2];
                // Apply startReplyWith prefix
                const withPrefix = startReplyContent + original;
                // Apply regex scripts (placement 2) to the content
                // For streaming, we assume it's assistant output (role: 'assistant')
                const outputScripts = enabledScripts.filter(s => s.placement.includes(2));
                let newContent = withPrefix;
                if (outputScripts.length > 0) {
                  if (shouldLogResponse()) {
                    console.log(`[JT] [${requestId}] Applying ${outputScripts.length} regex script(s) to streaming AI output (placement 2)`);
                  }
                  newContent = applyRegexScripts(
                    withPrefix,
                    outputScripts,
                    macroContext,
                    2,
                    undefined,
                    'assistant'
                  );
                }
                // Escape any double quotes in the new content for JSON safety
                const escaped = newContent.replace(/"/g, '\\"').replace(/\n/g, '\\n');
                // Reconstruct the chunk with modified content
                const modifiedText = text.replace(
                  /("content":\s*")([^"]*)(")/,
                  `$1${escaped}$3`
                );
                processedChunk = encoder.encode(modifiedText);
              }
            }
          }
          
          controller.enqueue(processedChunk);
        },
        flush(controller) {
          // If no token counts were found in any chunk, record with 0 output tokens
          if (outputTokens === 0) {
            recordUsage(inputTokensEstimate, 0).catch(() => {});
          }
        }
      });

      const processedStream = streamResult.stream.pipeThrough(streamingTransform);
      
      return new Response(processedStream, {
        status: streamResult.status,
        headers: responseHeaders,
      });
    }

    // Non-streaming request - use raw passthrough like Python proxy
    if (provider instanceof OpenAICompatibleProvider) {
      const rawResult = await provider.sendChatCompletionRaw(providerRequest);

      // Log the FULL raw response body before any processing
      if (shouldLogResponse()) {
        console.log(`[JT] [${requestId}] RAW RESPONSE BODY (before processing):`, rawResult.body);
      }

      // Fire-and-forget logging
      if (shouldLogResponse()) {
        logResponse(requestId, {
          status: rawResult.status,
          response: { raw: true, length: rawResult.body.length },
        }, Date.now() - startTime).catch(() => {});
      }

      // Extract token counts from response body
      let outputTokens = 0;
      try {
        const responseJson = JSON.parse(rawResult.body);
        const tokenCounts = extractTokenCountsFromResponse(responseJson);
        if (tokenCounts) {
          outputTokens = tokenCounts.completionTokens;
        }
      } catch (parseError) {
        // If parsing fails, we'll use 0 output tokens
        if (shouldLogError()) {
          console.log(`[JT] [${requestId}] Failed to parse JSON response for token counting:`, parseError);
        }
      }
      
      recordUsage(inputTokensEstimate, outputTokens).catch(() => {});

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
        if (shouldLogResponse()) {
          console.log(`[JT] [${requestId}] RAW RESPONSE BODY (before JSON parsing):`, rawResult.body);
        }
        
        const responseJson = JSON.parse(rawResult.body);
        if (responseJson.choices?.[0]?.message?.content) {
          let content = responseJson.choices[0].message.content;
          // Apply startReplyWith prefix if enabled
          if (startReplyContent) {
            content = startReplyContent + content;
          }
          // Apply regex scripts (placement 2)
          if (enabledScripts.length > 0) {
            const outputScripts = enabledScripts.filter(s => s.placement.includes(2));
            if (outputScripts.length > 0) {
              if (shouldLogResponse()) {
                console.log(`[JT] [${requestId}] Applying ${outputScripts.length} regex script(s) to AI output (placement 2)`);
              }
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
        if (shouldLogError()) {
          console.log(`[JT] [${requestId}] Failed to parse JSON response:`, parseError);
        }
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
      if (shouldLogError()) {
        logError(requestId, result.error, 'provider').catch(() => {});
      }
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
    if (shouldLogResponse()) {
      console.log(`[JT] [${requestId}] RAW RESPONSE (fallback provider):`, JSON.stringify(result, null, 2));
    }

    // Process AI output content with startReplyWith and regex scripts
    let aiContent = result.message?.content || '';
    if (startReplyContent) {
      aiContent = startReplyContent + aiContent;
    }
    if (enabledScripts.length > 0) {
      const outputScripts = enabledScripts.filter(s => s.placement.includes(2));
      if (outputScripts.length > 0) {
        if (shouldLogResponse()) {
          console.log(`[JT] [${requestId}] Applying ${outputScripts.length} regex script(s) to AI output (placement 2)`);
        }
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

    // Extract token counts from result (fallback providers may not have usage data)
    let outputTokens = 0;
    if (result.usage) {
      // Try to extract from usage field if available
      const tokenCounts = extractTokenCountsFromResponse(JSON.stringify(result));
      if (tokenCounts) {
        outputTokens = tokenCounts.completionTokens;
      }
    }
    
    recordUsage(inputTokensEstimate, outputTokens).catch(() => {});
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
    if (shouldLogError()) {
      logError(requestId, error, 'proxy').catch(() => {});
    }

    const errorResponse = {
      error: `Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };

    if (shouldLogResponse()) {
      logResponse(requestId, {
        status: 500,
        response: errorResponse,
      }, Date.now() - startTime).catch(() => {});
    }

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

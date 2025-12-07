/**
 * Prompt Builder
 * Builds the final messages array from Chat Completion Preset and JanitorAI request.
 * Handles squashing, injection positions, depths, and macro processing.
 */

import type {
  ChatCompletionPreset,
  STPromptBlock,
  STPromptOrder,
  STPromptOrderItem
} from '@/types';
import { processMacros, MacroContext } from './macros';
import { ParsedJanitorData, JanitorMessage } from './janitor-parser';

export interface OutputMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ProcessedBlock extends STPromptBlock {
  originalIndex: number;
}

/**
 * Get enabled blocks in order from preset
 */
function getEnabledBlocksInOrder(
  preset: ChatCompletionPreset,
  characterId: number = 100001
): ProcessedBlock[] {
  const orderConfig = preset.promptOrder?.find(o => o.character_id === characterId);
  if (!orderConfig) return [];

  const blockMap = new Map<string, STPromptBlock>();
  preset.promptBlocks.forEach((block, idx) => {
    blockMap.set(block.identifier, block);
  });

  const enabledBlocks: ProcessedBlock[] = [];
  orderConfig.order.forEach((item, idx) => {
    if (item.enabled) {
      const block = blockMap.get(item.identifier);
      if (block) {
        enabledBlocks.push({ ...block, originalIndex: idx });
      }
    }
  });

  return enabledBlocks;
}

/**
 * Squash consecutive messages of the same role
 */
function squashMessages(messages: OutputMessage[], excludeExamples: boolean = true): OutputMessage[] {
  if (messages.length === 0) return [];

  const result: OutputMessage[] = [];
  let currentMessage: OutputMessage | null = null;

  for (const msg of messages) {
    if (!currentMessage) {
      currentMessage = { ...msg };
    } else if (currentMessage.role === msg.role && currentMessage.role === 'system') {
      // Squash consecutive system messages
      currentMessage.content += '\n' + msg.content;
    } else {
      result.push(currentMessage);
      currentMessage = { ...msg };
    }
  }

  if (currentMessage) {
    result.push(currentMessage);
  }

  return result;
}

/**
 * Process a block's content with macros
 */
function processBlockContent(block: STPromptBlock, context: MacroContext): string {
  let content = block.content || '';

  // Process macros in content
  content = processMacros(content, context);

  return content;
}

/**
 * Get content for marker blocks based on their identifier
 */
function getMarkerContent(
  identifier: string,
  janitorData: ParsedJanitorData,
  context: MacroContext
): OutputMessage[] {
  const messages: OutputMessage[] = [];

  switch (identifier) {
    case 'dialogueExamples':
      // Insert example dialogs from JanitorAI
      if (context.mesExamples?.trim()) {
        messages.push({
          role: 'system',
          content: context.mesExamples,
        });
      }
      break;

    case 'chatHistory':
      // Insert chat history from JanitorAI
      for (const msg of janitorData.chatHistory) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
      break;

    case 'charDescription':
    case 'charPersonality':
      // In JanitorAI, description and personality are the same field
      // Use deduplication to prevent double output when both markers are enabled
      if (!context._usedContentGroups) {
        context._usedContentGroups = new Set();
      }
      if (!context._usedContentGroups.has('charPersona') && context.charDescription?.trim()) {
        context._usedContentGroups.add('charPersona');
        messages.push({
          role: 'system',
          content: context.charDescription,
        });
      }
      break;

    case 'scenario':
      // Insert scenario
      if (context.charScenario?.trim()) {
        messages.push({
          role: 'system',
          content: context.charScenario,
        });
      }
      break;

    case 'personaDescription':
      // Insert user persona
      if (context.persona?.trim()) {
        messages.push({
          role: 'system',
          content: context.persona,
        });
      }
      break;

    case 'worldInfoBefore':
    case 'worldInfoAfter':
      // World info not available from JanitorAI - skip
      break;

    default:
      // Unknown marker - skip
      break;
  }

  return messages;
}

/**
 * Build messages array from preset and parsed JanitorAI data
 */
export function buildMessages(
  preset: ChatCompletionPreset,
  janitorData: ParsedJanitorData,
  context: MacroContext
): OutputMessage[] {
  const enabledBlocks = getEnabledBlocksInOrder(preset);

  // Separate blocks by injection position
  const relativeBlocks: ProcessedBlock[] = []; // injection_position: 0
  const inChatBlocks: ProcessedBlock[] = [];   // injection_position: 1

  for (const block of enabledBlocks) {
    if (block.injection_position === 1) {
      inChatBlocks.push(block);
    } else {
      relativeBlocks.push(block);
    }
  }

  // Find where chatHistory marker is in relativeBlocks
  const chatHistoryIndex = relativeBlocks.findIndex(b => b.marker && b.identifier === 'chatHistory');
  const chatHistoryInRelative = chatHistoryIndex !== -1;

  // Split relativeBlocks into before and after chatHistory
  const blocksBeforeChatHistory = chatHistoryInRelative
    ? relativeBlocks.slice(0, chatHistoryIndex)
    : relativeBlocks;
  const blocksAfterChatHistory = chatHistoryInRelative
    ? relativeBlocks.slice(chatHistoryIndex + 1)
    : [];

  // Sort in-chat blocks by depth (higher depth = inserted earlier in history)
  // injection_order determines the order within the same depth
  // originalIndex is used as tiebreaker to preserve prompt_order sequence
  const sortedInChatBlocks = [...inChatBlocks].sort((a, b) => {
    const depthDiff = (b.injection_depth || 0) - (a.injection_depth || 0);
    if (depthDiff !== 0) return depthDiff;
    // Within same depth, use injection_order (lower = first)
    const orderDiff = (a.injection_order || 100) - (b.injection_order || 100);
    if (orderDiff !== 0) return orderDiff;
    // Use originalIndex as final tiebreaker
    return a.originalIndex - b.originalIndex;
  });

  // Helper function to process a block
  const processBlock = (block: ProcessedBlock): OutputMessage | null => {
    if (block.marker) {
      // For markers, use getMarkerContent - but we handle them specially below
      return null;
    }
    const content = processBlockContent(block, context);
    if (!content.trim()) return null;
    return { role: block.role, content };
  };

  // Build messages in proper order
  const allMessages: OutputMessage[] = [];

  // 1. Process blocks before chatHistory
  for (const block of blocksBeforeChatHistory) {
    if (block.marker) {
      const markerMessages = getMarkerContent(block.identifier, janitorData, context);
      allMessages.push(...markerMessages);
    } else {
      const msg = processBlock(block);
      if (msg) allMessages.push(msg);
    }
  }

  // 2. Add chat history with in-chat injections (depth > 0)
  const chatHistory = janitorData.chatHistory || [];
  for (let i = 0; i < chatHistory.length; i++) {
    const msg = chatHistory[i];
    const depthFromEnd = chatHistory.length - 1 - i;

    // Check for injections BEFORE this message (at depth = depthFromEnd + 1)
    for (const block of sortedInChatBlocks) {
      if (block.marker) continue;
      const blockDepth = block.injection_depth || 0;
      if (blockDepth === depthFromEnd + 1) {
        const content = processBlockContent(block, context);
        if (content.trim()) {
          allMessages.push({ role: block.role, content });
        }
      }
    }

    // Add the chat message
    allMessages.push({ role: msg.role, content: msg.content });
  }

  // 3. Add depth-0 in-chat injections (right after chat history, before remaining blocks)
  for (const block of sortedInChatBlocks) {
    if (block.marker) continue;
    if ((block.injection_depth || 0) === 0) {
      const content = processBlockContent(block, context);
      if (content.trim()) {
        allMessages.push({ role: block.role, content });
      }
    }
  }

  // 4. Process blocks after chatHistory (e.g., assistant prefill)
  for (const block of blocksAfterChatHistory) {
    if (block.marker) {
      const markerMessages = getMarkerContent(block.identifier, janitorData, context);
      allMessages.push(...markerMessages);
    } else {
      const msg = processBlock(block);
      if (msg) allMessages.push(msg);
    }
  }

  // Squash system messages if enabled
  let finalMessages: OutputMessage[];
  if (preset.providerSettings?.squashSystemMessages) {
    finalMessages = squashMessages(allMessages);
  } else {
    finalMessages = allMessages;
  }

  // Filter out empty messages
  return finalMessages.filter(msg => msg.content.trim());
}

/**
 * Build complete request body for LLM API
 */
export function buildRequestBody(
  preset: ChatCompletionPreset,
  janitorData: ParsedJanitorData,
  context: MacroContext
): Record<string, unknown> {
  const messages = buildMessages(preset, janitorData, context);

  // Build sampler parameters from preset
  const sampler = preset.sampler || {};
  const enabled = preset.samplerEnabled || {};

  // Helper to check if a setting is enabled (default: true)
  const isEnabled = (key: string): boolean => {
    return enabled[key as keyof typeof enabled] !== false;
  };

  // Start with required fields
  const body: Record<string, unknown> = {
    model: janitorData.model || '',
    messages,
    stream: janitorData.originalParams?.stream ?? false,
  };

  // Add sampler settings only if enabled
  if (isEnabled('temperature')) {
    body.temperature = sampler.temperature ?? 1;
  }
  if (isEnabled('top_p')) {
    body.top_p = sampler.top_p ?? 1;
  }
  if (isEnabled('openai_max_tokens')) {
    body.max_tokens = sampler.openai_max_tokens ?? 4096;
  }
  if (isEnabled('frequency_penalty')) {
    body.frequency_penalty = sampler.frequency_penalty ?? 0;
  }
  if (isEnabled('presence_penalty')) {
    body.presence_penalty = sampler.presence_penalty ?? 0;
  }
  if (isEnabled('top_k') && sampler.top_k !== undefined && sampler.top_k > 0) {
    body.top_k = sampler.top_k;
  }
  if (isEnabled('top_a') && sampler.top_a !== undefined && sampler.top_a > 0) {
    body.top_a = sampler.top_a;
  }
  if (isEnabled('min_p') && sampler.min_p !== undefined && sampler.min_p > 0) {
    body.min_p = sampler.min_p;
  }
  if (isEnabled('repetition_penalty') && sampler.repetition_penalty !== undefined && sampler.repetition_penalty !== 1) {
    body.repetition_penalty = sampler.repetition_penalty;
  }
  if (isEnabled('seed') && sampler.seed !== undefined && sampler.seed !== -1) {
    body.seed = sampler.seed;
  }

  return body;
}

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

  // Build relative blocks (system prompt area)
  const systemMessages: OutputMessage[] = [];

  for (const block of relativeBlocks) {
    // Skip marker blocks (they define where content goes, not content itself)
    if (block.marker) continue;

    // Skip empty content
    const content = processBlockContent(block, context);
    if (!content.trim()) continue;

    systemMessages.push({
      role: block.role,
      content: content,
    });
  }

  // Squash system messages if enabled
  let finalMessages: OutputMessage[] = [];

  if (preset.providerSettings?.squashSystemMessages) {
    finalMessages = squashMessages(systemMessages);
  } else {
    finalMessages = systemMessages;
  }

  // Add chat history
  const chatHistory = janitorData.chatHistory || [];

  // Sort in-chat blocks by depth (higher depth = inserted earlier in history)
  const sortedInChatBlocks = [...inChatBlocks].sort((a, b) =>
    (b.injection_depth || 0) - (a.injection_depth || 0)
  );

  // Build chat messages with injections
  const chatMessages: OutputMessage[] = [];

  for (let i = 0; i < chatHistory.length; i++) {
    const msg = chatHistory[i];
    const depthFromEnd = chatHistory.length - 1 - i;

    // Check for injections at this depth
    for (const block of sortedInChatBlocks) {
      const blockDepth = block.injection_depth || 0;
      if (blockDepth === depthFromEnd + 1) {
        // Inject before this message
        const content = processBlockContent(block, context);
        if (content.trim()) {
          chatMessages.push({
            role: block.role,
            content: content,
          });
        }
      }
    }

    // Add the actual chat message
    chatMessages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add depth 0 injections at the very end
  for (const block of sortedInChatBlocks) {
    if ((block.injection_depth || 0) === 0) {
      const content = processBlockContent(block, context);
      if (content.trim()) {
        chatMessages.push({
          role: block.role,
          content: content,
        });
      }
    }
  }

  // Combine system messages with chat messages
  finalMessages.push(...chatMessages);

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

  return {
    model: janitorData.model || '',
    messages,
    temperature: sampler.temperature ?? 1,
    top_p: sampler.top_p ?? 1,
    max_tokens: sampler.openai_max_tokens ?? 4096,
    stream: janitorData.originalParams?.stream ?? false,
    frequency_penalty: sampler.frequency_penalty ?? 0,
    presence_penalty: sampler.presence_penalty ?? 0,
  };
}

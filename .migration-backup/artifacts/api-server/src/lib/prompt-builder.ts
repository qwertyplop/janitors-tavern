import type { ChatCompletionPreset, STPromptBlock, STPromptOrder } from './types.js';
import { processMacros, MacroContext } from './macros.js';
import type { ParsedJanitorData } from './janitor-parser.js';

export interface OutputMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ProcessedBlock extends STPromptBlock {
  originalIndex: number;
}

function getEnabledBlocksInOrder(preset: ChatCompletionPreset, characterId: number = 100001): ProcessedBlock[] {
  const orderConfig = preset.promptOrder?.find(o => o.character_id === characterId);
  if (!orderConfig) return [];

  const blockMap = new Map<string, STPromptBlock>();
  preset.promptBlocks.forEach(block => blockMap.set(block.identifier, block));

  const enabledBlocks: ProcessedBlock[] = [];
  orderConfig.order.forEach((item, idx) => {
    if (item.enabled) {
      const block = blockMap.get(item.identifier);
      if (block) enabledBlocks.push({ ...block, originalIndex: idx });
    }
  });
  return enabledBlocks;
}

function squashMessages(messages: OutputMessage[]): OutputMessage[] {
  if (messages.length === 0) return [];
  const result: OutputMessage[] = [];
  let cur: OutputMessage | null = null;
  for (const msg of messages) {
    if (!cur) { cur = { ...msg }; }
    else if (cur.role === msg.role && cur.role === 'system') { cur.content += '\n' + msg.content; }
    else { result.push(cur); cur = { ...msg }; }
  }
  if (cur) result.push(cur);
  return result;
}

function processBlockContent(block: STPromptBlock, context: MacroContext): string {
  return processMacros(block.content || '', context);
}

function getMarkerContent(identifier: string, janitorData: ParsedJanitorData, context: MacroContext): OutputMessage[] {
  const messages: OutputMessage[] = [];
  switch (identifier) {
    case 'dialogueExamples':
      if (context.mesExamples?.trim()) messages.push({ role: 'system', content: context.mesExamples });
      break;
    case 'chatHistory':
      for (const msg of janitorData.chatHistory) messages.push({ role: msg.role, content: msg.content });
      break;
    case 'charDescription':
    case 'charPersonality':
      if (!context._usedContentGroups) context._usedContentGroups = new Set();
      if (!context._usedContentGroups.has('charPersona') && context.charDescription?.trim()) {
        context._usedContentGroups.add('charPersona');
        messages.push({ role: 'system', content: context.charDescription });
      }
      break;
    case 'scenario':
      if (context.charScenario?.trim()) messages.push({ role: 'system', content: context.charScenario });
      break;
    case 'personaDescription':
      if (context.persona?.trim()) messages.push({ role: 'system', content: context.persona });
      break;
    case 'worldInfoBefore':
    case 'worldInfoAfter':
      break;
    default:
      break;
  }
  return messages;
}

export function buildMessages(preset: ChatCompletionPreset, janitorData: ParsedJanitorData, context: MacroContext): OutputMessage[] {
  const enabledBlocks = getEnabledBlocksInOrder(preset);

  const relativeBlocks: ProcessedBlock[] = [];
  const inChatBlocks: ProcessedBlock[] = [];
  for (const block of enabledBlocks) {
    if (block.injection_position === 1) inChatBlocks.push(block);
    else relativeBlocks.push(block);
  }

  const chatHistoryIndex = relativeBlocks.findIndex(b => b.marker && b.identifier === 'chatHistory');
  const blocksBeforeChatHistory = chatHistoryIndex !== -1 ? relativeBlocks.slice(0, chatHistoryIndex) : relativeBlocks;
  const blocksAfterChatHistory = chatHistoryIndex !== -1 ? relativeBlocks.slice(chatHistoryIndex + 1) : [];

  const sortedInChatBlocks = [...inChatBlocks].sort((a, b) => {
    const depthDiff = (b.injection_depth || 0) - (a.injection_depth || 0);
    if (depthDiff !== 0) return depthDiff;
    const orderDiff = (a.injection_order || 100) - (b.injection_order || 100);
    if (orderDiff !== 0) return orderDiff;
    return a.originalIndex - b.originalIndex;
  });

  const firstPassBlocks = [...blocksBeforeChatHistory, ...sortedInChatBlocks, ...blocksAfterChatHistory];
  for (const block of firstPassBlocks) {
    if (!block.marker) processBlockContent(block, context);
  }

  const allMessages: OutputMessage[] = [];

  for (const block of blocksBeforeChatHistory) {
    if (block.marker) {
      allMessages.push(...getMarkerContent(block.identifier, janitorData, context));
    } else {
      const content = processBlockContent(block, context);
      if (content.trim()) allMessages.push({ role: block.role, content });
    }
  }

  const chatHistory = janitorData.chatHistory || [];
  for (let i = 0; i < chatHistory.length; i++) {
    const depthFromEnd = chatHistory.length - 1 - i;
    for (const block of sortedInChatBlocks) {
      if (block.marker) continue;
      if ((block.injection_depth || 0) === depthFromEnd + 1) {
        const content = processBlockContent(block, context);
        if (content.trim()) allMessages.push({ role: block.role, content });
      }
    }
    allMessages.push({ role: chatHistory[i].role, content: chatHistory[i].content });
  }

  for (const block of sortedInChatBlocks) {
    if (block.marker) continue;
    if ((block.injection_depth || 0) === 0) {
      const content = processBlockContent(block, context);
      if (content.trim()) allMessages.push({ role: block.role, content });
    }
  }

  for (const block of blocksAfterChatHistory) {
    if (block.marker) {
      allMessages.push(...getMarkerContent(block.identifier, janitorData, context));
    } else {
      const content = processBlockContent(block, context);
      if (content.trim()) allMessages.push({ role: block.role, content });
    }
  }

  let finalMessages = preset.providerSettings?.squashSystemMessages ? squashMessages(allMessages) : allMessages;
  return finalMessages.filter(msg => msg.content.trim());
}

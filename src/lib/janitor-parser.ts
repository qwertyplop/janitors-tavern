/**
 * JanitorAI Request Parser
 * Parses incoming JanitorAI requests and extracts macro values for STScript processing.
 */

import type { MacroContext } from './macros';
import { processChatHistoryWithRegex, RegexScript } from './regex-processor';

export interface JanitorMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface JanitorRequest {
  messages: JanitorMessage[];
  model: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export interface ParsedJanitorData {
  user: string;
  char: string;
  personality: string;
  scenario: string;
  persona: string;
  mesExamples: string;
  chatHistory: JanitorMessage[];
  model: string;
  // Original request params
  originalParams: {
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  };
}

/**
 * Parse the system message from JanitorAI to extract character/user info
 */
function parseSystemMessage(content: string): {
  user: string;
  char: string;
  personality: string;
  scenario: string;
  persona: string;
  mesExamples: string;
} {
  // Extract username: <Username>NAME</Username>
  const usernameMatch = content.match(/<Username>([^<]*)<\/Username>/i);
  const user = usernameMatch?.[1]?.trim() || '';

  // Extract character name and personality: <CHAR_NAME's Persona>CONTENT</CHAR_NAME's Persona>
  // The character name is part of the tag itself
  const personaTagMatch = content.match(/<([^>']+)'s Persona>([^]*?)<\/\1's Persona>/i);
  const char = personaTagMatch?.[1]?.trim() || '';
  const personality = personaTagMatch?.[2]?.trim() || '';

  // Extract scenario: <Scenario>CONTENT</Scenario>
  const scenarioMatch = content.match(/<Scenario>([^]*?)<\/Scenario>/i);
  const scenario = scenarioMatch?.[1]?.trim() || '';

  // Extract user persona: <UserPersona>CONTENT</UserPersona>
  const userPersonaMatch = content.match(/<UserPersona>([^]*?)<\/UserPersona>/i);
  const persona = userPersonaMatch?.[1]?.trim() || '';

  // Extract example dialogs: <example_dialogs>CONTENT</example_dialogs>
  const examplesMatch = content.match(/<example_dialogs>([^]*?)<\/example_dialogs>/i);
  const mesExamples = examplesMatch?.[1]?.trim() || '';

  return {
    user,
    char,
    personality,
    scenario,
    persona,
    mesExamples,
  };
}

/**
 * Parse a JanitorAI request and extract all macro-relevant data
 */
export function parseJanitorRequest(
  request: JanitorRequest,
  options?: { regexScripts?: RegexScript[] }
): ParsedJanitorData {
  const messages = request.messages || [];

  // First message is typically the system message with all the character info
  const systemMessage = messages.find(m => m.role === 'system');
  const systemContent = systemMessage?.content || '';

  // Parse the system message
  const parsed = parseSystemMessage(systemContent);

  // Chat history is all non-system messages
  let chatHistory = messages.filter(m => m.role !== 'system');

  // Apply regex processing to chat history if scripts are provided
  if (options?.regexScripts && options.regexScripts.length > 0) {
    chatHistory = processChatHistoryWithRegex(chatHistory, {
      scripts: options.regexScripts,
      skipPresetProcessing: true // Only process chat history, not preset parts
    });
  }

  // Log parsed data for debugging
  console.log('[JanitorParser] Parsed data:', {
    user: parsed.user,
    char: parsed.char,
    personalityLength: parsed.personality.length,
    scenarioLength: parsed.scenario.length,
    personaLength: parsed.persona.length,
    mesExamplesLength: parsed.mesExamples.length,
    chatHistoryCount: chatHistory.length,
  });

  // Extract other params
  const { messages: _, model, ...otherParams } = request;

  return {
    ...parsed,
    chatHistory,
    model: model || '',
    originalParams: otherParams,
  };
}

/**
 * Convert parsed JanitorAI data to MacroContext
 */
export function janitorDataToMacroContext(data: ParsedJanitorData): MacroContext {
  // Find last messages
  const lastMessage = data.chatHistory.length > 0
    ? data.chatHistory[data.chatHistory.length - 1].content
    : '';

  const lastCharMessage = [...data.chatHistory]
    .reverse()
    .find(m => m.role === 'assistant')?.content || '';

  const lastUserMessage = [...data.chatHistory]
    .reverse()
    .find(m => m.role === 'user')?.content || '';

  // In JanitorAI, description and personality come from the SAME field (<CHAR's Persona>)
  // Deduplication is handled via _usedContentGroups tracking in macros.ts and prompt-builder.ts
  const context: MacroContext = {
    user: data.user,
    char: data.char,
    charDescription: data.personality, // Main character info from JanitorAI
    charPersonality: data.personality, // Same as description - deduplication handled elsewhere
    charScenario: data.scenario,
    persona: data.persona,
    mesExamples: data.mesExamples,
    mesExamplesRaw: data.mesExamples,
    model: data.model,
    lastMessage,
    lastCharMessage,
    lastUserMessage,
    lastMessageId: data.chatHistory.length - 1,
    variables: {
      local: new Map(),
      global: new Map(),
    },
    outlets: new Map(),
  };

  // Log macro context for debugging
  console.log('[JanitorParser] Macro context:', {
    user: context.user,
    char: context.char,
    descriptionPreview: context.charDescription?.substring(0, 100),
    scenarioPreview: context.charScenario?.substring(0, 100),
    personaPreview: context.persona?.substring(0, 100),
    mesExamplesPreview: context.mesExamples?.substring(0, 100),
  });

  return context;
}

/**
 * Helper to get chat history as formatted string
 */
export function formatChatHistory(
  chatHistory: JanitorMessage[],
  charName: string,
  userName: string
): string {
  return chatHistory.map(msg => {
    const prefix = msg.role === 'assistant' ? charName :
                   msg.role === 'user' ? userName : '';
    if (prefix && msg.content) {
      // Check if content already has the name prefix
      if (msg.content.startsWith(`${prefix}:`)) {
        return msg.content;
      }
      return `${prefix}: ${msg.content}`;
    }
    return msg.content;
  }).join('\n');
}

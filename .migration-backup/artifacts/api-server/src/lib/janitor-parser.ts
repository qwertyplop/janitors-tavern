import type { MacroContext } from './macros.js';

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
  originalParams: {
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  };
}

function parseSystemMessage(content: string) {
  const usernameMatch = content.match(/<Username>([^<]*)<\/Username>/i);
  const user = usernameMatch?.[1]?.trim() || '';

  const personaTagMatch = content.match(/<([^>']+)'s Persona>([^]*?)<\/\1's Persona>/i);
  const char = personaTagMatch?.[1]?.trim() || '';
  const personality = personaTagMatch?.[2]?.trim() || '';

  const scenarioMatch = content.match(/<Scenario>([^]*?)<\/Scenario>/i);
  const scenario = scenarioMatch?.[1]?.trim() || '';

  const userPersonaMatch = content.match(/<UserPersona>([^]*?)<\/UserPersona>/i);
  const persona = userPersonaMatch?.[1]?.trim() || '';

  const examplesMatch = content.match(/<example_dialogs>([^]*?)<\/example_dialogs>/i);
  const mesExamples = examplesMatch?.[1]?.trim() || '';

  return { user, char, personality, scenario, persona, mesExamples };
}

export function parseJanitorRequest(request: JanitorRequest): ParsedJanitorData {
  const messages = request.messages || [];
  const systemMessage = messages.find(m => m.role === 'system');
  const parsed = parseSystemMessage(systemMessage?.content || '');
  const chatHistory = messages.filter(m => m.role !== 'system');
  const { messages: _, model, ...otherParams } = request;
  return { ...parsed, chatHistory, model: model || '', originalParams: otherParams };
}

export function janitorDataToMacroContext(data: ParsedJanitorData): MacroContext {
  const lastMessage = data.chatHistory.length > 0 ? data.chatHistory[data.chatHistory.length - 1].content : '';
  const lastCharMessage = [...data.chatHistory].reverse().find(m => m.role === 'assistant')?.content || '';
  const lastUserMessage = [...data.chatHistory].reverse().find(m => m.role === 'user')?.content || '';

  return {
    user: data.user,
    char: data.char,
    charDescription: data.personality,
    charPersonality: data.personality,
    charScenario: data.scenario,
    persona: data.persona,
    mesExamples: data.mesExamples,
    mesExamplesRaw: data.mesExamples,
    model: data.model,
    lastMessage,
    lastCharMessage,
    lastUserMessage,
    lastMessageId: data.chatHistory.length - 1,
    variables: { local: new Map(), global: new Map() },
    outlets: new Map(),
  };
}

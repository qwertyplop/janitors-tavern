export type ProviderType = 'janitorai' | 'openai-compatible' | 'custom-http';
export type ApiKeyRef = 'env' | 'local';

export type PromptPostProcessingMode =
  | 'none'
  | 'merge'
  | 'merge-tools'
  | 'semi-strict'
  | 'semi-strict-tools'
  | 'strict'
  | 'strict-tools'
  | 'single-user'
  | 'anthropic'
  | 'anthropic-merge-consecutives';

export interface ApiKey {
  id: string;
  name: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionPreset {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKeyRef: ApiKeyRef;
  apiKeyEnvVar?: string;
  apiKeys: ApiKey[];
  selectedKeyId?: string;
  model: string;
  promptPostProcessing: PromptPostProcessingMode;
  bypassStatusCheck: boolean;
  defaultParameters?: SamplerParameters;
  extraHeaders?: Record<string, string>;
  extraQueryParams?: Record<string, string>;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PromptBlockRole = 'system' | 'user' | 'assistant';

export interface STPromptBlock {
  identifier: string;
  name: string;
  role: PromptBlockRole;
  content: string;
  system_prompt: boolean;
  marker: boolean;
  enabled?: boolean;
  injection_position: number;
  injection_depth: number;
  injection_order?: number;
  forbid_overrides?: boolean;
}

export interface STPromptOrderItem {
  identifier: string;
  enabled: boolean;
}

export interface STPromptOrder {
  character_id: number;
  order: STPromptOrderItem[];
}

export interface STSamplerSettings {
  temperature: number;
  top_p: number;
  top_k: number;
  min_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  repetition_penalty: number;
  openai_max_context: number;
  openai_max_tokens: number;
  seed: number;
  n: number;
  [key: string]: unknown;
}

export type SamplerSettingKey =
  | 'temperature'
  | 'top_p'
  | 'top_k'
  | 'min_p'
  | 'frequency_penalty'
  | 'presence_penalty'
  | 'repetition_penalty'
  | 'openai_max_tokens'
  | 'seed';

export interface ChatCompletionPreset {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  sampler: STSamplerSettings;
  samplerEnabled?: Partial<Record<SamplerSettingKey, boolean>>;
  promptBlocks: STPromptBlock[];
  promptOrder: STPromptOrder[];
  regexScripts?: RegexScript[];
  formatStrings: {
    worldInfo: string;
    scenario: string;
    personality: string;
  };
  assistantPrefill: string;
  assistantImpersonation: string;
  providerSettings: {
    claudeUseSysprompt: boolean;
    makersuiteUseSysprompt: boolean;
    squashSystemMessages: boolean;
    streamOpenai: boolean;
  };
  mediaSettings: {
    imageInlining: boolean;
    inlineImageQuality: string;
    videoInlining: boolean;
  };
  advancedSettings: {
    functionCalling: boolean;
    showThoughts: boolean;
    reasoningEffort: string;
    enableWebSearch: boolean;
    requestImages: boolean;
    wrapInQuotes: boolean;
    namesBehavior: number;
    sendIfEmpty: string;
    biasPresetSelected: string;
    maxContextUnlocked: boolean;
    startReplyWith: {
      enabled: boolean;
      content: string;
    };
  };
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegexScript {
  id: string;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placement: number[];
  roles?: ('assistant' | 'user' | 'system')[];
  disabled: boolean;
  markdownOnly: boolean;
  runOnEdit: boolean;
  substituteRegex: 0 | 1 | 2;
  minDepth: number | null;
  maxDepth: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SamplerParameters {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  defaultPostProcessing: PromptPostProcessingMode;
  strictPlaceholderMessage: string;
  logging: {
    logRequests: boolean;
    logResponses: boolean;
    logRawRequestBody: boolean;
  };
}

export const STORAGE_KEYS = {
  CONNECTION_PRESETS: 'jt.connectionPresets',
  CHAT_COMPLETION_PRESETS: 'jt.chatCompletionPresets',
  REGEX_SCRIPTS: 'jt.regexScripts',
  SETTINGS: 'jt.settings',
  ACTIVE_CONNECTION_ID: 'jt.activeConnectionId',
  ACTIVE_PRESET_ID: 'jt.activePresetId',
} as const;

export const DEFAULT_SAMPLER_SETTINGS: STSamplerSettings = {
  temperature: 1,
  top_p: 1,
  top_k: 0,
  min_p: 0,
  frequency_penalty: 0,
  presence_penalty: 0,
  repetition_penalty: 1,
  openai_max_context: 4096,
  openai_max_tokens: 4096,
  seed: -1,
  n: 1,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultPostProcessing: 'none',
  strictPlaceholderMessage: '[Start a new chat]',
  logging: {
    logRequests: false,
    logResponses: false,
    logRawRequestBody: false,
  },
};

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  dailyRequests: number;
  dailyTokens: number;
  lastDailyReset: string;
  lastUpdated: string;
}

export const POST_PROCESSING_LABELS: Record<PromptPostProcessingMode, string> = {
  'none': 'None',
  'merge': 'Merge consecutive',
  'merge-tools': 'Merge consecutive (with tools)',
  'semi-strict': 'Semi-strict',
  'semi-strict-tools': 'Semi-strict (with tools)',
  'strict': 'Strict',
  'strict-tools': 'Strict (with tools)',
  'single-user': 'Single user message',
  'anthropic': 'Anthropic',
  'anthropic-merge-consecutives': 'Anthropic (merge consecutives)',
};

export const POST_PROCESSING_TIPS: Record<PromptPostProcessingMode, string> = {
  'none': 'No changes. Messages are sent exactly as processed by the preset.',
  'merge': 'Combines consecutive messages with the same role into one message.',
  'merge-tools': 'Combines consecutive messages with the same role into one message, but preserves tool calls.',
  'semi-strict': 'Ensures user/assistant alternation. Merges consecutive same-role messages.',
  'semi-strict-tools': 'Ensures user/assistant alternation, merges consecutive same-role messages, preserves tool calls.',
  'strict': 'Forces strict user→assistant→user pattern. First message becomes system.',
  'strict-tools': 'Forces strict user→assistant→user pattern (first becomes system), preserves tool calls.',
  'single-user': 'Combines all messages into a single user message. For simple prompts.',
  'anthropic': 'Extracts first system message for Anthropic API.',
  'anthropic-merge-consecutives': 'Extracts first system message for Anthropic API. Merges consecutive same-role messages.',
};

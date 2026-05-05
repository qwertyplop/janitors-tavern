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
  includeBodyParams?: string;
  excludeBodyParams?: string;
  lastTestedAt?: string;
  roundRobinEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PromptBlockRole = 'system' | 'user' | 'assistant';
export type PromptPosition = 'relative' | 'in-chat';

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
  _presetId?: string;
  _presetName?: string;
}

export interface SamplerParameters {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  topK?: number;
  repetitionPenalty?: number;
  stop?: string[];
  minP?: number;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface LoggingSettings {
  enabled: boolean;
  logRequests: boolean;
  logResponses: boolean;
  logRawRequestBody: boolean;
}

export interface StructuredOutputPreset {
  id: string;
  name: string;
  enabled: boolean;
  hidePrefillInDisplay: boolean;
  minCharsAfterPrefix: number;
  newlineToken: string;
  antiSlopBanList: string;
  continueOverlapChars: number;
  overridePrefillEnabled: boolean;
  overridePrefillText: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerState {
  activeConnectionPreset: ConnectionPreset | null;
  activeChatCompletionPreset: ChatCompletionPreset | null;
  activeRegexScripts: RegexScript[];
  activeStructuredOutputPreset: StructuredOutputPreset | null;
  defaultPostProcessing: PromptPostProcessingMode;
  strictPlaceholderMessage: string;
  logging: LoggingSettings;
  stats: UsageStats;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  dailyRequests: number;
  dailyTokens: number;
  lastDailyReset: string;
  lastUpdated: string;
}

export type RequestLogStatus = 'success' | 'error';

export interface RequestLogEntry {
  id: string;
  timestamp: string;
  model: string;
  connectionName: string;
  presetName: string | null;
  inputTokens: number;
  outputTokens: number;
  status: RequestLogStatus;
  error: string | null;
  stream: boolean;
  durationMs: number;
  rawInputMessageCount: number;
  processedMessageCount: number;
  processedMessages: Array<{ role: string; content: string }>;
  responseContent: string | null;
  rawInputBody: Record<string, unknown> | null;
  processedRequestBody: Record<string, unknown> | null;
  rawResponseBody: string | null;
}

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

// ============================================
// Connection Preset Types
// ============================================

export type ProviderType = 'janitorai' | 'openai-compatible' | 'custom-http';
export type ApiKeyRef = 'env' | 'local';

// Prompt Post-Processing modes (matching SillyTavern)
export type PromptPostProcessingMode =
  | 'none'           // No explicit processing applied unless strictly required by the API
  | 'merge'          // Merge consecutive messages from the same role (no tools)
  | 'merge-tools'    // Merge consecutive messages from the same role (with tools)
  | 'semi-strict'    // Merge roles and allow only one optional system message (no tools)
  | 'semi-strict-tools' // Same as semi-strict but with tools
  | 'strict'         // Merge roles, one system msg, user message first (no tools)
  | 'strict-tools'   // Same as strict but with tools
  | 'single-user';   // Merge all messages from all roles into a single user message

export interface ApiKey {
  id: string;
  name: string;
  value: string; // Encrypted/secure storage
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
  apiKeys: ApiKey[]; // Multiple API keys per provider
  selectedKeyId?: string; // Currently selected key ID
  model: string;
  // SillyTavern-like settings
  promptPostProcessing: PromptPostProcessingMode;
  bypassStatusCheck: boolean;
  // Optional settings
  defaultParameters?: SamplerParameters;
  extraHeaders?: Record<string, string>;
  extraQueryParams?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// SillyTavern Prompt Block Types
// ============================================

export type PromptBlockRole = 'system' | 'user' | 'assistant';

// Trigger types for when prompts are sent (matching SillyTavern)
export type PromptTrigger =
  | 'normal'      // Regular message generation request
  | 'continue'    // When Continue button is pressed
  | 'impersonate' // When Impersonate button is pressed
  | 'swipe'       // When triggered by swiping
  | 'regenerate'  // When Regenerate button is pressed
  | 'quiet';      // Background generation (extensions/scripts)

// Position types for prompt placement
export type PromptPosition = 'relative' | 'in-chat';

export interface STPromptBlock {
  identifier: string;
  name: string;
  role: PromptBlockRole;
  content: string;
  system_prompt: boolean;
  marker: boolean;
  enabled?: boolean;
  injection_position: number; // 0 = relative, 1 = in-chat
  injection_depth: number;    // Depth within chat history (0 = after last message)
  injection_order?: number;   // Order for prompts with same role and depth
  forbid_overrides?: boolean;
  // SillyTavern Triggers - if empty, sent for all generation types
  triggers?: PromptTrigger[];
}

export interface STPromptOrderItem {
  identifier: string;
  enabled: boolean;
}

export interface STPromptOrder {
  character_id: number;
  order: STPromptOrderItem[];
}

// ============================================
// SillyTavern Sampler Settings
// ============================================

export interface STSamplerSettings {
  // Core sampling parameters
  temperature: number;
  top_p: number;
  top_k: number;
  top_a: number;
  min_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  repetition_penalty: number;

  // Context and token limits
  openai_max_context: number;
  openai_max_tokens: number;

  // Generation settings
  seed: number;
  n: number;

  // Additional settings
  [key: string]: unknown;
}

// ============================================
// SillyTavern Chat Completion Preset
// ============================================

export interface STChatCompletionPreset {
  // Sampler settings (top-level)
  temperature: number;
  frequency_penalty: number;
  presence_penalty: number;
  top_p: number;
  top_k: number;
  top_a: number;
  min_p: number;
  repetition_penalty: number;
  openai_max_context: number;
  openai_max_tokens: number;
  seed: number;
  n: number;

  // Formatting options
  wrap_in_quotes: boolean;
  names_behavior: number;
  send_if_empty: string;


  // Format strings
  wi_format: string;
  scenario_format: string;
  personality_format: string;

  // Bias settings
  bias_preset_selected: string;
  max_context_unlocked: boolean;

  // Streaming
  stream_openai: boolean;

  // Prompt blocks and ordering
  prompts: STPromptBlock[];
  prompt_order: STPromptOrder[];

  // Assistant settings
  assistant_prefill: string;
  assistant_impersonation: string;

  // Provider-specific settings
  claude_use_sysprompt: boolean;
  use_makersuite_sysprompt: boolean;
  squash_system_messages: boolean;

  // Media settings
  image_inlining: boolean;
  inline_image_quality: string;
  video_inlining: boolean;


  // Advanced features
  function_calling: boolean;
  show_thoughts: boolean;
  reasoning_effort: string;
  enable_web_search: boolean;
  request_images: boolean;
}

// ============================================
// Chat Completion Preset (Our internal format)
// ============================================

// Sampler settings that can be enabled/disabled
export type SamplerSettingKey =
  | 'temperature'
  | 'top_p'
  | 'top_k'
  | 'top_a'
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

  // Sampler settings
  sampler: STSamplerSettings;

  // Track which sampler settings are enabled (default: all enabled)
  samplerEnabled?: Partial<Record<SamplerSettingKey, boolean>>;

  // Prompt blocks (the actual content)
  promptBlocks: STPromptBlock[];

  // Prompt ordering (defines enabled/disabled and order)
  promptOrder: STPromptOrder[];

  // Regex scripts integrated with the preset
  regexScripts?: RegexScript[];

  // Format strings
  formatStrings: {
    worldInfo: string;
    scenario: string;
    personality: string;
  };

  // Assistant settings
  assistantPrefill: string;
  assistantImpersonation: string;

  // Provider settings
  providerSettings: {
    claudeUseSysprompt: boolean;
    makersuiteUseSysprompt: boolean;
    squashSystemMessages: boolean;
    streamOpenai: boolean;
  };

  // Media settings
  mediaSettings: {
    imageInlining: boolean;
    inlineImageQuality: string;
    videoInlining: boolean;
  };


  // Advanced settings
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

  // Source file info (for imported presets)
  sourceFileName?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Legacy Prompt Preset Types (for backward compat)
// ============================================

export type PromptPresetType = 'sillytavern-chat-completion' | 'system';

export interface STMetadata {
  version?: string;
  rawJson?: unknown;
  presetType?: string;
  sourceFileName?: string;
  [key: string]: unknown;
}

export interface PromptPreset {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  type: PromptPresetType;
  systemPrompt: string;
  userTemplate: string;
  assistantTemplate?: string;
  stMetadata?: STMetadata;
  defaultParameters?: SamplerParameters;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Sampler Preset Types
// ============================================

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

export interface SamplerPreset {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  parameters: SamplerParameters;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Extension Types
// ============================================

export type ExtensionType = 'pre' | 'prompt' | 'post' | 'regex';

export interface Extension {
  id: string;
  name: string;
  type: ExtensionType;
  config: unknown;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionStep {
  extensionId: string;
  order: number;
  enabled: boolean;
}

export interface ExtensionsPipeline {
  id: string;
  name: string;
  description?: string;
  steps: ExtensionStep[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Regex Script Types
// ============================================

export interface RegexScript {
  id: string; // UUID v4
  scriptName: string;
  findRegex: string; // e.g., "/pattern/flags"
  replaceString: string;
  trimStrings: string[]; // strings to trim from matches before replacement
  placement: number[]; // 1 = user input, 2 = AI output (SillyTavern mapping)
  roles?: ('assistant' | 'user' | 'system')[]; // roles to apply the regex to (defaults to ['assistant', 'user'])
  disabled: boolean;
  markdownOnly: boolean; // only apply if content contains markdown
  runOnEdit: boolean; // irrelevant for proxy, kept for compatibility
  substituteRegex: 0 | 1 | 2; // 0 = don't substitute macros, 1 = raw, 2 = escaped
  minDepth: number | null; // minimum depth (0 = last message)
  maxDepth: number | null; // maximum depth (must be > minDepth)
  order: number; // execution order (lower numbers execute first)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// A pipeline of regex scripts (ordered collection)
export type RegexPipeline = RegexScript[];

// ============================================
// Profile Types
// ============================================

export interface Profile {
  id: string;
  name: string;
  description?: string;
  connectionId: string;
  promptPresetId: string;
  samplerPresetId: string;
  extensionsPipelineId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Settings Types
// ============================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface LoggingSettings {
  enabled: boolean;
  logRequests: boolean;
  logResponses: boolean;
  logFilePath: string;
}

export type Language = 'en' | 'ru';

export interface AppSettings {
  theme: ThemeMode;
  language: Language;
  defaultProfileId?: string;
  defaultConnectionId?: string;
  defaultPromptPresetId?: string;
  defaultSamplerPresetId?: string;
  defaultChatCompletionPresetId?: string;
  defaultPostProcessing?: PromptPostProcessingMode;
  showAdvancedOptions: boolean;
  logging: LoggingSettings;
}

// ============================================
// API Request/Response Types
// ============================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface RequestMetadata {
  characterName?: string;
  characterDescription?: string;
  scenario?: string;
  persona?: string;
  worldInfo?: string;
  exampleMessages?: ChatMessage[];
  tags?: string[];
  [key: string]: unknown;
}

export interface InternalChatRequest {
  messages: ChatMessage[];
  metadata?: RequestMetadata;
  profileId?: string;
  connectionId?: string;
  promptPresetId?: string;
  samplerPresetId?: string;
}

export interface UsageInfo {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface InternalChatResponse {
  message: ChatMessage;
  usage?: UsageInfo;
  debug?: {
    provider: string;
    model: string;
    requestDuration?: number;
    [key: string]: unknown;
  };
  error?: string;
}

// ============================================
// Storage Keys
// ============================================

export const STORAGE_KEYS = {
  CONNECTION_PRESETS: 'jt.connectionPresets',
  PROMPT_PRESETS: 'jt.promptPresets',
  SAMPLER_PRESETS: 'jt.samplerPresets',
  CHAT_COMPLETION_PRESETS: 'jt.chatCompletionPresets',
  PROFILES: 'jt.profiles',
  EXTENSIONS: 'jt.extensions',
  EXTENSIONS_PIPELINES: 'jt.extensionsPipelines',
  SETTINGS: 'jt.settings',
  REGEX_SCRIPTS: 'jt.regexScripts',
} as const;

// ============================================
// Auth Settings Types
// ============================================

export interface AuthSettings {
  isAuthenticated: boolean;
  username?: string;
  passwordHash?: string;
  janitorApiKey?: string;
}

import {
  ConnectionPreset,
  PromptPreset,
  SamplerPreset,
  ChatCompletionPreset,
  STChatCompletionPreset,
  STPromptBlock,
  STSamplerSettings,
  Profile,
  Extension,
  ExtensionsPipeline,
  RegexScript,
  AppSettings,
  STORAGE_KEYS,
} from '@/types';
import { triggerPush } from './storage-sync';

// ============================================
// Generic Storage Utilities
// ============================================

function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setToStorage<T>(key: string, value: T, autoSync: boolean = true): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // Trigger auto-push to blob if enabled
    if (autoSync) {
      triggerPush();
    }
  } catch (error) {
    console.error(`Failed to save to localStorage: ${key}`, error);
  }
}

// ============================================
// UUID Generator
// ============================================

export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================
// Connection Presets
// ============================================

export function getConnectionPresets(): ConnectionPreset[] {
  return getFromStorage<ConnectionPreset[]>(STORAGE_KEYS.CONNECTION_PRESETS, []);
}

export function saveConnectionPresets(presets: ConnectionPreset[]): void {
  setToStorage(STORAGE_KEYS.CONNECTION_PRESETS, presets);
}

export function getConnectionPreset(id: string): ConnectionPreset | undefined {
  return getConnectionPresets().find((p) => p.id === id);
}

export function addConnectionPreset(
  preset: Omit<ConnectionPreset, 'id' | 'createdAt' | 'updatedAt' | 'promptPostProcessing' | 'bypassStatusCheck'> & {
    promptPostProcessing?: ConnectionPreset['promptPostProcessing'];
    bypassStatusCheck?: boolean;
  }
): ConnectionPreset {
  const now = new Date().toISOString();
  const newPreset: ConnectionPreset = {
    ...preset,
    promptPostProcessing: preset.promptPostProcessing || 'none',
    bypassStatusCheck: preset.bypassStatusCheck || false,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const presets = getConnectionPresets();
  presets.push(newPreset);
  saveConnectionPresets(presets);
  return newPreset;
}

export function updateConnectionPreset(id: string, updates: Partial<ConnectionPreset>): ConnectionPreset | null {
  const presets = getConnectionPresets();
  const index = presets.findIndex((p) => p.id === id);
  if (index === -1) return null;

  presets[index] = {
    ...presets[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  saveConnectionPresets(presets);
  return presets[index];
}

export function deleteConnectionPreset(id: string): boolean {
  const presets = getConnectionPresets();
  const filtered = presets.filter((p) => p.id !== id);
  if (filtered.length === presets.length) return false;
  saveConnectionPresets(filtered);
  return true;
}

// ============================================
// Prompt Presets
// ============================================

export function getPromptPresets(): PromptPreset[] {
  return getFromStorage<PromptPreset[]>(STORAGE_KEYS.PROMPT_PRESETS, []);
}

export function savePromptPresets(presets: PromptPreset[]): void {
  setToStorage(STORAGE_KEYS.PROMPT_PRESETS, presets);
}

export function getPromptPreset(id: string): PromptPreset | undefined {
  return getPromptPresets().find((p) => p.id === id);
}

export function addPromptPreset(preset: Omit<PromptPreset, 'id' | 'createdAt' | 'updatedAt'>): PromptPreset {
  const now = new Date().toISOString();
  const newPreset: PromptPreset = {
    ...preset,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const presets = getPromptPresets();
  presets.push(newPreset);
  savePromptPresets(presets);
  return newPreset;
}

export function updatePromptPreset(id: string, updates: Partial<PromptPreset>): PromptPreset | null {
  const presets = getPromptPresets();
  const index = presets.findIndex((p) => p.id === id);
  if (index === -1) return null;

  presets[index] = {
    ...presets[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  savePromptPresets(presets);
  return presets[index];
}

export function deletePromptPreset(id: string): boolean {
  const presets = getPromptPresets();
  const filtered = presets.filter((p) => p.id !== id);
  if (filtered.length === presets.length) return false;
  savePromptPresets(filtered);
  return true;
}

// ============================================
// Sampler Presets
// ============================================

export function getSamplerPresets(): SamplerPreset[] {
  return getFromStorage<SamplerPreset[]>(STORAGE_KEYS.SAMPLER_PRESETS, []);
}

export function saveSamplerPresets(presets: SamplerPreset[]): void {
  setToStorage(STORAGE_KEYS.SAMPLER_PRESETS, presets);
}

export function getSamplerPreset(id: string): SamplerPreset | undefined {
  return getSamplerPresets().find((p) => p.id === id);
}

export function addSamplerPreset(preset: Omit<SamplerPreset, 'id' | 'createdAt' | 'updatedAt'>): SamplerPreset {
  const now = new Date().toISOString();
  const newPreset: SamplerPreset = {
    ...preset,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const presets = getSamplerPresets();
  presets.push(newPreset);
  saveSamplerPresets(presets);
  return newPreset;
}

export function updateSamplerPreset(id: string, updates: Partial<SamplerPreset>): SamplerPreset | null {
  const presets = getSamplerPresets();
  const index = presets.findIndex((p) => p.id === id);
  if (index === -1) return null;

  presets[index] = {
    ...presets[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  saveSamplerPresets(presets);
  return presets[index];
}

export function deleteSamplerPreset(id: string): boolean {
  const presets = getSamplerPresets();
  const filtered = presets.filter((p) => p.id !== id);
  if (filtered.length === presets.length) return false;
  saveSamplerPresets(filtered);
  return true;
}

// ============================================
// Profiles
// ============================================

export function getProfiles(): Profile[] {
  return getFromStorage<Profile[]>(STORAGE_KEYS.PROFILES, []);
}

export function saveProfiles(profiles: Profile[]): void {
  setToStorage(STORAGE_KEYS.PROFILES, profiles);
}

export function getProfile(id: string): Profile | undefined {
  return getProfiles().find((p) => p.id === id);
}

export function addProfile(profile: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>): Profile {
  const now = new Date().toISOString();
  const newProfile: Profile = {
    ...profile,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const profiles = getProfiles();
  profiles.push(newProfile);
  saveProfiles(profiles);
  return newProfile;
}

export function updateProfile(id: string, updates: Partial<Profile>): Profile | null {
  const profiles = getProfiles();
  const index = profiles.findIndex((p) => p.id === id);
  if (index === -1) return null;

  profiles[index] = {
    ...profiles[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  saveProfiles(profiles);
  return profiles[index];
}

export function deleteProfile(id: string): boolean {
  const profiles = getProfiles();
  const filtered = profiles.filter((p) => p.id !== id);
  if (filtered.length === profiles.length) return false;
  saveProfiles(filtered);
  return true;
}

// ============================================
// Extensions
// ============================================

export function getExtensions(): Extension[] {
  return getFromStorage<Extension[]>(STORAGE_KEYS.EXTENSIONS, []);
}

export function saveExtensions(extensions: Extension[]): void {
  setToStorage(STORAGE_KEYS.EXTENSIONS, extensions);
}

export function getExtensionsPipelines(): ExtensionsPipeline[] {
  return getFromStorage<ExtensionsPipeline[]>(STORAGE_KEYS.EXTENSIONS_PIPELINES, []);
}

export function saveExtensionsPipelines(pipelines: ExtensionsPipeline[]): void {
  setToStorage(STORAGE_KEYS.EXTENSIONS_PIPELINES, pipelines);
}

// ============================================
// Regex Script Utilities
// ============================================

/**
 * Normalizes a regex pattern to fix double-escaping issues from SillyTavern exports.
 * Converts patterns like "/<(?:font|div|h[1-6]|p|span|i|b|\\/font|\\/div)[^>]*>/g"
 * to "/<(?:font|div|h[1-6]|p|span|i|b|\/font|\/div)[^>]*>/g"
 */
export function normalizeRegexPattern(findRegex: string): string {
  if (findRegex.startsWith('/') && findRegex.lastIndexOf('/') > 0) {
    const lastSlash = findRegex.lastIndexOf('/');
    let pattern = findRegex.slice(1, lastSlash);
    const flags = findRegex.slice(lastSlash + 1);

    // Fix double-escaped forward slashes (from SillyTavern exports)
    pattern = pattern.replace(/\\\//g, '/');

    return `/${pattern}/${flags}`;
  }
  return findRegex;
}

// ============================================
// Regex Scripts
// ============================================

export function getRegexScripts(): RegexScript[] {
  return getFromStorage<RegexScript[]>(STORAGE_KEYS.REGEX_SCRIPTS, []);
}

export function saveRegexScripts(scripts: RegexScript[]): void {
  setToStorage(STORAGE_KEYS.REGEX_SCRIPTS, scripts);
}

export function getRegexScript(id: string): RegexScript | undefined {
  return getRegexScripts().find((s) => s.id === id);
}

export function addRegexScript(script: Omit<RegexScript, 'id' | 'createdAt' | 'updatedAt'>): RegexScript {
  const now = new Date().toISOString();
  const newScript: RegexScript = {
    ...script,
    findRegex: normalizeRegexPattern(script.findRegex),
    roles: script.roles || ['assistant', 'user'], // Default to assistant and user roles
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const scripts = getRegexScripts();
  scripts.push(newScript);
  saveRegexScripts(scripts);
  return newScript;
}

export function updateRegexScript(id: string, updates: Partial<RegexScript>): RegexScript | null {
  const scripts = getRegexScripts();
  const index = scripts.findIndex((s) => s.id === id);
  if (index === -1) return null;

  scripts[index] = {
    ...scripts[index],
    ...updates,
    findRegex: updates.findRegex ? normalizeRegexPattern(updates.findRegex) : scripts[index].findRegex,
    roles: updates.roles !== undefined ? updates.roles : scripts[index].roles || ['assistant', 'user'], // Preserve existing roles or set default
    id,
    updatedAt: new Date().toISOString(),
  };
  saveRegexScripts(scripts);
  return scripts[index];
}

export function deleteRegexScript(id: string): boolean {
  const scripts = getRegexScripts();
  const filtered = scripts.filter((s) => s.id !== id);
  if (filtered.length === scripts.length) return false;
  saveRegexScripts(filtered);
  return true;
}

// ============================================
// Settings
// ============================================

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
  showAdvancedOptions: false,
  logging: {
    enabled: false,
    logRequests: true,
    logResponses: true,
    logFilePath: 'logs/proxy.log',
  },
};

export function getSettings(): AppSettings {
  return getFromStorage<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function saveSettings(settings: AppSettings): void {
  setToStorage(STORAGE_KEYS.SETTINGS, settings);
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...updates };
  saveSettings(updated);
  return updated;
}

// ============================================
// Chat Completion Presets
// ============================================

export function getChatCompletionPresets(): ChatCompletionPreset[] {
  return getFromStorage<ChatCompletionPreset[]>(STORAGE_KEYS.CHAT_COMPLETION_PRESETS, []);
}

export function saveChatCompletionPresets(presets: ChatCompletionPreset[]): void {
  setToStorage(STORAGE_KEYS.CHAT_COMPLETION_PRESETS, presets);
}

export function getChatCompletionPreset(id: string): ChatCompletionPreset | undefined {
  return getChatCompletionPresets().find((p) => p.id === id);
}

export function addChatCompletionPreset(
  preset: Omit<ChatCompletionPreset, 'id' | 'createdAt' | 'updatedAt'>
): ChatCompletionPreset {
  const now = new Date().toISOString();
  const newPreset: ChatCompletionPreset = {
    ...preset,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const presets = getChatCompletionPresets();
  presets.push(newPreset);
  saveChatCompletionPresets(presets);
  return newPreset;
}

export function updateChatCompletionPreset(
  id: string,
  updates: Partial<ChatCompletionPreset>
): ChatCompletionPreset | null {
  const presets = getChatCompletionPresets();
  const index = presets.findIndex((p) => p.id === id);
  if (index === -1) return null;

  presets[index] = {
    ...presets[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  saveChatCompletionPresets(presets);
  return presets[index];
}

export function deleteChatCompletionPreset(id: string): boolean {
  const presets = getChatCompletionPresets();
  const filtered = presets.filter((p) => p.id !== id);
  if (filtered.length === presets.length) return false;
  saveChatCompletionPresets(filtered);
  return true;
}

// ============================================
// ST Preset Import/Export Utilities
// ============================================

const DEFAULT_SAMPLER_SETTINGS: STSamplerSettings = {
  temperature: 1,
  top_p: 1,
  top_k: 0,
  top_a: 0,
  min_p: 0,
  frequency_penalty: 0,
  presence_penalty: 0,
  repetition_penalty: 1,
  openai_max_context: 4096,
  openai_max_tokens: 2048,
  seed: -1,
  n: 1,
};

export function importSTPreset(
  rawJson: STChatCompletionPreset,
  fileName?: string
): ChatCompletionPreset {
  const sampler: STSamplerSettings = {
    temperature: rawJson.temperature ?? DEFAULT_SAMPLER_SETTINGS.temperature,
    top_p: rawJson.top_p ?? DEFAULT_SAMPLER_SETTINGS.top_p,
    top_k: rawJson.top_k ?? DEFAULT_SAMPLER_SETTINGS.top_k,
    top_a: rawJson.top_a ?? DEFAULT_SAMPLER_SETTINGS.top_a,
    min_p: rawJson.min_p ?? DEFAULT_SAMPLER_SETTINGS.min_p,
    frequency_penalty: rawJson.frequency_penalty ?? DEFAULT_SAMPLER_SETTINGS.frequency_penalty,
    presence_penalty: rawJson.presence_penalty ?? DEFAULT_SAMPLER_SETTINGS.presence_penalty,
    repetition_penalty: rawJson.repetition_penalty ?? DEFAULT_SAMPLER_SETTINGS.repetition_penalty,
    openai_max_context: rawJson.openai_max_context ?? DEFAULT_SAMPLER_SETTINGS.openai_max_context,
    openai_max_tokens: rawJson.openai_max_tokens ?? DEFAULT_SAMPLER_SETTINGS.openai_max_tokens,
    seed: rawJson.seed ?? DEFAULT_SAMPLER_SETTINGS.seed,
    n: rawJson.n ?? DEFAULT_SAMPLER_SETTINGS.n,
  };

  // Normalize prompt blocks
  const promptBlocks: STPromptBlock[] = (rawJson.prompts || []).map((p) => ({
    identifier: p.identifier || generateId(),
    name: p.name || '',
    role: p.role || 'system',
    content: p.content || '',
    system_prompt: p.system_prompt ?? true,
    marker: p.marker ?? false,
    enabled: p.enabled,
    injection_position: p.injection_position ?? 0,
    injection_depth: p.injection_depth ?? 4,
    injection_order: p.injection_order,
    forbid_overrides: p.forbid_overrides,
  }));

  const now = new Date().toISOString();
  const presetName = fileName?.replace(/\.json$/i, '') || 'Imported Preset';

  return {
    id: generateId(),
    name: presetName,
    description: `Imported from ${fileName || 'SillyTavern preset'}`,
    tags: ['imported', 'sillytavern'],
    sampler,
    promptBlocks,
    promptOrder: rawJson.prompt_order || [],
    specialPrompts: {
      impersonation: rawJson.impersonation_prompt || '',
      newChat: rawJson.new_chat_prompt || '',
      newGroupChat: rawJson.new_group_chat_prompt || '',
      newExampleChat: rawJson.new_example_chat_prompt || '',
      continueNudge: rawJson.continue_nudge_prompt || '',
      groupNudge: rawJson.group_nudge_prompt || '',
    },
    formatStrings: {
      worldInfo: rawJson.wi_format || '{0}',
      scenario: rawJson.scenario_format || '{{scenario}}',
      personality: rawJson.personality_format || "[{{char}}'s personality: {{personality}}]",
    },
    assistantPrefill: rawJson.assistant_prefill || '',
    assistantImpersonation: rawJson.assistant_impersonation || '',
    providerSettings: {
      claudeUseSysprompt: rawJson.claude_use_sysprompt ?? false,
      makersuiteUseSysprompt: rawJson.use_makersuite_sysprompt ?? true,
      squashSystemMessages: rawJson.squash_system_messages ?? true,
      streamOpenai: rawJson.stream_openai ?? false,
    },
    mediaSettings: {
      imageInlining: rawJson.image_inlining ?? true,
      inlineImageQuality: rawJson.inline_image_quality || 'high',
      videoInlining: rawJson.video_inlining ?? true,
    },
    continueSettings: {
      prefill: rawJson.continue_prefill ?? true,
      postfix: rawJson.continue_postfix || ' ',
    },
    advancedSettings: {
      functionCalling: rawJson.function_calling ?? false,
      showThoughts: rawJson.show_thoughts ?? true,
      reasoningEffort: rawJson.reasoning_effort || 'max',
      enableWebSearch: rawJson.enable_web_search ?? false,
      requestImages: rawJson.request_images ?? false,
      wrapInQuotes: rawJson.wrap_in_quotes ?? false,
      namesBehavior: rawJson.names_behavior ?? 0,
      sendIfEmpty: rawJson.send_if_empty || '',
      biasPresetSelected: rawJson.bias_preset_selected || 'Default (none)',
      maxContextUnlocked: rawJson.max_context_unlocked ?? true,
      startReplyWith: {
        enabled: false,
        content: '',
      },
    },
    sourceFileName: fileName,
    createdAt: now,
    updatedAt: now,
  };
}

export function exportToSTPreset(preset: ChatCompletionPreset): STChatCompletionPreset {
  return {
    temperature: preset.sampler.temperature,
    frequency_penalty: preset.sampler.frequency_penalty,
    presence_penalty: preset.sampler.presence_penalty,
    top_p: preset.sampler.top_p,
    top_k: preset.sampler.top_k,
    top_a: preset.sampler.top_a,
    min_p: preset.sampler.min_p,
    repetition_penalty: preset.sampler.repetition_penalty,
    openai_max_context: preset.sampler.openai_max_context,
    openai_max_tokens: preset.sampler.openai_max_tokens,
    seed: preset.sampler.seed,
    n: preset.sampler.n,
    wrap_in_quotes: preset.advancedSettings.wrapInQuotes,
    names_behavior: preset.advancedSettings.namesBehavior,
    send_if_empty: preset.advancedSettings.sendIfEmpty,
    impersonation_prompt: preset.specialPrompts.impersonation,
    new_chat_prompt: preset.specialPrompts.newChat,
    new_group_chat_prompt: preset.specialPrompts.newGroupChat,
    new_example_chat_prompt: preset.specialPrompts.newExampleChat,
    continue_nudge_prompt: preset.specialPrompts.continueNudge,
    group_nudge_prompt: preset.specialPrompts.groupNudge,
    wi_format: preset.formatStrings.worldInfo,
    scenario_format: preset.formatStrings.scenario,
    personality_format: preset.formatStrings.personality,
    bias_preset_selected: preset.advancedSettings.biasPresetSelected,
    max_context_unlocked: preset.advancedSettings.maxContextUnlocked,
    stream_openai: preset.providerSettings.streamOpenai,
    prompts: preset.promptBlocks,
    prompt_order: preset.promptOrder,
    assistant_prefill: preset.assistantPrefill,
    assistant_impersonation: preset.assistantImpersonation,
    claude_use_sysprompt: preset.providerSettings.claudeUseSysprompt,
    use_makersuite_sysprompt: preset.providerSettings.makersuiteUseSysprompt,
    squash_system_messages: preset.providerSettings.squashSystemMessages,
    image_inlining: preset.mediaSettings.imageInlining,
    inline_image_quality: preset.mediaSettings.inlineImageQuality,
    video_inlining: preset.mediaSettings.videoInlining,
    continue_prefill: preset.continueSettings.prefill,
    continue_postfix: preset.continueSettings.postfix,
    function_calling: preset.advancedSettings.functionCalling,
    show_thoughts: preset.advancedSettings.showThoughts,
    reasoning_effort: preset.advancedSettings.reasoningEffort,
    enable_web_search: preset.advancedSettings.enableWebSearch,
    request_images: preset.advancedSettings.requestImages,
  };
}

// Create a default/empty chat completion preset
export function createDefaultChatCompletionPreset(): Omit<ChatCompletionPreset, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'New Preset',
    description: '',
    tags: [],
    sampler: { ...DEFAULT_SAMPLER_SETTINGS },
    promptBlocks: [],
    promptOrder: [],
    specialPrompts: {
      impersonation: '',
      newChat: '',
      newGroupChat: '',
      newExampleChat: '',
      continueNudge: '',
      groupNudge: '',
    },
    formatStrings: {
      worldInfo: '{0}',
      scenario: '{{scenario}}',
      personality: "[{{char}}'s personality: {{personality}}]",
    },
    assistantPrefill: '',
    assistantImpersonation: '',
    providerSettings: {
      claudeUseSysprompt: false,
      makersuiteUseSysprompt: true,
      squashSystemMessages: true,
      streamOpenai: false,
    },
    mediaSettings: {
      imageInlining: true,
      inlineImageQuality: 'high',
      videoInlining: true,
    },
    continueSettings: {
      prefill: true,
      postfix: ' ',
    },
    advancedSettings: {
      functionCalling: false,
      showThoughts: true,
      reasoningEffort: 'max',
      enableWebSearch: false,
      requestImages: false,
      wrapInQuotes: false,
      namesBehavior: 0,
      sendIfEmpty: '',
      biasPresetSelected: 'Default (none)',
      maxContextUnlocked: true,
      startReplyWith: {
        enabled: false,
        content: '',
      },
    },
  };
}

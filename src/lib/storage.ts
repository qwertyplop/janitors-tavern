import {
  ConnectionPreset,
  ApiKey,
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
  SamplerSettingKey,
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
    // Trigger auto-push to Firebase if enabled
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
  preset: Omit<ConnectionPreset, 'id' | 'createdAt' | 'updatedAt' | 'promptPostProcessing' | 'bypassStatusCheck' | 'apiKeys'> & {
    promptPostProcessing?: ConnectionPreset['promptPostProcessing'];
    bypassStatusCheck?: boolean;
  }
): ConnectionPreset {
  const now = new Date().toISOString();
  const newPreset: ConnectionPreset = {
    ...preset,
    promptPostProcessing: preset.promptPostProcessing || 'none',
    bypassStatusCheck: preset.bypassStatusCheck || false,
    apiKeys: [], // Initialize empty API keys array
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
// API Key Management Functions
// ============================================

export function addApiKeyToConnection(connectionId: string, keyName: string, keyValue: string): ApiKey | null {
  const connection = getConnectionPreset(connectionId);
  if (!connection) return null;

  // Ensure apiKeys is always an array (for backward compatibility)
  const apiKeys = connection.apiKeys || [];

  // Check for duplicate key names within the same connection
  const duplicateKey = apiKeys.find(key => key.name === keyName);
  if (duplicateKey) {
    throw new Error(`Key with name "${keyName}" already exists in this connection`);
  }

  const now = new Date().toISOString();
  const newKey: ApiKey = {
    id: generateId(),
    name: keyName,
    value: keyValue,
    createdAt: now,
    updatedAt: now,
  };

  const updatedApiKeys = [...apiKeys, newKey];
  const updatedConnection = updateConnectionPreset(connectionId, {
    apiKeys: updatedApiKeys,
    // If this is the first key, select it automatically
    selectedKeyId: connection.selectedKeyId || newKey.id,
  });

  return newKey;
}

export function updateApiKey(connectionId: string, keyId: string, updates: Partial<Omit<ApiKey, 'id' | 'createdAt' | 'updatedAt'>>): ApiKey | null {
  const connection = getConnectionPreset(connectionId);
  if (!connection) return null;

  // Ensure apiKeys is always an array (for backward compatibility)
  const apiKeys = connection.apiKeys || [];

  const keyIndex = apiKeys.findIndex(key => key.id === keyId);
  if (keyIndex === -1) return null;

  // If updating name, check for duplicates
  if (updates.name) {
    const duplicateKey = apiKeys.find(key => key.name === updates.name && key.id !== keyId);
    if (duplicateKey) {
      throw new Error(`Key with name "${updates.name}" already exists in this connection`);
    }
  }

  const updatedApiKeys = [...apiKeys];
  updatedApiKeys[keyIndex] = {
    ...updatedApiKeys[keyIndex],
    ...updates,
    id: keyId,
    updatedAt: new Date().toISOString(),
  };

  updateConnectionPreset(connectionId, { apiKeys: updatedApiKeys });
  return updatedApiKeys[keyIndex];
}

export function deleteApiKey(connectionId: string, keyId: string): boolean {
  const connection = getConnectionPreset(connectionId);
  if (!connection) return false;

  // Ensure apiKeys is always an array (for backward compatibility)
  const apiKeys = connection.apiKeys || [];

  const updatedApiKeys = apiKeys.filter(key => key.id !== keyId);
  
  // If the deleted key was selected, select another key or clear selection
  let selectedKeyId = connection.selectedKeyId;
  if (selectedKeyId === keyId) {
    selectedKeyId = updatedApiKeys.length > 0 ? updatedApiKeys[0].id : undefined;
  }

  updateConnectionPreset(connectionId, {
    apiKeys: updatedApiKeys,
    selectedKeyId,
  });

  return true;
}

export function setSelectedApiKey(connectionId: string, keyId: string | undefined): boolean {
  const connection = getConnectionPreset(connectionId);
  if (!connection) return false;

  // Ensure apiKeys is always an array (for backward compatibility)
  const apiKeys = connection.apiKeys || [];

  // If keyId is provided, verify it exists
  if (keyId !== undefined) {
    const keyExists = apiKeys.some(key => key.id === keyId);
    if (!keyExists) return false;
  }

  updateConnectionPreset(connectionId, { selectedKeyId: keyId });
  return true;
}

export function getSelectedApiKey(connectionId: string): ApiKey | undefined {
  const connection = getConnectionPreset(connectionId);
  if (!connection || !connection.selectedKeyId) return undefined;
  
  // Ensure apiKeys is always an array (for backward compatibility)
  const apiKeys = connection.apiKeys || [];
  
  return apiKeys.find(key => key.id === connection.selectedKeyId);
}

/**
 * Migrates existing connection presets from single apiKeyLocalEncrypted to multiple apiKeys
 * This should be called once when the app starts to ensure backward compatibility
 */
export function migrateConnectionPresetsToMultiKey(): void {
  const presets = getConnectionPresets();
  const needsMigration = presets.some(preset =>
    (preset as any).apiKeyLocalEncrypted !== undefined &&
    (!preset.apiKeys || preset.apiKeys.length === 0)
  );

  if (needsMigration) {
    const updatedPresets = presets.map(preset => {
      // Skip if already migrated
      if (preset.apiKeys && preset.apiKeys.length > 0) return preset;

      const legacyKey = (preset as any).apiKeyLocalEncrypted;
      if (!legacyKey) return preset;

      const now = new Date().toISOString();
      const migratedKey: ApiKey = {
        id: generateId(),
        name: 'Default Key',
        value: legacyKey,
        createdAt: now,
        updatedAt: now,
      };

      return {
        ...preset,
        apiKeys: [migratedKey],
        selectedKeyId: migratedKey.id,
        // Remove legacy field
        apiKeyLocalEncrypted: undefined,
      };
    });

    saveConnectionPresets(updatedPresets);
  }
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

export function addRegexScript(script: Omit<RegexScript, 'id' | 'createdAt' | 'updatedAt' | 'order'>): RegexScript {
  const now = new Date().toISOString();
  const scripts = getRegexScripts();
  // Determine the next order value (max + 1, or 0 if empty)
  const nextOrder = scripts.length > 0 ? Math.max(...scripts.map(s => s.order)) + 1 : 0;

  const newScript: RegexScript = {
    ...script,
    findRegex: normalizeRegexPattern(script.findRegex),
    roles: script.roles || ['assistant', 'user'], // Default to assistant and user roles
    disabled: script.disabled ?? false, // Ensure disabled field has a default value
    markdownOnly: script.markdownOnly ?? false, // Ensure markdownOnly has a default value
    runOnEdit: script.runOnEdit ?? false, // Ensure runOnEdit has a default value
    substituteRegex: script.substituteRegex ?? 0, // Ensure substituteRegex has a default value
    minDepth: script.minDepth ?? null, // Ensure minDepth has a default value
    maxDepth: script.maxDepth ?? null, // Ensure maxDepth has a default value
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    order: nextOrder,
  };
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

/**
 * Migrates existing regex scripts to include order field
 * This should be called once when the app starts to ensure all scripts have order fields
 */
export function migrateRegexScriptsOrder(): void {
  const scripts = getRegexScripts();
  // Check if any script is missing the order field
  const needsMigration = scripts.some(script => script.order === undefined);

  if (needsMigration) {
    const updatedScripts = scripts.map((script, index) => ({
      ...script,
      order: script.order ?? index, // Preserve existing order if present, otherwise use index
      updatedAt: new Date().toISOString(),
    }));
    saveRegexScripts(updatedScripts);
  }
}

/**
 * Migrates existing regex scripts to ensure all required fields have default values
 * This should be called once when the app starts to fix scripts missing required fields
 */
export function migrateRegexScriptsRequiredFields(): void {
  const scripts = getRegexScripts();
  // Check if any script is missing required fields
  const needsMigration = scripts.some(script =>
    script.disabled === undefined ||
    script.markdownOnly === undefined ||
    script.runOnEdit === undefined ||
    script.substituteRegex === undefined ||
    script.minDepth === undefined ||
    script.maxDepth === undefined ||
    !script.roles
  );

  if (needsMigration) {
    const updatedScripts = scripts.map((script) => ({
      ...script,
      disabled: script.disabled ?? false,
      markdownOnly: script.markdownOnly ?? false,
      runOnEdit: script.runOnEdit ?? false,
      substituteRegex: script.substituteRegex ?? 0,
      minDepth: script.minDepth ?? null,
      maxDepth: script.maxDepth ?? null,
      roles: script.roles || ['assistant', 'user'],
      updatedAt: new Date().toISOString(),
    }));
    saveRegexScripts(updatedScripts);
  }
}

/**
 * Updates the order of regex scripts
 * @param newOrder Array of script IDs in the new order
 */
export function updateRegexScriptsOrder(newOrder: string[]): void {
  const scripts = getRegexScripts();
  const updatedScripts = newOrder.map((id, index) => {
    const script = scripts.find(s => s.id === id);
    if (!script) return null;
    return {
      ...script,
      order: index,
      updatedAt: new Date().toISOString(),
    };
  }).filter(script => script !== null) as RegexScript[];

  // Add any scripts that weren't in the newOrder (shouldn't happen but just in case)
  const orderedIds = new Set(newOrder);
  scripts.forEach(script => {
    if (!orderedIds.has(script.id)) {
      updatedScripts.push({
        ...script,
        order: updatedScripts.length,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  saveRegexScripts(updatedScripts);
}

// ============================================
// Settings
// ============================================

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
  showAdvancedOptions: false,
  defaultPostProcessing: 'none',
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

  // Extract regex scripts from extensions.regex_scripts if present
  const regexScripts: RegexScript[] = [];
  const extensions = (rawJson as any).extensions;
  if (extensions && Array.isArray(extensions.regex_scripts)) {
    const now = new Date().toISOString();
    extensions.regex_scripts.forEach((script: any, index: number) => {
      const newScript: RegexScript = {
        id: generateId(),
        scriptName: script.scriptName || `Script ${index + 1}`,
        findRegex: normalizeRegexPattern(script.findRegex || ''),
        replaceString: script.replaceString || '',
        trimStrings: script.trimStrings || [],
        placement: script.placement || [1, 2], // Default to both user input and AI output
        roles: script.roles || ['assistant', 'user'],
        disabled: script.disabled ?? false,
        markdownOnly: script.markdownOnly ?? false,
        runOnEdit: script.runOnEdit ?? false,
        substituteRegex: script.substituteRegex ?? 0,
        minDepth: script.minDepth ?? null,
        maxDepth: script.maxDepth ?? null,
        order: index,
        createdAt: now,
        updatedAt: now,
      };
      regexScripts.push(newScript);
    });
  }

  const now = new Date().toISOString();
  const presetName = fileName?.replace(/\.json$/i, '') || 'Imported Preset';

  // All sampler settings default to disabled (false) except max tokens which is enabled by default
  const samplerEnabled: Partial<Record<SamplerSettingKey, boolean>> = {
    temperature: false,
    top_p: false,
    top_k: false,
    top_a: false,
    min_p: false,
    frequency_penalty: false,
    presence_penalty: false,
    repetition_penalty: false,
    openai_max_tokens: true, // Enabled by default
    seed: false,
  };

  return {
    id: generateId(),
    name: presetName,
    description: `Imported from ${fileName || 'SillyTavern preset'}`,
    tags: ['imported', 'sillytavern'],
    sampler,
    samplerEnabled,
    promptBlocks,
    promptOrder: rawJson.prompt_order || [],
    regexScripts: regexScripts.length > 0 ? regexScripts : undefined,
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
    function_calling: preset.advancedSettings.functionCalling,
    show_thoughts: preset.advancedSettings.showThoughts,
    reasoning_effort: preset.advancedSettings.reasoningEffort,
    enable_web_search: preset.advancedSettings.enableWebSearch,
    request_images: preset.advancedSettings.requestImages,
  };
}

/**
 * Get all preset-specific regex scripts grouped by preset name
 * Returns an array of objects with preset info and its regex scripts
 */
export function getPresetRegexScripts(): Array<{
  presetId: string;
  presetName: string;
  scripts: RegexScript[];
}> {
  const presets = getChatCompletionPresets();
  const result: Array<{
    presetId: string;
    presetName: string;
    scripts: RegexScript[];
  }> = [];

  presets.forEach(preset => {
    if (preset.regexScripts && preset.regexScripts.length > 0) {
      result.push({
        presetId: preset.id,
        presetName: preset.name,
        scripts: preset.regexScripts.map(script => ({
          ...script,
          // Add preset reference to each script for identification
          _presetId: preset.id,
          _presetName: preset.name,
        })),
      });
    }
  });

  return result;
}

/**
 * Get all regex scripts including both standalone and preset-specific
 * Returns a flat array with source information
 */
export function getAllRegexScripts(): Array<RegexScript & { source: 'standalone' | 'preset'; presetId?: string; presetName?: string }> {
  const standaloneScripts = getRegexScripts();
  const presetScripts = getPresetRegexScripts();
  
  const result: Array<RegexScript & { source: 'standalone' | 'preset'; presetId?: string; presetName?: string }> = [];
  
  // Add standalone scripts
  standaloneScripts.forEach(script => {
    result.push({
      ...script,
      source: 'standalone',
    });
  });
  
  // Add preset scripts
  presetScripts.forEach(presetGroup => {
    presetGroup.scripts.forEach(script => {
      result.push({
        ...script,
        source: 'preset',
        presetId: presetGroup.presetId,
        presetName: presetGroup.presetName,
      });
    });
  });
  
  return result;
}

/**
 * Update a preset-specific regex script
 * @param presetId The ID of the preset containing the script
 * @param scriptId The ID of the script to update
 * @param updates The updates to apply to the script
 * @returns The updated preset or null if not found
 */
export function updatePresetRegexScript(
  presetId: string,
  scriptId: string,
  updates: Partial<Omit<RegexScript, 'id' | 'createdAt' | 'updatedAt' | '_presetId' | '_presetName'>>
): ChatCompletionPreset | null {
  const preset = getChatCompletionPreset(presetId);
  if (!preset || !preset.regexScripts) return null;
  
  const scriptIndex = preset.regexScripts.findIndex(s => s.id === scriptId);
  if (scriptIndex === -1) return null;
  
  const updatedScripts = [...preset.regexScripts];
  const now = new Date().toISOString();
  
  updatedScripts[scriptIndex] = {
    ...updatedScripts[scriptIndex],
    ...updates,
    findRegex: updates.findRegex ? normalizeRegexPattern(updates.findRegex) : updatedScripts[scriptIndex].findRegex,
    roles: updates.roles !== undefined ? updates.roles : updatedScripts[scriptIndex].roles || ['assistant', 'user'],
    updatedAt: now,
  };
  
  return updateChatCompletionPreset(presetId, {
    regexScripts: updatedScripts,
  });
}

/**
 * Toggle the disabled state of a preset-specific regex script
 * @param presetId The ID of the preset containing the script
 * @param scriptId The ID of the script to toggle
 * @returns The updated preset or null if not found
 */
export function togglePresetRegexScriptDisabled(
  presetId: string,
  scriptId: string
): ChatCompletionPreset | null {
  const preset = getChatCompletionPreset(presetId);
  if (!preset || !preset.regexScripts) return null;
  
  const scriptIndex = preset.regexScripts.findIndex(s => s.id === scriptId);
  if (scriptIndex === -1) return null;
  
  const updatedScripts = [...preset.regexScripts];
  const now = new Date().toISOString();
  
  updatedScripts[scriptIndex] = {
    ...updatedScripts[scriptIndex],
    disabled: !updatedScripts[scriptIndex].disabled,
    updatedAt: now,
  };
  
  return updateChatCompletionPreset(presetId, {
    regexScripts: updatedScripts,
  });
}

// Create a default/empty chat completion preset
export function createDefaultChatCompletionPreset(): Omit<ChatCompletionPreset, 'id' | 'createdAt' | 'updatedAt'> {
  // All sampler settings default to disabled (false) except max tokens which is enabled by default
  const samplerEnabled: Partial<Record<SamplerSettingKey, boolean>> = {
    temperature: false,
    top_p: false,
    top_k: false,
    top_a: false,
    min_p: false,
    frequency_penalty: false,
    presence_penalty: false,
    repetition_penalty: false,
    openai_max_tokens: true, // Enabled by default
    seed: false,
  };

  return {
    name: 'New Preset',
    description: '',
    tags: [],
    sampler: { ...DEFAULT_SAMPLER_SETTINGS },
    samplerEnabled,
    promptBlocks: [],
    promptOrder: [],
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

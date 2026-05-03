import type {
  ConnectionPreset,
  ChatCompletionPreset,
  RegexScript,
  AppSettings,
  StructuredOutputPreset,
} from './types';
import { STORAGE_KEYS, DEFAULT_APP_SETTINGS } from './types';

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

export const storage = {
  connections: {
    getAll: (): ConnectionPreset[] => getItem<ConnectionPreset[]>(STORAGE_KEYS.CONNECTION_PRESETS, []),
    save: (presets: ConnectionPreset[]): void => setItem(STORAGE_KEYS.CONNECTION_PRESETS, presets),
    get: (id: string): ConnectionPreset | null => {
      const all = storage.connections.getAll();
      return all.find(p => p.id === id) || null;
    },
    upsert: (preset: ConnectionPreset): void => {
      const all = storage.connections.getAll();
      const idx = all.findIndex(p => p.id === preset.id);
      if (idx >= 0) all[idx] = preset;
      else all.push(preset);
      storage.connections.save(all);
    },
    delete: (id: string): void => {
      const all = storage.connections.getAll().filter(p => p.id !== id);
      storage.connections.save(all);
    },
  },

  presets: {
    getAll: (): ChatCompletionPreset[] => getItem<ChatCompletionPreset[]>(STORAGE_KEYS.CHAT_COMPLETION_PRESETS, []),
    save: (presets: ChatCompletionPreset[]): void => setItem(STORAGE_KEYS.CHAT_COMPLETION_PRESETS, presets),
    get: (id: string): ChatCompletionPreset | null => {
      const all = storage.presets.getAll();
      return all.find(p => p.id === id) || null;
    },
    upsert: (preset: ChatCompletionPreset): void => {
      const all = storage.presets.getAll();
      const idx = all.findIndex(p => p.id === preset.id);
      if (idx >= 0) all[idx] = preset;
      else all.push(preset);
      storage.presets.save(all);
    },
    delete: (id: string): void => {
      const all = storage.presets.getAll().filter(p => p.id !== id);
      storage.presets.save(all);
    },
  },

  regexScripts: {
    getAll: (): RegexScript[] => getItem<RegexScript[]>(STORAGE_KEYS.REGEX_SCRIPTS, []),
    save: (scripts: RegexScript[]): void => setItem(STORAGE_KEYS.REGEX_SCRIPTS, scripts),
    upsert: (script: RegexScript): void => {
      const all = storage.regexScripts.getAll();
      const idx = all.findIndex(s => s.id === script.id);
      if (idx >= 0) all[idx] = script;
      else all.push(script);
      storage.regexScripts.save(all);
    },
    delete: (id: string): void => {
      const all = storage.regexScripts.getAll().filter(s => s.id !== id);
      storage.regexScripts.save(all);
    },
  },

  structuredOutputPresets: {
    getAll: (): StructuredOutputPreset[] => getItem<StructuredOutputPreset[]>(STORAGE_KEYS.STRUCTURED_OUTPUT_PRESETS, []),
    save: (presets: StructuredOutputPreset[]): void => setItem(STORAGE_KEYS.STRUCTURED_OUTPUT_PRESETS, presets),
    get: (id: string): StructuredOutputPreset | null => {
      const all = storage.structuredOutputPresets.getAll();
      return all.find(p => p.id === id) || null;
    },
    upsert: (preset: StructuredOutputPreset): void => {
      const all = storage.structuredOutputPresets.getAll();
      const idx = all.findIndex(p => p.id === preset.id);
      if (idx >= 0) all[idx] = preset;
      else all.push(preset);
      storage.structuredOutputPresets.save(all);
    },
    delete: (id: string): void => {
      const all = storage.structuredOutputPresets.getAll().filter(p => p.id !== id);
      storage.structuredOutputPresets.save(all);
    },
    getActiveId: (): string | null => localStorage.getItem(STORAGE_KEYS.ACTIVE_STRUCTURED_OUTPUT_PRESET_ID),
    setActiveId: (id: string | null): void => {
      if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_STRUCTURED_OUTPUT_PRESET_ID, id);
      else localStorage.removeItem(STORAGE_KEYS.ACTIVE_STRUCTURED_OUTPUT_PRESET_ID);
    },
    getActive: (): StructuredOutputPreset | null => {
      const id = storage.structuredOutputPresets.getActiveId();
      if (!id) return null;
      return storage.structuredOutputPresets.get(id);
    },
  },

  settings: {
    get: (): AppSettings => getItem<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_APP_SETTINGS),
    save: (settings: AppSettings): void => setItem(STORAGE_KEYS.SETTINGS, settings),
    update: (partial: Partial<AppSettings>): AppSettings => {
      const current = storage.settings.get();
      const updated = { ...current, ...partial };
      storage.settings.save(updated);
      return updated;
    },
  },

  active: {
    getConnectionId: (): string | null => localStorage.getItem(STORAGE_KEYS.ACTIVE_CONNECTION_ID),
    setConnectionId: (id: string | null): void => {
      if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_CONNECTION_ID, id);
      else localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONNECTION_ID);
    },
    getPresetId: (): string | null => localStorage.getItem(STORAGE_KEYS.ACTIVE_PRESET_ID),
    setPresetId: (id: string | null): void => {
      if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_PRESET_ID, id);
      else localStorage.removeItem(STORAGE_KEYS.ACTIVE_PRESET_ID);
    },
  },

  quickStart: {
    isDismissed: (): boolean => localStorage.getItem('jt_quick_start_dismissed') === 'true',
    dismiss: (): void => { localStorage.setItem('jt_quick_start_dismissed', 'true'); },
    restore: (): void => { localStorage.removeItem('jt_quick_start_dismissed'); },
  },

  clearAll: (): void => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    localStorage.removeItem('jt_quick_start_dismissed');
  },

  exportAll: (): string => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      connections: storage.connections.getAll(),
      presets: storage.presets.getAll(),
      regexScripts: storage.regexScripts.getAll(),
      settings: storage.settings.get(),
      activeConnectionId: storage.active.getConnectionId(),
      activePresetId: storage.active.getPresetId(),
    };
    return JSON.stringify(data, null, 2);
  },

  importAll: (jsonStr: string): void => {
    const data = JSON.parse(jsonStr);
    if (data.connections) storage.connections.save(data.connections);
    if (data.presets) storage.presets.save(data.presets);
    if (data.regexScripts) storage.regexScripts.save(data.regexScripts);
    if (data.settings) storage.settings.save(data.settings);
    if (data.activeConnectionId) storage.active.setConnectionId(data.activeConnectionId);
    if (data.activePresetId) storage.active.setPresetId(data.activePresetId);
  },
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

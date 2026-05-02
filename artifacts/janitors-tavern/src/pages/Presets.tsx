import { useState, useCallback, useEffect, useRef } from 'react';
import { ScrollText, Plus, Pencil, Trash2, Upload, Download, ChevronDown, ChevronUp, Tag, FileText } from 'lucide-react';
import { storage, generateId } from '@/lib/storage';
import type { ChatCompletionPreset, STSamplerSettings, SamplerSettingKey } from '@/lib/types';
import { DEFAULT_SAMPLER_SETTINGS } from '@/lib/types';
import { cn } from '@/lib/utils';

function createEmptyPreset(): ChatCompletionPreset {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: '',
    description: '',
    tags: [],
    sampler: { ...DEFAULT_SAMPLER_SETTINGS },
    samplerEnabled: {},
    promptBlocks: [],
    promptOrder: [],
    formatStrings: { worldInfo: '', scenario: '', personality: '' },
    assistantPrefill: '',
    assistantImpersonation: '',
    providerSettings: { claudeUseSysprompt: true, makersuiteUseSysprompt: true, squashSystemMessages: false, streamOpenai: true },
    mediaSettings: { imageInlining: false, inlineImageQuality: 'low', videoInlining: false },
    advancedSettings: {
      functionCalling: false, showThoughts: false, reasoningEffort: 'auto', enableWebSearch: false,
      requestImages: false, wrapInQuotes: false, namesBehavior: 0, sendIfEmpty: '',
      biasPresetSelected: 'None', maxContextUnlocked: false,
      startReplyWith: { enabled: false, content: '' },
    },
    createdAt: now,
    updatedAt: now,
  };
}

const SAMPLER_KEYS: SamplerSettingKey[] = ['temperature','top_p','top_k','min_p','frequency_penalty','presence_penalty','repetition_penalty','openai_max_tokens','seed'];
const SAMPLER_LABELS: Record<SamplerSettingKey, string> = {
  temperature: 'Temperature', top_p: 'Top P', top_k: 'Top K', min_p: 'Min P',
  frequency_penalty: 'Frequency Penalty', presence_penalty: 'Presence Penalty',
  repetition_penalty: 'Repetition Penalty', openai_max_tokens: 'Max Tokens', seed: 'Seed',
};
const SAMPLER_RANGES: Record<SamplerSettingKey, { min: number; max: number; step: number }> = {
  temperature: { min: 0, max: 2, step: 0.01 }, top_p: { min: 0, max: 1, step: 0.01 },
  top_k: { min: 0, max: 200, step: 1 }, min_p: { min: 0, max: 1, step: 0.01 },
  frequency_penalty: { min: -2, max: 2, step: 0.01 }, presence_penalty: { min: -2, max: 2, step: 0.01 },
  repetition_penalty: { min: 0, max: 2, step: 0.01 }, openai_max_tokens: { min: 64, max: 32768, step: 64 },
  seed: { min: -1, max: 2147483647, step: 1 },
};

function SamplerSlider({ name, value, enabled, onChange, onToggleEnabled }: {
  name: SamplerSettingKey; value: number; enabled: boolean;
  onChange: (k: SamplerSettingKey, v: number) => void;
  onToggleEnabled: (k: SamplerSettingKey, v: boolean) => void;
}) {
  const { min, max, step } = SAMPLER_RANGES[name];
  return (
    <div className={cn('p-3 rounded-lg border transition-colors', enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20')}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={e => onToggleEnabled(name, e.target.checked)} className="accent-primary" id={`sampler-${name}`} />
          <label htmlFor={`sampler-${name}`} className={cn('text-xs font-medium', enabled ? 'text-foreground' : 'text-muted-foreground')}>{SAMPLER_LABELS[name]}</label>
        </div>
        <input
          type="number" value={value} step={step} min={min} max={max}
          onChange={e => onChange(name, parseFloat(e.target.value) || 0)}
          disabled={!enabled}
          className="w-20 px-2 py-1 rounded bg-input border border-border text-foreground text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
        />
      </div>
      <input
        type="range" value={value} step={step} min={min} max={max}
        onChange={e => onChange(name, parseFloat(e.target.value))}
        disabled={!enabled}
        className="w-full h-1.5 rounded-full accent-primary disabled:opacity-40"
      />
    </div>
  );
}

function PromptBlockList({ blocks, onChange }: {
  blocks: ChatCompletionPreset['promptBlocks'];
  onChange: (blocks: ChatCompletionPreset['promptBlocks']) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {blocks.length === 0 && (
        <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
          No prompt blocks. Import a SillyTavern preset to populate them.
        </div>
      )}
      {blocks.map((block, i) => (
        <div key={block.identifier} className="border border-border rounded-lg overflow-hidden">
          <div
            className="flex items-center gap-3 px-3 py-2 bg-muted/20 hover:bg-muted/30 cursor-pointer text-sm"
            onClick={() => setExpandedId(expandedId === block.identifier ? null : block.identifier)}
          >
            <span className={cn('w-2 h-2 rounded-full shrink-0', block.role === 'system' ? 'bg-blue-400' : block.role === 'user' ? 'bg-green-400' : 'bg-amber-400')} />
            <span className="flex-1 font-medium truncate">{block.name || block.identifier}</span>
            <span className="text-xs text-muted-foreground capitalize">{block.role}</span>
            {expandedId === block.identifier ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
          {expandedId === block.identifier && (
            <div className="p-3 bg-muted/10">
              <textarea
                className="w-full px-2.5 py-2 rounded bg-input border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={6} value={block.content}
                onChange={e => { const newBlocks = [...blocks]; newBlocks[i] = { ...block, content: e.target.value }; onChange(newBlocks); }}
              />
              <div className="flex gap-2 mt-2">
                <select className="px-2 py-1 rounded bg-input border border-border text-foreground text-xs focus:outline-none"
                  value={block.role} onChange={e => { const nb = [...blocks]; nb[i] = { ...block, role: e.target.value as 'system' | 'user' | 'assistant' }; onChange(nb); }}>
                  <option value="system">system</option>
                  <option value="user">user</option>
                  <option value="assistant">assistant</option>
                </select>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PresetForm({ preset, onSave, onCancel }: {
  preset: ChatCompletionPreset;
  onSave: (p: ChatCompletionPreset) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ChatCompletionPreset>(preset);
  const [tab, setTab] = useState<'sampler'|'prompts'|'advanced'>('sampler');
  const [tagInput, setTagInput] = useState('');

  const set = (update: Partial<ChatCompletionPreset>) =>
    setForm(f => ({ ...f, ...update, updatedAt: new Date().toISOString() }));

  const setSampler = (key: SamplerSettingKey, value: number) =>
    setForm(f => ({ ...f, sampler: { ...f.sampler, [key]: value } }));

  const toggleSamplerEnabled = (key: SamplerSettingKey, enabled: boolean) =>
    setForm(f => ({ ...f, samplerEnabled: { ...f.samplerEnabled, [key]: enabled } }));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || form.tags.includes(t)) return;
    set({ tags: [...form.tags, t] });
    setTagInput('');
  };

  const isValid = form.name.trim();

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="p-5 space-y-4 border-b border-border">
        <h2 className="text-lg font-semibold">{preset.name ? `Edit: ${preset.name}` : 'New Preset'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <input className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.name} onChange={e => set({ name: e.target.value })} placeholder="My Preset" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <input className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.description || ''} onChange={e => set({ description: e.target.value })} placeholder="Optional description" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs border border-accent-border">
                {tag}
                <button onClick={() => set({ tags: form.tags.filter(t => t !== tag) })} className="text-accent-foreground/60 hover:text-accent-foreground ml-0.5">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 px-2.5 py-1.5 rounded bg-input border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Add tag..." />
            <button onClick={addTag} className="px-3 py-1.5 rounded bg-secondary text-secondary-foreground text-xs border border-secondary-border">Add</button>
          </div>
        </div>
      </div>

      <div className="flex border-b border-border">
        {(['sampler','prompts','advanced'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('flex-1 py-2.5 text-xs font-medium capitalize transition-colors',
            tab === t ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground')}>
            {t === 'sampler' ? 'Sampler' : t === 'prompts' ? 'Prompt Blocks' : 'Advanced'}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'sampler' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SAMPLER_KEYS.map(key => (
              <SamplerSlider
                key={key} name={key}
                value={form.sampler[key] as number}
                enabled={form.samplerEnabled?.[key] ?? false}
                onChange={setSampler}
                onToggleEnabled={toggleSamplerEnabled}
              />
            ))}
          </div>
        )}

        {tab === 'prompts' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Edit prompt blocks content. Import a SillyTavern preset JSON to populate the full structure.</p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Assistant Prefill</label>
              <input className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.assistantPrefill} onChange={e => set({ assistantPrefill: e.target.value })}
                placeholder="Prefill the assistant's first message..." />
            </div>
            <PromptBlockList blocks={form.promptBlocks} onChange={blocks => set({ promptBlocks: blocks })} />
          </div>
        )}

        {tab === 'advanced' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Start Reply With</label>
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id="startReplyEnabled" checked={form.advancedSettings.startReplyWith.enabled}
                  onChange={e => set({ advancedSettings: { ...form.advancedSettings, startReplyWith: { ...form.advancedSettings.startReplyWith, enabled: e.target.checked } } })}
                  className="accent-primary" />
                <label htmlFor="startReplyEnabled" className="text-xs text-muted-foreground">Enable start reply with</label>
              </div>
              {form.advancedSettings.startReplyWith.enabled && (
                <input className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.advancedSettings.startReplyWith.content}
                  onChange={e => set({ advancedSettings: { ...form.advancedSettings, startReplyWith: { ...form.advancedSettings.startReplyWith, content: e.target.value } } })}
                  placeholder="*" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['claudeUseSysprompt', 'Claude Use Sysprompt'],
                ['squashSystemMessages', 'Squash System Messages'],
                ['streamOpenai', 'Stream (OpenAI)'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <input type="checkbox" id={`adv-${key}`}
                    checked={form.providerSettings[key as keyof typeof form.providerSettings] as boolean}
                    onChange={e => set({ providerSettings: { ...form.providerSettings, [key]: e.target.checked } })}
                    className="accent-primary" />
                  <label htmlFor={`adv-${key}`} className="text-xs text-muted-foreground">{label}</label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 px-5 py-4 border-t border-border">
        <div className="flex-1" />
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        <button onClick={() => onSave(form)} disabled={!isValid}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40">
          Save Preset
        </button>
      </div>
    </div>
  );
}

function importSillyTavernPreset(jsonStr: string, existingId?: string): ChatCompletionPreset | null {
  try {
    const data = JSON.parse(jsonStr);
    const now = new Date().toISOString();
    const id = existingId || generateId();

    const promptBlocks: ChatCompletionPreset['promptBlocks'] = [];
    if (data.prompts && Array.isArray(data.prompts)) {
      for (const p of data.prompts) {
        promptBlocks.push({
          identifier: p.identifier || generateId(),
          name: p.name || p.identifier || 'Unnamed',
          role: p.role || 'system',
          content: p.content || '',
          system_prompt: p.system_prompt ?? false,
          marker: p.marker ?? false,
          injection_position: p.injection_position ?? 0,
          injection_depth: p.injection_depth ?? 0,
          injection_order: p.injection_order,
          forbid_overrides: p.forbid_overrides ?? false,
        });
      }
    }

    const promptOrder: ChatCompletionPreset['promptOrder'] = [];
    if (data.prompt_order && Array.isArray(data.prompt_order)) {
      for (const o of data.prompt_order) {
        promptOrder.push({
          character_id: o.character_id || 100001,
          order: Array.isArray(o.order) ? o.order : [],
        });
      }
    }

    return {
      id,
      name: data.name || 'Imported Preset',
      description: data.description || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      sampler: {
        temperature: data.temperature ?? DEFAULT_SAMPLER_SETTINGS.temperature,
        top_p: data.top_p ?? DEFAULT_SAMPLER_SETTINGS.top_p,
        top_k: data.top_k ?? DEFAULT_SAMPLER_SETTINGS.top_k,
        min_p: data.min_p ?? DEFAULT_SAMPLER_SETTINGS.min_p,
        frequency_penalty: data.frequency_penalty ?? DEFAULT_SAMPLER_SETTINGS.frequency_penalty,
        presence_penalty: data.presence_penalty ?? DEFAULT_SAMPLER_SETTINGS.presence_penalty,
        repetition_penalty: data.repetition_penalty ?? DEFAULT_SAMPLER_SETTINGS.repetition_penalty,
        openai_max_context: data.openai_max_context ?? DEFAULT_SAMPLER_SETTINGS.openai_max_context,
        openai_max_tokens: data.openai_max_tokens ?? DEFAULT_SAMPLER_SETTINGS.openai_max_tokens,
        seed: data.seed ?? DEFAULT_SAMPLER_SETTINGS.seed,
        n: data.n ?? DEFAULT_SAMPLER_SETTINGS.n,
      },
      samplerEnabled: data.samplerEnabled || {},
      promptBlocks,
      promptOrder,
      formatStrings: {
        worldInfo: data.world_info_format || '',
        scenario: data.scenario_format || '',
        personality: data.personality_format || '',
      },
      assistantPrefill: data.assistant_prefill || '',
      assistantImpersonation: data.assistant_impersonation || '',
      providerSettings: {
        claudeUseSysprompt: data.claude_use_sysprompt ?? true,
        makersuiteUseSysprompt: data.makersuite_use_sysprompt ?? true,
        squashSystemMessages: data.squash_system_messages ?? false,
        streamOpenai: data.stream_openai ?? true,
      },
      mediaSettings: { imageInlining: false, inlineImageQuality: 'low', videoInlining: false },
      advancedSettings: {
        functionCalling: data.function_calling ?? false,
        showThoughts: data.show_thoughts ?? false,
        reasoningEffort: data.reasoning_effort || 'auto',
        enableWebSearch: data.enable_web_search ?? false,
        requestImages: data.request_images ?? false,
        wrapInQuotes: data.wrap_in_quotes ?? false,
        namesBehavior: data.names_behavior ?? 0,
        sendIfEmpty: data.send_if_empty || '',
        biasPresetSelected: data.bias_preset_selected || 'None',
        maxContextUnlocked: data.max_context_unlocked ?? false,
        startReplyWith: {
          enabled: !!data.start_reply_with?.enabled,
          content: data.start_reply_with?.content || '',
        },
      },
      sourceFileName: data.name,
      createdAt: now,
      updatedAt: now,
    };
  } catch {
    return null;
  }
}

export default function Presets() {
  const [presets, setPresets] = useState<ChatCompletionPreset[]>([]);
  const [editing, setEditing] = useState<ChatCompletionPreset | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [activeId] = useState(() => storage.active.getPresetId());
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => setPresets(storage.presets.getAll()), []);
  useEffect(() => { load(); }, [load]);

  const handleSave = (preset: ChatCompletionPreset) => {
    storage.presets.upsert(preset);
    load();
    setEditing(null);
    setShowNew(false);
  };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      storage.presets.delete(id);
      if (storage.active.getPresetId() === id) storage.active.setPresetId(null);
      load();
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleExport = (preset: ChatCompletionPreset) => {
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${preset.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const imported = importSillyTavernPreset(text);
      if (imported) {
        storage.presets.upsert(imported);
        load();
        setImportError(null);
      } else {
        setImportError('Failed to parse preset file. Make sure it is a valid SillyTavern preset JSON.');
        setTimeout(() => setImportError(null), 5000);
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Presets</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage Chat Completion presets. Import SillyTavern presets or create your own.</p>
        </div>
        {!showNew && !editing && (
          <div className="flex gap-2 shrink-0">
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-secondary-border text-sm font-medium transition-colors">
              <Upload size={14} /> Import
            </button>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              <Plus size={14} /> New
            </button>
          </div>
        )}
      </div>

      {importError && (
        <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{importError}</div>
      )}

      {showNew && (
        <PresetForm preset={createEmptyPreset()} onSave={handleSave} onCancel={() => setShowNew(false)} />
      )}

      {presets.length === 0 && !showNew ? (
        <div className="text-center py-16 bg-card border border-card-border rounded-xl">
          <ScrollText size={32} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">No presets yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Import a SillyTavern preset or create a new one.</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={() => fileRef.current?.click()} className="text-primary text-sm hover:underline flex items-center gap-1"><Upload size={13} /> Import</button>
            <span className="text-muted-foreground">or</span>
            <button onClick={() => setShowNew(true)} className="text-primary text-sm hover:underline flex items-center gap-1"><Plus size={13} /> Create</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {presets.map(preset => (
            editing?.id === preset.id ? (
              <PresetForm key={preset.id} preset={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
            ) : (
              <div key={preset.id} className={cn('bg-card border rounded-xl p-4 transition-all', preset.id === activeId ? 'border-primary/40' : 'border-card-border')}>
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0', preset.id === activeId ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground')}>
                    <ScrollText size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{preset.name}</h3>
                      {preset.id === activeId && <span className="text-xs bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full">Active</span>}
                    </div>
                    {preset.description && <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{preset.promptBlocks.length} blocks</span>
                      {preset.tags.map(tag => (
                        <span key={tag} className="text-xs bg-accent/50 text-accent-foreground border border-accent-border px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Tag size={9} />{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleExport(preset)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Export">
                      <Download size={14} />
                    </button>
                    <button onClick={() => setEditing(preset)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(preset.id)}
                      className={cn('p-2 rounded-lg transition-colors', deleteConfirm === preset.id ? 'bg-destructive/20 text-destructive' : 'hover:bg-secondary text-muted-foreground hover:text-destructive')}
                      title={deleteConfirm === preset.id ? 'Click again to confirm' : 'Delete'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

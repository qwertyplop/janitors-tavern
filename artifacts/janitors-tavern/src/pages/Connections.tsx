import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Plus, Plug, Pencil, Trash2, CheckCircle2, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Eye, EyeOff, X, Loader2, RotateCcw,
  Search, Check, ChevronRight, Cpu
} from 'lucide-react';
import { storage, generateId } from '@/lib/storage';
import { api } from '@/lib/api';
import type { ConnectionPreset, ApiKey, PromptPostProcessingMode } from '@/lib/types';
import { POST_PROCESSING_LABELS, POST_PROCESSING_TIPS } from '@/lib/types';
import { cn } from '@/lib/utils';

const POST_PROCESSING_MODES: PromptPostProcessingMode[] = [
  'none','merge','merge-tools','semi-strict','semi-strict-tools',
  'strict','strict-tools','single-user','anthropic','anthropic-merge-consecutives'
];

function emptyConnection(): ConnectionPreset {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: '',
    providerType: 'openai-compatible',
    baseUrl: '',
    apiKeyRef: 'local',
    apiKeys: [],
    selectedKeyId: undefined,
    model: '',
    promptPostProcessing: 'none',
    bypassStatusCheck: false,
    createdAt: now,
    updatedAt: now,
  };
}

function ApiKeyRow({ apiKey, onDelete, onSelect, isSelected, showValue, roundRobinEnabled, usageCount, isLastUsed }: {
  apiKey: ApiKey;
  onDelete: () => void;
  onSelect: () => void;
  isSelected: boolean;
  showValue: boolean;
  roundRobinEnabled?: boolean;
  usageCount?: number;
  isLastUsed?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2 p-2.5 rounded-lg border text-sm', isSelected && !roundRobinEnabled ? 'border-primary/40 bg-primary/5' : 'border-border')}>
      {!roundRobinEnabled && (
        <button onClick={onSelect} className={cn('w-4 h-4 rounded-full border-2 shrink-0 transition-colors', isSelected ? 'border-primary bg-primary' : 'border-muted-foreground hover:border-primary')}>
          {isSelected && <div className="w-full h-full rounded-full bg-primary-foreground scale-50" />}
        </button>
      )}
      {roundRobinEnabled && (
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          <RotateCcw size={12} className="text-primary opacity-60" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{apiKey.name || 'Unnamed key'}</span>
          {isLastUsed && <span className="text-xs bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full shrink-0">last used</span>}
        </div>
        <div className="text-xs text-muted-foreground font-mono truncate">
          {showValue ? apiKey.value : `${apiKey.value.slice(0, 4)}${'•'.repeat(Math.min(20, apiKey.value.length - 4))}${apiKey.value.slice(-4)}`}
          {usageCount !== undefined && usageCount > 0 && <span className="ml-2 not-mono">{usageCount} use{usageCount !== 1 ? 's' : ''}</span>}
        </div>
      </div>
      <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

const MODEL_GROUPS: Record<string, string> = {
  'gpt': 'OpenAI GPT', 'o1': 'OpenAI Reasoning', 'o3': 'OpenAI Reasoning', 'o4': 'OpenAI Reasoning',
  'claude': 'Anthropic Claude', 'gemini': 'Google Gemini', 'gemma': 'Google Gemma',
  'llama': 'Meta LLaMA', 'mistral': 'Mistral', 'mixtral': 'Mistral',
  'deepseek': 'DeepSeek', 'qwen': 'Qwen', 'phi': 'Microsoft Phi',
  'command': 'Cohere Command', 'nova': 'Amazon Nova',
};

function getModelGroup(modelId: string): string {
  const lower = modelId.toLowerCase();
  for (const [prefix, label] of Object.entries(MODEL_GROUPS)) {
    if (lower.startsWith(prefix)) return label;
  }
  return 'Other';
}

function ModelPickerModal({ currentModel, baseUrl, apiKeys, selectedKeyId, onSelect, onClose }: {
  currentModel: string;
  baseUrl: string;
  apiKeys: ApiKey[];
  selectedKeyId?: string;
  onSelect: (model: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [manualModel, setManualModel] = useState(currentModel);
  const [selected, setSelected] = useState(currentModel);
  const [models, setModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    if (baseUrl && apiKeys.length > 0) fetchModels();
  }, []);

  const fetchModels = async () => {
    setFetching(true);
    setFetchError(null);
    const key = apiKeys.find(k => k.id === selectedKeyId) || apiKeys[0];
    try {
      const result = await api.proxy.getModels({ baseUrl, apiKey: key?.value || '' });
      const list = ((result.data?.map((m: { id: string }) => m.id)) || result.models || []) as string[];
      setModels(list.sort());
      setFetched(true);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch models');
    } finally {
      setFetching(false);
    }
  };

  const filtered = models.filter(m => m.toLowerCase().includes(search.toLowerCase().trim()));

  const grouped: Record<string, string[]> = {};
  for (const m of filtered) {
    const g = getModelGroup(m);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(m);
  }
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  const confirm = () => {
    const val = (selected || manualModel).trim();
    if (val) { onSelect(val); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Cpu size={15} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground">Select Model</h2>
            <p className="text-xs text-muted-foreground">Choose from available models or enter a custom name</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Search + Refresh bar */}
        <div className="px-6 py-3 border-b border-border flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={fetchModels}
            disabled={fetching || !baseUrl || apiKeys.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground border border-border text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-40 shrink-0"
          >
            {fetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {fetching ? 'Loading…' : fetched ? 'Refresh' : 'Fetch'}
          </button>
        </div>

        {/* Custom name input */}
        <div className="px-6 py-3 border-b border-border shrink-0">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Custom / override</label>
          <input
            value={manualModel}
            onChange={e => { setManualModel(e.target.value); setSelected(e.target.value); }}
            onKeyDown={e => { if (e.key === 'Enter') confirm(); }}
            placeholder="Type any model name, e.g. gpt-4o or claude-3-5-sonnet-20241022"
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Model list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {fetchError && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{fetchError}</span>
            </div>
          )}

          {fetching && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Fetching available models…</p>
            </div>
          )}

          {!fetching && !fetched && !fetchError && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <Cpu size={28} className="text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No models loaded yet</p>
              <p className="text-xs text-muted-foreground/70">Click Fetch to load models from the provider</p>
            </div>
          )}

          {!fetching && fetched && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Search size={24} className="text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No models match "{search}"</p>
            </div>
          )}

          {!fetching && sortedGroups.map(([group, groupModels]) => (
            <div key={group} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{group}</span>
                <span className="text-[10px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded-full">{groupModels.length}</span>
              </div>
              <div className="space-y-0.5">
                {groupModels.map(m => {
                  const isSelected = selected === m;
                  return (
                    <button
                      key={m}
                      onClick={() => { setSelected(m); setManualModel(m); }}
                      onDoubleClick={confirm}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                        isSelected
                          ? 'bg-primary/12 border border-primary/35 text-primary'
                          : 'hover:bg-secondary/60 text-foreground border border-transparent hover:border-border/40'
                      )}
                    >
                      <div className={cn('w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors', isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40')}>
                        {isSelected && <Check size={9} className="text-primary-foreground" />}
                      </div>
                      <span className="flex-1 font-mono text-xs">{m}</span>
                      {isSelected && <ChevronRight size={13} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <span className="text-xs text-muted-foreground">
            {fetched && models.length > 0
              ? `${filtered.length} of ${models.length} model${models.length !== 1 ? 's' : ''}`
              : 'Double-click a model to confirm'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={!(selected || manualModel).trim()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Use Model
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionForm({ preset, onSave, onCancel, onTest, keyStats }: {
  preset: ConnectionPreset;
  onSave: (p: ConnectionPreset) => void;
  onCancel: () => void;
  onTest: (p: ConnectionPreset) => Promise<void>;
  keyStats?: Array<{ keyId: string; name: string; usageCount: number; isLastUsed: boolean }>;
}) {
  const [form, setForm] = useState<ConnectionPreset>(preset);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [includeBodyText, setIncludeBodyText] = useState(preset.includeBodyParams ?? '');
  const [excludeBodyText, setExcludeBodyText] = useState(preset.excludeBodyParams ?? '');

  const set = (update: Partial<ConnectionPreset>) => {
    setForm(f => ({ ...f, ...update, updatedAt: new Date().toISOString() }));
  };

  const addKey = () => {
    if (!newKeyValue.trim()) return;
    const key: ApiKey = {
      id: generateId(),
      name: newKeyName || `Key ${form.apiKeys.length + 1}`,
      value: newKeyValue.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newKeys = [...form.apiKeys, key];
    setForm(f => ({ ...f, apiKeys: newKeys, selectedKeyId: f.selectedKeyId || key.id }));
    setNewKeyName('');
    setNewKeyValue('');
  };

  const removeKey = (id: string) => {
    const newKeys = form.apiKeys.filter(k => k.id !== id);
    setForm(f => ({ ...f, apiKeys: newKeys, selectedKeyId: f.selectedKeyId === id ? (newKeys[0]?.id || undefined) : f.selectedKeyId }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const selectedKey = form.apiKeys.find(k => k.id === form.selectedKeyId) || form.apiKeys[0];
    try {
      const result = await api.proxy.testConnection({ baseUrl: form.baseUrl, apiKey: selectedKey?.value || '', model: form.model });
      setTestResult(result);
      if (result.success) set({ lastTestedAt: new Date().toISOString() });
    } catch (e) {
      setTestResult({ success: false, message: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const addHeader = () => {
    if (!newHeaderKey.trim()) return;
    set({ extraHeaders: { ...form.extraHeaders, [newHeaderKey.trim()]: newHeaderValue } });
    setNewHeaderKey('');
    setNewHeaderValue('');
  };

  const removeHeader = (key: string) => {
    const h = { ...form.extraHeaders };
    delete h[key];
    set({ extraHeaders: h });
  };

  const isValid = form.name.trim() && form.baseUrl.trim() && form.model.trim() && form.apiKeys.length > 0;

  const handleSaveWithBody = () => {
    onSave({
      ...form,
      includeBodyParams: includeBodyText.trim() || undefined,
      excludeBodyParams: excludeBodyText.trim() || undefined,
    });
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 space-y-5">
      {showModelPicker && (
        <ModelPickerModal
          currentModel={form.model}
          baseUrl={form.baseUrl}
          apiKeys={form.apiKeys}
          selectedKeyId={form.selectedKeyId}
          onSelect={model => set({ model })}
          onClose={() => setShowModelPicker(false)}
        />
      )}
      <h2 className="text-lg font-semibold text-foreground">{preset.name ? `Edit: ${preset.name}` : 'New Connection'}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Connection Name *</label>
          <input
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.name} onChange={e => set({ name: e.target.value })}
            placeholder="My OpenAI Connection"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Provider Base URL *</label>
          <input
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            value={form.baseUrl} onChange={e => set({ baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">API Keys</label>
          <div className="flex items-center gap-3">
            {form.apiKeys.length > 1 && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                <input
                  type="checkbox"
                  checked={!!form.roundRobinEnabled}
                  onChange={e => set({ roundRobinEnabled: e.target.checked })}
                  className="accent-primary"
                />
                <RotateCcw size={11} />
                Round-robin rotation
              </label>
            )}
            <button onClick={() => setShowKeys(!showKeys)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {showKeys ? <EyeOff size={12} /> : <Eye size={12} />}
              {showKeys ? 'Hide values' : 'Show values'}
            </button>
          </div>
        </div>
        {form.roundRobinEnabled && form.apiKeys.length > 1 && (
          <p className="text-xs text-primary/80 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
            Keys will be used in rotation automatically. On a 429 rate-limit error, the next key is tried immediately.
          </p>
        )}
        <div className="space-y-2">
          {form.apiKeys.map(key => {
            const stat = keyStats?.find(s => s.keyId === key.id);
            return (
              <ApiKeyRow
                key={key.id}
                apiKey={key}
                onDelete={() => removeKey(key.id)}
                onSelect={() => set({ selectedKeyId: key.id })}
                isSelected={form.selectedKeyId === key.id}
                showValue={showKeys}
                roundRobinEnabled={!!(form.roundRobinEnabled && form.apiKeys.length > 1)}
                usageCount={stat?.usageCount}
                isLastUsed={stat?.isLastUsed}
              />
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            className="w-28 px-2.5 py-2 rounded-lg bg-input border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
            placeholder="Name"
          />
          <input
            className="flex-1 px-2.5 py-2 rounded-lg bg-input border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)}
            placeholder="sk-..."
            type="password"
          />
          <button
            onClick={addKey}
            disabled={!newKeyValue.trim()}
            className="px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-medium transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Model *</label>
          <button
            type="button"
            onClick={() => setShowModelPicker(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm hover:border-primary/50 transition-colors text-left group"
          >
            <Cpu size={13} className="text-muted-foreground shrink-0" />
            <span className={cn('flex-1 font-mono truncate', form.model ? 'text-foreground' : 'text-muted-foreground')}>
              {form.model || 'Select or type a model…'}
            </span>
            <ChevronRight size={13} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Post-processing Mode</label>
          <select
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.promptPostProcessing}
            onChange={e => set({ promptPostProcessing: e.target.value as PromptPostProcessingMode })}
          >
            {POST_PROCESSING_MODES.map(m => (
              <option key={m} value={m}>{POST_PROCESSING_LABELS[m]}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{POST_PROCESSING_TIPS[form.promptPostProcessing]}</p>
        </div>
      </div>

      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Advanced options
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-5 border-t border-border pt-4">

            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-foreground">Include Body Parameters</label>
                <p className="text-[11px] text-muted-foreground mt-0.5">Merged into the request body at highest priority, overriding preset values. One <code className="font-mono">key: value</code> per line.</p>
              </div>
              <textarea
                value={includeBodyText}
                onChange={e => setIncludeBodyText(e.target.value)}
                rows={4}
                placeholder={'top_k: 20\nrepetition_penalty: 1.1'}
                className="w-full px-2.5 py-2 rounded bg-input border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              />
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-foreground">Exclude Body Parameters</label>
                <p className="text-[11px] text-muted-foreground mt-0.5">Remove these keys from the request body before sending. One key per line (with or without a leading <code className="font-mono">-</code>).</p>
              </div>
              <textarea
                value={excludeBodyText}
                onChange={e => setExcludeBodyText(e.target.value)}
                rows={3}
                placeholder={'- frequency_penalty\n- presence_penalty'}
                className="w-full px-2.5 py-2 rounded bg-input border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              />
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-foreground">Include Request Headers</label>
                <p className="text-[11px] text-muted-foreground mt-0.5">Extra HTTP headers sent with every request.</p>
              </div>
              {Object.entries(form.extraHeaders || {}).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-muted-foreground px-2 py-1.5 bg-muted rounded">{k}:</span>
                  <span className="flex-1 px-2 py-1.5 bg-muted rounded truncate">{v}</span>
                  <button onClick={() => removeHeader(k)} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input className="w-36 px-2.5 py-1.5 rounded bg-input border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring" value={newHeaderKey} onChange={e => setNewHeaderKey(e.target.value)} placeholder="Header-Name" />
                <input className="flex-1 px-2.5 py-1.5 rounded bg-input border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring" value={newHeaderValue} onChange={e => setNewHeaderValue(e.target.value)} placeholder="Value" />
                <button onClick={addHeader} disabled={!newHeaderKey.trim()} className="px-2.5 py-1.5 rounded bg-secondary text-secondary-foreground text-xs border border-secondary-border disabled:opacity-40">Add</button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="bypassStatus" checked={form.bypassStatusCheck} onChange={e => set({ bypassStatusCheck: e.target.checked })} className="accent-primary" />
              <label htmlFor="bypassStatus" className="text-xs text-muted-foreground">Bypass status check</label>
            </div>
          </div>
        )}
      </div>

      {testResult && (
        <div className={cn('flex items-center gap-2 px-4 py-3 rounded-lg text-sm border', testResult.success ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' : 'bg-destructive/10 border-destructive/30 text-destructive')}>
          {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {testResult.message}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleTest}
          disabled={testing || !form.baseUrl || !form.model || form.apiKeys.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-secondary-border text-sm font-medium transition-colors disabled:opacity-40"
        >
          {testing ? <><Loader2 size={14} className="animate-spin" /> Testing...</> : <><RefreshCw size={14} /> Test</>}
        </button>
        <div className="flex-1" />
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        <button
          onClick={handleSaveWithBody}
          disabled={!isValid}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Save Connection
        </button>
      </div>
    </div>
  );
}

export default function Connections() {
  const [connections, setConnections] = useState<ConnectionPreset[]>([]);
  const [editing, setEditing] = useState<ConnectionPreset | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeId] = useState(() => storage.active.getConnectionId());
  const [keyStats, setKeyStats] = useState<Array<{ keyId: string; name: string; usageCount: number; isLastUsed: boolean }>>([]);

  const load = useCallback(() => setConnections(storage.connections.getAll()), []);
  useEffect(() => { load(); }, [load]);

  const fetchKeyStats = useCallback(async () => {
    try {
      const result = await api.keyStats.get();
      setKeyStats(result.keyStats);
    } catch {}
  }, []);

  useEffect(() => {
    fetchKeyStats();
    const interval = setInterval(fetchKeyStats, 5000);
    return () => clearInterval(interval);
  }, [fetchKeyStats]);

  const handleSave = (preset: ConnectionPreset) => {
    storage.connections.upsert(preset);
    load();
    setEditing(null);
    setShowNew(false);
  };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      storage.connections.delete(id);
      if (storage.active.getConnectionId() === id) storage.active.setConnectionId(null);
      load();
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const lastUsedKey = keyStats.find(s => s.isLastUsed);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Connections</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your AI provider connections and API keys.</p>
        </div>
        {!showNew && !editing && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> New Connection
          </button>
        )}
      </div>

      {showNew && (
        <ConnectionForm
          preset={emptyConnection()}
          onSave={handleSave}
          onCancel={() => setShowNew(false)}
          onTest={async () => {}}
        />
      )}

      {connections.length === 0 && !showNew ? (
        <div className="text-center py-16 bg-card border border-card-border rounded-xl">
          <Plug size={32} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">No connections yet.</p>
          <button onClick={() => setShowNew(true)} className="mt-3 text-primary text-sm hover:underline">
            Add your first connection
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map(conn => (
            editing?.id === conn.id ? (
              <ConnectionForm
                key={conn.id}
                preset={editing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
                onTest={async () => {}}
                keyStats={conn.id === activeId ? keyStats : undefined}
              />
            ) : (
              <div key={conn.id} className={cn('bg-card border rounded-xl p-4 transition-all', conn.id === activeId ? 'border-primary/40' : 'border-card-border')}>
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0', conn.id === activeId ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground')}>
                    <Plug size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{conn.name}</h3>
                      {conn.id === activeId && <span className="text-xs bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full">Active</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{conn.baseUrl}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span>{conn.model || 'No model'}</span>
                      <span>·</span>
                      <span>{conn.apiKeys.length} key{conn.apiKeys.length !== 1 ? 's' : ''}</span>
                      {conn.roundRobinEnabled && conn.apiKeys.length > 1 && (
                        <><span>·</span><span className="flex items-center gap-1 text-primary"><RotateCcw size={11} />Round-robin</span></>
                      )}
                      <span>·</span>
                      <span>{POST_PROCESSING_LABELS[conn.promptPostProcessing]}</span>
                      {conn.lastTestedAt && <><span>·</span><span className="text-green-600 dark:text-green-400">Tested</span></>}
                    </div>
                    {conn.id === activeId && lastUsedKey && (
                      <div className="mt-1.5 text-xs text-muted-foreground">
                        Last request used: <span className="text-foreground font-medium">{lastUsedKey.name}</span>
                        {lastUsedKey.usageCount > 0 && <span className="text-muted-foreground"> ({lastUsedKey.usageCount} use{lastUsedKey.usageCount !== 1 ? 's' : ''})</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditing(conn)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(conn.id)}
                      className={cn('p-2 rounded-lg transition-colors', deleteConfirm === conn.id ? 'bg-destructive/20 text-destructive' : 'hover:bg-secondary text-muted-foreground hover:text-destructive')}
                      title={deleteConfirm === conn.id ? 'Click again to confirm' : 'Delete'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-4 text-sm text-muted-foreground space-y-2">
        <h3 className="font-semibold text-foreground text-sm">Common Provider URLs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
          {[
            ['OpenAI', 'https://api.openai.com/v1'],
            ['Anthropic', 'https://api.anthropic.com'],
            ['OpenRouter', 'https://openrouter.ai/api/v1'],
            ['Together AI', 'https://api.together.xyz/v1'],
            ['Groq', 'https://api.groq.com/openai/v1'],
            ['Mistral', 'https://api.mistral.ai/v1'],
          ].map(([name, url]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">{name}:</span>
              <span className="text-foreground truncate">{url}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

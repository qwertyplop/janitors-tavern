import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Plug, Pencil, Trash2, CheckCircle2, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Eye, EyeOff, X, ExternalLink, Loader2
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

function ApiKeyRow({ apiKey, onDelete, onSelect, isSelected, showValue }: {
  apiKey: ApiKey;
  onDelete: () => void;
  onSelect: () => void;
  isSelected: boolean;
  showValue: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2 p-2.5 rounded-lg border text-sm', isSelected ? 'border-primary/40 bg-primary/5' : 'border-border')}>
      <button onClick={onSelect} className={cn('w-4 h-4 rounded-full border-2 shrink-0 transition-colors', isSelected ? 'border-primary bg-primary' : 'border-muted-foreground hover:border-primary')}>
        {isSelected && <div className="w-full h-full rounded-full bg-primary-foreground scale-50" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{apiKey.name || 'Unnamed key'}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">
          {showValue ? apiKey.value : `${apiKey.value.slice(0, 4)}${'•'.repeat(Math.min(20, apiKey.value.length - 4))}${apiKey.value.slice(-4)}`}
        </div>
      </div>
      <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

function ConnectionForm({ preset, onSave, onCancel, onTest }: {
  preset: ConnectionPreset;
  onSave: (p: ConnectionPreset) => void;
  onCancel: () => void;
  onTest: (p: ConnectionPreset) => Promise<void>;
}) {
  const [form, setForm] = useState<ConnectionPreset>(preset);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');

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

  const handleFetchModels = async () => {
    setFetchingModels(true);
    const selectedKey = form.apiKeys.find(k => k.id === form.selectedKeyId) || form.apiKeys[0];
    try {
      const result = await api.proxy.getModels({ baseUrl: form.baseUrl, apiKey: selectedKey?.value || '' });
      const models = result.data?.map(m => m.id) || result.models || [];
      setAvailableModels(models as string[]);
    } catch (e) {
      setAvailableModels([]);
    } finally {
      setFetchingModels(false);
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

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 space-y-5">
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
          <button onClick={() => setShowKeys(!showKeys)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            {showKeys ? <EyeOff size={12} /> : <Eye size={12} />}
            {showKeys ? 'Hide values' : 'Show values'}
          </button>
        </div>
        <div className="space-y-2">
          {form.apiKeys.map(key => (
            <ApiKeyRow
              key={key.id}
              apiKey={key}
              onDelete={() => removeKey(key.id)}
              onSelect={() => set({ selectedKeyId: key.id })}
              isSelected={form.selectedKeyId === key.id}
              showValue={showKeys}
            />
          ))}
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
          <div className="flex gap-2">
            {availableModels.length > 0 ? (
              <select
                className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.model} onChange={e => set({ model: e.target.value })}
              >
                <option value="">Select model...</option>
                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input
                className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                value={form.model} onChange={e => set({ model: e.target.value })}
                placeholder="gpt-4o"
              />
            )}
            <button
              onClick={handleFetchModels}
              disabled={!form.baseUrl || form.apiKeys.length === 0 || fetchingModels}
              className="px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-secondary-border text-xs font-medium transition-colors disabled:opacity-40 shrink-0"
              title="Fetch available models"
            >
              {fetchingModels ? <Loader2 size={13} className="animate-spin" /> : 'Fetch'}
            </button>
          </div>
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
          <div className="mt-3 space-y-4 border-t border-border pt-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Extra Headers</label>
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
          onClick={() => onSave(form)}
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

  const load = useCallback(() => setConnections(storage.connections.getAll()), []);
  useEffect(() => { load(); }, [load]);

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
              <ConnectionForm key={conn.id} preset={editing} onSave={handleSave} onCancel={() => setEditing(null)} onTest={async () => {}} />
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
                      <span>·</span>
                      <span>{POST_PROCESSING_LABELS[conn.promptPostProcessing]}</span>
                      {conn.lastTestedAt && <><span>·</span><span className="text-green-600 dark:text-green-400">Tested</span></>}
                    </div>
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

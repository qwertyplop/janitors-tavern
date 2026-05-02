import { useState, useCallback, useEffect, useRef } from 'react';
import { Code2, Plus, Pencil, Trash2, Upload, Download, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react';
import { storage, generateId } from '@/lib/storage';
import type { RegexScript } from '@/lib/types';
import { cn } from '@/lib/utils';

const PLACEMENT_LABELS: Record<number, string> = {
  0: 'User input',
  1: 'AI output',
  2: 'Slash commands',
  3: 'World info',
};

function emptyScript(): RegexScript {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    scriptName: '',
    findRegex: '',
    replaceString: '',
    trimStrings: [],
    placement: [0, 1],
    roles: ['assistant', 'user'],
    disabled: false,
    markdownOnly: false,
    runOnEdit: false,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function ScriptForm({ script, onSave, onCancel }: {
  script: RegexScript;
  onSave: (s: RegexScript) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<RegexScript>(script);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [trimInput, setTrimInput] = useState('');
  const [previewInput, setPreviewInput] = useState('');
  const [previewOutput, setPreviewOutput] = useState<string | null>(null);

  const set = (update: Partial<RegexScript>) =>
    setForm(f => ({ ...f, ...update, updatedAt: new Date().toISOString() }));

  const validateRegex = (regex: string) => {
    if (!regex) { setRegexError(null); return; }
    try {
      const parsed = regex.startsWith('/') && regex.lastIndexOf('/') > 0
        ? (() => { const li = regex.lastIndexOf('/'); return { pattern: regex.slice(1, li), flags: regex.slice(li + 1) }; })()
        : { pattern: regex, flags: '' };
      new RegExp(parsed.pattern, parsed.flags);
      setRegexError(null);
    } catch (e) {
      setRegexError(e instanceof Error ? e.message : 'Invalid regex');
    }
  };

  const handlePreview = () => {
    if (!previewInput || !form.findRegex) { setPreviewOutput(null); return; }
    try {
      const parsed = form.findRegex.startsWith('/') && form.findRegex.lastIndexOf('/') > 0
        ? (() => { const li = form.findRegex.lastIndexOf('/'); return { pattern: form.findRegex.slice(1, li), flags: form.findRegex.slice(li + 1) }; })()
        : { pattern: form.findRegex, flags: '' };
      const rx = new RegExp(parsed.pattern, parsed.flags);
      const result = previewInput.replace(rx, (match, ...groups) => {
        let r = form.replaceString.replace(/\{\{match\}\}/g, match);
        for (let i = 0; i < groups.length; i++) r = r.replace(new RegExp(`\\$${i + 1}`, 'g'), String(groups[i] || ''));
        return r;
      });
      setPreviewOutput(result);
    } catch (e) {
      setPreviewOutput(`Error: ${e instanceof Error ? e.message : 'Invalid regex'}`);
    }
  };

  const togglePlacement = (p: number) => {
    const current = form.placement;
    const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p];
    set({ placement: next });
  };

  const toggleRole = (role: 'assistant' | 'user' | 'system') => {
    const current = form.roles || [];
    const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role];
    set({ roles: next });
  };

  const addTrim = () => {
    if (!trimInput.trim()) return;
    set({ trimStrings: [...form.trimStrings, trimInput.trim()] });
    setTrimInput('');
  };

  const isValid = form.scriptName.trim() && form.findRegex.trim() && !regexError;

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 space-y-5">
      <h2 className="text-lg font-semibold">{script.scriptName ? `Edit: ${script.scriptName}` : 'New Regex Script'}</h2>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Script Name *</label>
        <input className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={form.scriptName} onChange={e => set({ scriptName: e.target.value })} placeholder="My Regex Script" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Find (Regex) *</label>
          <input
            className={cn('w-full px-3 py-2 rounded-lg bg-input border text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring', regexError ? 'border-destructive' : 'border-border')}
            value={form.findRegex}
            onChange={e => { set({ findRegex: e.target.value }); validateRegex(e.target.value); }}
            placeholder="/pattern/flags or plain text"
          />
          {regexError && <p className="text-xs text-destructive">{regexError}</p>}
          <p className="text-xs text-muted-foreground">Use /pattern/flags syntax or plain text. Use {'{{match}}'} in replace.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Replace With</label>
          <input className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.replaceString} onChange={e => set({ replaceString: e.target.value })}
            placeholder="Replacement text. {{match}} = matched text" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Apply to Messages</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PLACEMENT_LABELS).slice(0, 2).map(([p, label]) => {
              const num = parseInt(p);
              return (
                <button key={p} onClick={() => togglePlacement(num)}
                  className={cn('px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors', form.placement.includes(num) ? 'bg-primary/15 text-primary border-primary/40' : 'bg-muted/30 text-muted-foreground border-border hover:border-border/60')}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Apply to Roles</label>
          <div className="flex flex-wrap gap-2">
            {(['user', 'assistant', 'system'] as const).map(role => (
              <button key={role} onClick={() => toggleRole(role)}
                className={cn('px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize', (form.roles || []).includes(role) ? 'bg-primary/15 text-primary border-primary/40' : 'bg-muted/30 text-muted-foreground border-border hover:border-border/60')}>
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Min Depth</label>
          <input type="number" className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.minDepth ?? ''} onChange={e => set({ minDepth: e.target.value === '' ? null : parseInt(e.target.value) })} placeholder="null" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Max Depth</label>
          <input type="number" className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.maxDepth ?? ''} onChange={e => set({ maxDepth: e.target.value === '' ? null : parseInt(e.target.value) })} placeholder="null" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Order</label>
          <input type="number" className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.order} onChange={e => set({ order: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Substitute Mode</label>
          <select className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none"
            value={form.substituteRegex} onChange={e => set({ substituteRegex: parseInt(e.target.value) as 0|1|2 })}>
            <option value={0}>None</option>
            <option value={1}>Substitute</option>
            <option value={2}>Escape</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Trim Strings (applied to match before replace)</label>
        <div className="flex flex-wrap gap-1.5">
          {form.trimStrings.map((s, i) => (
            <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-mono border border-border">
              {s}<button onClick={() => set({ trimStrings: form.trimStrings.filter((_, j) => j !== i) })} className="ml-1 hover:text-destructive">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="flex-1 px-2.5 py-1.5 rounded bg-input border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            value={trimInput} onChange={e => setTrimInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTrim()} placeholder="String to trim from match..." />
          <button onClick={addTrim} disabled={!trimInput.trim()} className="px-3 py-1.5 rounded bg-secondary text-secondary-foreground text-xs border border-secondary-border disabled:opacity-40">Add</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {[
          ['markdownOnly', 'Markdown only'],
          ['runOnEdit', 'Run on edit'],
          ['disabled', 'Disabled'],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <input type="checkbox" id={key} checked={form[key as keyof RegexScript] as boolean}
              onChange={e => set({ [key]: e.target.checked })} className="accent-primary" />
            <label htmlFor={key} className="text-xs text-muted-foreground">{label}</label>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-4 space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Preview</label>
        <div className="flex gap-2">
          <input className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            value={previewInput} onChange={e => setPreviewInput(e.target.value)} placeholder="Enter sample text to test..." />
          <button onClick={handlePreview} disabled={!previewInput || !form.findRegex || !!regexError}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm border border-secondary-border disabled:opacity-40">
            Test
          </button>
        </div>
        {previewOutput !== null && (
          <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm font-mono text-foreground">
            {previewOutput}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <div className="flex-1" />
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        <button onClick={() => onSave(form)} disabled={!isValid}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40">
          Save Script
        </button>
      </div>
    </div>
  );
}

export default function Extensions() {
  const [scripts, setScripts] = useState<RegexScript[]>([]);
  const [editing, setEditing] = useState<RegexScript | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => setScripts(storage.regexScripts.getAll()), []);
  useEffect(() => { load(); }, [load]);

  const handleSave = (script: RegexScript) => {
    storage.regexScripts.upsert(script);
    load();
    setEditing(null);
    setShowNew(false);
  };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      storage.regexScripts.delete(id);
      load();
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleToggle = (id: string) => {
    const script = scripts.find(s => s.id === id);
    if (!script) return;
    storage.regexScripts.upsert({ ...script, disabled: !script.disabled });
    load();
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(scripts, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jt-regex-scripts.json';
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const arr = Array.isArray(data) ? data : [data];
        arr.forEach(s => storage.regexScripts.upsert({ ...s, id: s.id || generateId() }));
        load();
      } catch {}
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Extensions</h1>
          <p className="text-sm text-muted-foreground mt-1">Regex scripts that transform messages before they are sent or after they are received.</p>
        </div>
        {!showNew && !editing && (
          <div className="flex gap-2 shrink-0">
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            {scripts.length > 0 && (
              <button onClick={handleExport}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-secondary-border text-sm font-medium transition-colors">
                <Download size={14} /> Export
              </button>
            )}
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-secondary-border text-sm font-medium transition-colors">
              <Upload size={14} /> Import
            </button>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              <Plus size={14} /> New Script
            </button>
          </div>
        )}
      </div>

      {showNew && (
        <ScriptForm script={emptyScript()} onSave={handleSave} onCancel={() => setShowNew(false)} />
      )}

      {scripts.length === 0 && !showNew ? (
        <div className="text-center py-16 bg-card border border-card-border rounded-xl">
          <Code2 size={32} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">No regex scripts yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Regex scripts can strip, replace, or transform message content.</p>
          <button onClick={() => setShowNew(true)} className="mt-4 text-primary text-sm hover:underline flex items-center gap-1 mx-auto">
            <Plus size={13} /> Create your first script
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {scripts.map(script => (
            editing?.id === script.id ? (
              <ScriptForm key={script.id} script={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
            ) : (
              <div key={script.id} className={cn('bg-card border rounded-xl p-4 transition-all', script.disabled ? 'opacity-60 border-card-border' : 'border-card-border')}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground shrink-0">
                    <GripVertical size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{script.scriptName}</h3>
                      {script.disabled && <span className="text-xs bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded">Disabled</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono truncate max-w-48">{script.findRegex}</code>
                      <span className="text-xs text-muted-foreground">→</span>
                      <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono truncate max-w-48">{script.replaceString || '(empty)'}</code>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-muted-foreground">
                      <span>Applies to: {script.placement.map(p => PLACEMENT_LABELS[p]).join(', ')}</span>
                      {script.roles && script.roles.length > 0 && <><span>·</span><span>Roles: {script.roles.join(', ')}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleToggle(script.id)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title={script.disabled ? 'Enable' : 'Disable'}>
                      {script.disabled ? <ToggleLeft size={16} /> : <ToggleRight size={16} className="text-primary" />}
                    </button>
                    <button onClick={() => setEditing(script)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(script.id)}
                      className={cn('p-2 rounded-lg transition-colors', deleteConfirm === script.id ? 'bg-destructive/20 text-destructive' : 'hover:bg-secondary text-muted-foreground hover:text-destructive')}>
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

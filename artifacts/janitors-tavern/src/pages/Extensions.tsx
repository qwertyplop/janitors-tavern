import { useState, useCallback, useEffect, useRef } from 'react';
import { Code2, Plus, Pencil, Trash2, Upload, Download, GripVertical, ToggleLeft, ToggleRight, Layers, ChevronDown } from 'lucide-react';
import { storage, generateId } from '@/lib/storage';
import type { RegexScript, StructuredOutputPreset } from '@/lib/types';
import { DEFAULT_SO_PRESET } from '@/lib/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Regex Scripts ────────────────────────────────────────────────────────────

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

// ─── Regex Scripts Tab ────────────────────────────────────────────────────────

function RegexScriptsTab() {
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">Scripts that transform messages before they are sent or after they are received.</p>
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

// ─── Structured Output Tab ────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn('relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none', checked ? 'bg-primary' : 'bg-muted')}
      >
        <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-4' : 'translate-x-0')} />
      </button>
    </div>
  );
}

function emptySOPreset(name: string): StructuredOutputPreset {
  const now = new Date().toISOString();
  return { id: generateId(), name, ...DEFAULT_SO_PRESET, createdAt: now, updatedAt: now };
}

interface SlotDoc {
  slot: string;
  desc: string;
  explanation: string;
  template: string;
  output: string;
  note?: string;
}

const SLOT_DOCS: SlotDoc[] = [
  {
    slot: '[[keep]]',
    desc: 'Hide-prefill boundary',
    explanation:
      'Marks the boundary between the hidden anchor and the visible output. Everything before [[keep]] is sent to the model as the assistant prefill so it continues from that point — but that prefix is stripped from the final response shown to the user.',
    template: '*She smiled.*[[keep]] Her voice was [[free]].',
    output: 'Her voice was warm and gentle.',
    note: 'The text "*She smiled.*" never appears in the chat — only what follows [[keep]] is shown.',
  },
  {
    slot: '[[free]]',
    desc: 'Free-form text (any content)',
    explanation:
      'Matches any sequence of characters — the model can write whatever it likes here. Use it for open-ended paragraphs, dialogue, or descriptions where you want no length or word constraint.',
    template: '"[[free]]" she whispered.',
    output: '"I never meant to hurt you" she whispered.',
  },
  {
    slot: '[[line]]',
    desc: 'Single line of text',
    explanation:
      'Like [[free]] but restricted to a single line — the pattern stops at the first newline. Ideal for dialogue lines or short descriptions that must not spill onto a new paragraph.',
    template: 'She replied: "[[line]]"',
    output: 'She replied: "Meet me at the east gate."',
  },
  {
    slot: '[[w:N]]',
    desc: 'Exactly N words',
    explanation:
      'Forces the model to write exactly N words in that slot. Each word is matched as a non-whitespace token. Perfect for tight formatting where you need a fixed-length phrase.',
    template: 'Her reaction: [[w:4]].',
    output: 'Her reaction: she froze completely still.',
    note: 'Replace N with any positive integer, e.g. [[w:6]].',
  },
  {
    slot: '[[w:N-M]]',
    desc: 'N to M words (range)',
    explanation:
      'Like [[w:N]] but allows a range of word counts. More flexible than an exact count while still enforcing approximate length.',
    template: 'His answer was [[w:2-5]].',
    output: 'His answer was short and evasive.',
    note: 'Both ends are inclusive. [[w:1-3]] allows one, two, or three words.',
  },
  {
    slot: '[[emotion]]',
    desc: 'One emotion word',
    explanation:
      'Constrains the slot to one of ~30 common emotion words — anger, joy, fear, surprise, melancholy, etc. Great for mood or tone tags that anchor the narrative register.',
    template: 'The mood in the room: [[emotion]].',
    output: 'The mood in the room: apprehensive.',
  },
  {
    slot: '[[name]]',
    desc: 'A proper name',
    explanation:
      'Matches a single capitalized word, enforcing that a proper name (character, place) appears at that position. Useful when you want a name without specifying which one.',
    template: '[[name]] stepped forward from the crowd.',
    output: 'Lyria stepped forward from the crowd.',
  },
  {
    slot: '[[opt:a|b|c]]',
    desc: 'One of the listed options',
    explanation:
      'The model must choose exactly one of the pipe-separated options. The options are matched as a regex alternation. Ideal for categorical choices, tone flags, or single-word mood selectors.',
    template: 'She felt [[opt:happy|sad|angry|afraid]] about it.',
    output: 'She felt afraid about it.',
    note: 'Options can be multi-word: [[opt:deeply happy|vaguely sad]].',
  },
  {
    slot: '[[re:pattern]]',
    desc: 'Custom regex pattern',
    explanation:
      'Inserts a raw regex pattern directly into the compiled JSON Schema pattern. Gives full control when the built-in slots are not expressive enough. The pattern is used verbatim — make sure it is valid regex.',
    template: 'Score: [[re:[1-9]|10]]/10.',
    output: 'Score: 8/10.',
    note: 'Keep patterns simple and avoid capturing groups — the outer schema already wraps everything.',
  },
  {
    slot: '[[end]]',
    desc: 'Stop the pattern here',
    explanation:
      'Terminates the compiled regex — no content is matched after this point. The model is forced to stop at this boundary. Use it to cap responses cleanly after a specific phrase or closing mark.',
    template: '"[[line]]."[[end]]',
    output: '"I\'ll be waiting." (model stops here)',
    note: 'Anything after [[end]] in your template is ignored by the pattern builder.',
  },
];

function HighlightSlot({ text, slot }: { text: string; slot: string }) {
  const idx = text.indexOf(slot);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-primary/20 text-primary rounded px-0.5 font-semibold">{slot}</span>
      {text.slice(idx + slot.length)}
    </>
  );
}

function SlotReference() {
  const [open, setOpen] = useState<string | null>(null);
  const active = SLOT_DOCS.find(d => d.slot === open) ?? null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Click any slot to see a full explanation and example.</p>
      <div className="flex flex-wrap gap-1.5">
        {SLOT_DOCS.map(({ slot, desc }) => (
          <button
            key={slot}
            onClick={() => setOpen(o => o === slot ? null : slot)}
            title={desc}
            className={cn(
              'px-2 py-1 rounded-lg text-xs font-mono border transition-all',
              open === slot
                ? 'bg-primary/15 text-primary border-primary/40 shadow-sm'
                : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground hover:bg-muted/80'
            )}
          >
            {slot}
          </button>
        ))}
      </div>

      {active && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-start justify-between gap-3">
            <div>
              <code className="text-sm font-mono font-bold text-primary">{active.slot}</code>
              <span className="ml-2 text-xs text-muted-foreground">{active.desc}</span>
            </div>
            <button
              onClick={() => setOpen(null)}
              className="text-muted-foreground hover:text-foreground transition-colors text-xs px-1.5 py-0.5 rounded hover:bg-muted"
            >
              ✕
            </button>
          </div>

          <p className="text-sm text-foreground leading-relaxed">{active.explanation}</p>

          {active.note && (
            <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              <span className="text-primary text-xs font-semibold shrink-0 mt-0.5">Note</span>
              <p className="text-xs text-muted-foreground">{active.note}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visual example</p>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground w-16 shrink-0 pt-1.5 not-mono text-xs font-sans">Template</span>
                <div className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-foreground leading-relaxed">
                  <HighlightSlot text={active.template} slot={active.slot} />
                </div>
              </div>
              <div className="flex items-center gap-2 pl-[4.5rem] text-muted-foreground text-xs">
                <div className="h-px flex-1 bg-border" />
                <span>model fills slots</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground w-16 shrink-0 pt-1.5 not-mono text-xs font-sans">Output</span>
                <div className="flex-1 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-foreground leading-relaxed">
                  {active.output}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StructuredOutputTab() {
  const [presets, setPresets] = useState<StructuredOutputPreset[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [form, setForm] = useState<StructuredOutputPreset | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showDocs, setShowDocs] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [newName, setNewName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const loadPresets = useCallback(() => {
    const all = storage.structuredOutputPresets.getAll();
    setPresets(all);
    const id = storage.structuredOutputPresets.getActiveId();
    setActiveIdState(id);
    if (id) {
      const found = all.find(p => p.id === id);
      setForm(found ?? null);
    } else {
      setForm(null);
    }
  }, []);

  useEffect(() => { loadPresets(); }, [loadPresets]);

  const setField = <K extends keyof StructuredOutputPreset>(key: K, val: StructuredOutputPreset[K]) => {
    if (!form) return;
    setForm(f => f ? { ...f, [key]: val, updatedAt: new Date().toISOString() } : f);
  };

  const handleSelectPreset = (id: string) => {
    storage.structuredOutputPresets.setActiveId(id);
    const preset = presets.find(p => p.id === id) ?? null;
    setActiveIdState(id);
    setForm(preset);
    setSaveStatus('idle');
    setDeleteConfirm(false);
  };

  const handleCreatePreset = () => {
    if (!newName.trim()) return;
    const preset = emptySOPreset(newName.trim());
    storage.structuredOutputPresets.upsert(preset);
    storage.structuredOutputPresets.setActiveId(preset.id);
    setPresets(storage.structuredOutputPresets.getAll());
    setActiveIdState(preset.id);
    setForm(preset);
    setNewName('');
    setShowNewForm(false);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    if (!form) return;
    setSaveStatus('saving');
    try {
      storage.structuredOutputPresets.upsert(form);
      await api.settings.update({ activeStructuredOutputPreset: form.enabled ? form : null });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleDelete = () => {
    if (!form || !activeId) return;
    if (!deleteConfirm) { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); return; }
    storage.structuredOutputPresets.delete(activeId);
    storage.structuredOutputPresets.setActiveId(null);
    api.settings.update({ activeStructuredOutputPreset: null }).catch(() => {});
    loadPresets();
    setDeleteConfirm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Force the AI to follow a structured prefill template using JSON Schema response format.
          Based on the <span className="font-mono text-xs bg-muted/60 px-1 rounded">StructuredPrefill</span> technique.
        </p>
        <button
          onClick={() => setShowDocs(v => !v)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-secondary-border text-xs font-medium transition-colors">
          Slot reference <ChevronDown size={12} className={cn('transition-transform', showDocs && 'rotate-180')} />
        </button>
      </div>

      {showDocs && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <SlotReference />
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-medium text-muted-foreground">Active Preset</label>
          <button onClick={() => setShowNewForm(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-secondary-border text-xs font-medium transition-colors">
            <Plus size={11} /> New
          </button>
        </div>

        {showNewForm && (
          <div className="flex gap-2">
            <input
              autoFocus
              className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreatePreset(); if (e.key === 'Escape') { setShowNewForm(false); setNewName(''); } }}
              placeholder="Preset name..."
            />
            <button onClick={handleCreatePreset} disabled={!newName.trim()}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40">
              Create
            </button>
            <button onClick={() => { setShowNewForm(false); setNewName(''); }}
              className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground border border-secondary-border text-sm">
              Cancel
            </button>
          </div>
        )}

        {presets.length === 0 ? (
          <div className="text-center py-8">
            <Layers size={24} className="mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No presets yet.</p>
            <button onClick={() => setShowNewForm(true)} className="mt-2 text-primary text-xs hover:underline">Create one to get started</button>
          </div>
        ) : (
          <div className="relative">
            <select
              value={activeId ?? ''}
              onChange={e => handleSelectPreset(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none appearance-none pr-8">
              <option value="" disabled>Select a preset…</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      {form && (
        <>
          <div className="bg-card border border-card-border rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{form.name}</h3>
              <button onClick={handleDelete}
                className={cn('px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors', deleteConfirm ? 'bg-destructive/20 text-destructive border-destructive/40' : 'bg-secondary text-muted-foreground border-secondary-border hover:text-destructive hover:border-destructive/40')}>
                {deleteConfirm ? 'Confirm delete?' : 'Delete preset'}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Preset Name</label>
              <input className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.name} onChange={e => setField('name', e.target.value)} />
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <ToggleSwitch
                checked={form.enabled}
                onChange={v => setField('enabled', v)}
                label="Enable Structured Output"
                description="Sends a JSON Schema response_format and unwraps the structured response."
              />
              <ToggleSwitch
                checked={form.hidePrefillInDisplay}
                onChange={v => setField('hidePrefillInDisplay', v)}
                label="Hide prefill from output"
                description="Strips the literal prefill prefix from the final response shown to the user."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Min chars after prefix</label>
                <input type="number" min={0}
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.minCharsAfterPrefix}
                  onChange={e => setField('minCharsAfterPrefix', Math.max(0, parseInt(e.target.value) || 0))} />
                <p className="text-xs text-muted-foreground">Minimum characters of generated content after the prefill literals.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Newline token</label>
                <input className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.newlineToken}
                  onChange={e => setField('newlineToken', e.target.value)}
                  placeholder="\n" />
                <p className="text-xs text-muted-foreground">Token the model uses for newlines in the pattern (usually <code className="font-mono">\n</code>).</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Continue overlap chars</label>
                <input type="number" min={0}
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.continueOverlapChars}
                  onChange={e => setField('continueOverlapChars', Math.max(0, parseInt(e.target.value) || 0))} />
                <p className="text-xs text-muted-foreground">Overlap with previous response when continuing generation.</p>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-border pt-4">
              <label className="text-xs font-medium text-muted-foreground">Anti-slop ban list</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={4}
                value={form.antiSlopBanList}
                onChange={e => setField('antiSlopBanList', e.target.value)}
                placeholder={"word1\nword2\nphrase to ban"}
              />
              <p className="text-xs text-muted-foreground">One word or phrase per line. The model is prevented from using these via a negative lookahead in the pattern.</p>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <ToggleSwitch
                checked={form.overridePrefillEnabled}
                onChange={v => setField('overridePrefillEnabled', v)}
                label="Override prefill text"
                description="Use a custom prefill template instead of the assistant's last message."
              />
              {form.overridePrefillEnabled && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Prefill template</label>
                  <textarea
                    className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    rows={6}
                    value={form.overridePrefillText}
                    onChange={e => setField('overridePrefillText', e.target.value)}
                    placeholder={"*[[emotion]]* [[name]] said, \"[[free]]\""}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use <code className="font-mono text-primary/80">[[slot]]</code> markers to define structured regions. The literal text is used as the prefill, slots become regex patterns.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {saveStatus === 'saved' && <span className="text-xs text-green-500">Saved and applied to server</span>}
            {saveStatus === 'error' && <span className="text-xs text-destructive">Failed to apply — changes saved locally</span>}
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saveStatus === 'saving' ? 'Saving…' : 'Save & Apply'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'regex' | 'structured-output';

export default function Extensions() {
  const [activeTab, setActiveTab] = useState<Tab>('regex');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'regex', label: 'Regex Scripts' },
    { id: 'structured-output', label: 'Structured Output' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Extensions</h1>
        <p className="text-sm text-muted-foreground mt-1">Tools that transform and structure AI responses.</p>
      </div>

      <div className="flex border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'regex' && <RegexScriptsTab />}
        {activeTab === 'structured-output' && <StructuredOutputTab />}
      </div>
    </div>
  );
}

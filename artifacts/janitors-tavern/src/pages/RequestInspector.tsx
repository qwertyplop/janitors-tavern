import { useState } from 'react';
import { ScanSearch, Play, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Cpu, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { storage } from '@/lib/storage';

const MOCK_REQUEST = JSON.stringify(
  {
    model: 'gpt-4o',
    stream: false,
    messages: [
      {
        role: 'system',
        content:
          "<Username>User</Username>\n<Aria's Persona>Aria is a cheerful AI companion with a passion for storytelling and deep philosophical questions. She speaks warmly and is curious about everything.</Aria's Persona>\n<Scenario>You are sitting in a cozy candlelit tavern. Rain patters against the windows.</Scenario>\n<UserPersona>A wandering adventurer who loves a good tale and a warm drink.</UserPersona>\n<example_dialogs>User: Tell me a story.\nAria: *smiles and leans forward* Oh, I know just the one...</example_dialogs>",
      },
      { role: 'user', content: "Good evening! What stories do you have tonight?" },
      { role: 'assistant', content: "*lights up* Oh, you've come to exactly the right place! I have a tale of a dragon who collected not gold, but secrets..." },
      { role: 'user', content: "That sounds fascinating. Tell me more." },
    ],
  },
  null,
  2
);

interface PreviewMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokens: number;
}

interface PreviewResult {
  messages: PreviewMessage[];
  samplerParams: Record<string, unknown>;
  postProcessingMode: string;
  model: string;
  baseUrl: string;
  presetName: string | null;
  connectionName: string | null;
  totalMessages: number;
  totalTokens: number;
  byRole: Record<string, number>;
  inputMessageCount: number;
}

const ROLE_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
  system:    { badge: 'bg-violet-500/15 text-violet-400 border border-violet-500/30', bar: 'bg-violet-500', label: 'SYSTEM' },
  user:      { badge: 'bg-blue-500/15 text-blue-400 border border-blue-400/30',       bar: 'bg-blue-500',   label: 'USER' },
  assistant: { badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30', bar: 'bg-emerald-500', label: 'AI' },
};

function MessageRow({ msg, index }: { msg: PreviewMessage; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const style = ROLE_STYLES[msg.role] ?? ROLE_STYLES.system;
  const isLong = msg.content.length > 300;
  const displayContent = !isLong || expanded ? msg.content : msg.content.slice(0, 300) + '…';

  return (
    <div className="flex gap-3 py-3 border-b border-border/30 last:border-0">
      <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
        <span className="text-[10px] font-mono text-muted-foreground w-5 text-center">{index + 1}</span>
        <div className={cn('w-0.5 flex-1 rounded-full min-h-3', style.bar)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', style.badge)}>
            {style.label}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums ml-auto">{msg.tokens} tokens</span>
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed font-mono text-xs">
          {displayContent}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show {msg.content.length - 300} more chars</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RequestInspector() {
  const presets = storage.presets.getAll();
  const [selectedPresetId, setSelectedPresetId] = useState<string>('active');
  const [requestJson, setRequestJson] = useState<string>(MOCK_REQUEST);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function validateJson(val: string) {
    setRequestJson(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  async function runPreview() {
    setApiError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(requestJson);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      return;
    }

    if (selectedPresetId !== 'active') {
      const preset = storage.presets.get(selectedPresetId);
      if (preset) parsed.chatCompletionPreset = preset;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/proxy/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json() as PreviewResult & { error?: string };
      if (!res.ok || data.error) {
        setApiError(data.error ?? `Server error ${res.status}`);
        setResult(null);
      } else {
        setResult(data);
      }
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <ScanSearch size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Request Inspector</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Preview what the proxy will send to the upstream model — message structure, roles, and token estimates.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Left: Input */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Simulate with Preset</h2>
            <select
              value={selectedPresetId}
              onChange={e => setSelectedPresetId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="active">Active preset (server state)</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="none">No preset (pass-through)</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              {selectedPresetId === 'active'
                ? 'Will use whatever preset is currently active on the server.'
                : selectedPresetId === 'none'
                ? 'Messages will be forwarded with macro expansion only, no prompt blocks.'
                : `Will inject the "${presets.find(p => p.id === selectedPresetId)?.name}" preset.`}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">JanitorAI Request JSON</h2>
              <button
                onClick={() => { setRequestJson(MOCK_REQUEST); setJsonError(null); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border"
              >
                <RefreshCw size={11} /> Reset to mock
              </button>
            </div>

            <textarea
              value={requestJson}
              onChange={e => validateJson(e.target.value)}
              rows={18}
              spellCheck={false}
              className={cn(
                'w-full font-mono text-xs px-3 py-2.5 rounded-lg bg-input border text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-ring',
                jsonError ? 'border-destructive focus:ring-destructive' : 'border-border'
              )}
            />

            {jsonError && (
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{jsonError}</span>
              </div>
            )}

            <button
              onClick={runPreview}
              disabled={loading || !!jsonError}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Running…</>
              ) : (
                <><Play size={14} /> Run Preview</>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {apiError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Preview failed</p>
                <p className="text-xs text-destructive/80 mt-0.5">{apiError}</p>
              </div>
            </div>
          )}

          {!result && !apiError && !loading && (
            <div className="rounded-xl border border-border bg-card/50 flex items-center justify-center h-64 text-center">
              <div className="space-y-2">
                <ScanSearch size={32} className="text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Run a preview to see the assembled request</p>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Summary bar */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground tabular-nums">{result.totalMessages}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Messages out</div>
                  </div>
                  <div className="text-center border-x border-border/40">
                    <div className="text-2xl font-bold text-primary tabular-nums">~{result.totalTokens.toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Est. tokens</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground tabular-nums">{result.inputMessageCount}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Input msgs</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40">
                    <Cpu size={12} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-muted-foreground">Model</div>
                      <div className="text-foreground font-medium truncate">{result.model}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40">
                    <Zap size={12} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-muted-foreground">Post-processing</div>
                      <div className="text-foreground font-medium truncate">{result.postProcessingMode}</div>
                    </div>
                  </div>
                </div>

                {(result.connectionName || result.presetName) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {result.connectionName && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {result.connectionName}
                      </span>
                    )}
                    {result.presetName && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                        {result.presetName}
                      </span>
                    )}
                  </div>
                )}

                {/* Token by role breakdown */}
                <div className="mt-3 flex gap-3 text-[11px]">
                  {Object.entries(result.byRole).map(([role, tokens]) => {
                    const style = ROLE_STYLES[role] ?? ROLE_STYLES.system;
                    return (
                      <span key={role} className={cn('px-2 py-0.5 rounded-full', style.badge)}>
                        {style.label} ~{tokens}t
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Sampler params */}
              {Object.keys(result.samplerParams).length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-xs font-semibold text-foreground mb-2">Sampler Parameters (will be sent)</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(result.samplerParams).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border text-xs">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-mono font-bold text-foreground">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message list */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-xs font-semibold text-foreground mb-1">
                  Assembled Messages ({result.totalMessages})
                </h3>
                <p className="text-[11px] text-muted-foreground mb-3">These are the exact messages sent to the model after preset processing and post-processing.</p>
                <div>
                  {result.messages.map((msg, i) => (
                    <MessageRow key={i} msg={msg} index={i} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

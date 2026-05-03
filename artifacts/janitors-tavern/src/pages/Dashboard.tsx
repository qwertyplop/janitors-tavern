import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import {
  Activity, Plug, ScrollText, ChevronRight, CheckCircle2, AlertCircle,
  RefreshCw, Copy, Check, Zap, Info, KeyRound, Eye, EyeOff, Terminal, XCircle, Wifi, WifiOff, ChevronDown, ChevronUp, MessageSquare
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { api } from '@/lib/api';
import type { ConnectionPreset, ChatCompletionPreset, UsageStats, RequestLogEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function ProxyUrlCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-accent/30 border border-accent-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Zap size={14} className="text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Proxy URL</span>
        <span className="text-xs text-muted-foreground ml-auto">Configure this in JanitorAI</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm font-mono text-foreground bg-background border border-border rounded-lg px-3 py-2 truncate">
          {url}
        </code>
        <button
          onClick={() => copyToClipboard(url, setCopied)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-medium transition-colors shrink-0"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        In JanitorAI → Settings → Custom AI → API URL.
      </p>
    </div>
  );
}

function ApiKeyCard({ apiKey, onRotate }: { apiKey: string | null; onRotate: () => void }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [rotating, setRotating] = useState(false);

  const handleRotate = async () => {
    if (!confirm('Regenerate the API key? The old key will stop working immediately.')) return;
    setRotating(true);
    await onRotate();
    setRotating(false);
    setRevealed(true);
  };

  const displayKey = apiKey
    ? (revealed ? apiKey : `${apiKey.slice(0, 8)}${'•'.repeat(24)}${apiKey.slice(-4)}`)
    : '...';

  return (
    <div className="bg-accent/30 border border-accent-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <KeyRound size={14} className="text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">API Key</span>
        <span className="text-xs text-muted-foreground ml-auto">Paste this in JanitorAI API key field</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm font-mono text-foreground bg-background border border-border rounded-lg px-3 py-2 truncate select-all">
          {displayKey}
        </code>
        <button
          onClick={() => setRevealed(r => !r)}
          className="p-2 rounded-lg bg-muted/40 hover:bg-muted/70 text-muted-foreground border border-border transition-colors shrink-0"
          title={revealed ? 'Hide key' : 'Reveal key'}
        >
          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button
          onClick={() => apiKey && copyToClipboard(apiKey, setCopied)}
          disabled={!apiKey}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-medium transition-colors shrink-0 disabled:opacity-50"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={handleRotate}
          disabled={rotating || !apiKey}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 text-muted-foreground border border-border text-xs font-medium transition-colors shrink-0 disabled:opacity-50"
          title="Regenerate API key"
        >
          <RefreshCw size={13} className={rotating ? 'animate-spin' : ''} />
          {rotating ? '' : 'Regenerate'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        In JanitorAI → Settings → Custom AI → API Key. Required for every request to the proxy.
      </p>
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function roleColor(role: string) {
  if (role === 'system') return 'text-yellow-500';
  if (role === 'assistant') return 'text-blue-400';
  return 'text-green-400';
}

function LogEntryRow({ entry }: { entry: RequestLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col">
      <button
        onClick={() => setExpanded(e => !e)}
        className="px-4 py-3 flex flex-col gap-1 text-left hover:bg-muted/20 transition-colors w-full"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {entry.status === 'success' ? (
            <CheckCircle2 size={13} className="text-green-500 shrink-0" />
          ) : (
            <XCircle size={13} className="text-destructive shrink-0" />
          )}
          <span className="text-xs font-mono font-medium text-foreground truncate max-w-[200px]" title={entry.model}>
            {entry.model || '—'}
          </span>
          <span className="text-xs text-muted-foreground">{entry.connectionName}</span>
          {entry.presetName && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{entry.presetName}</span>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            {entry.stream ? <Wifi size={11} /> : <WifiOff size={11} />}
            {entry.stream ? 'stream' : 'sync'}
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>In: <span className="text-foreground font-medium">{entry.inputTokens.toLocaleString()}</span> tok</span>
          <span>Out: <span className="text-foreground font-medium">{entry.outputTokens.toLocaleString()}</span> tok</span>
          <span title={`${entry.rawInputMessageCount} raw → ${entry.processedMessageCount} processed`}>
            Msgs: <span className="text-foreground font-medium">{entry.rawInputMessageCount}</span>
            {entry.rawInputMessageCount !== entry.processedMessageCount && (
              <span className="text-primary"> → {entry.processedMessageCount}</span>
            )}
          </span>
          <span>{entry.durationMs}ms</span>
          <span className="ml-auto">{formatRelativeTime(entry.timestamp)}</span>
        </div>
        {entry.error && (
          <div className="flex items-start gap-1.5 mt-1 text-xs text-destructive bg-destructive/10 rounded-lg px-2.5 py-1.5">
            <AlertCircle size={11} className="shrink-0 mt-0.5" />
            <span className="break-all">{entry.error}</span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-border/50 bg-muted/10">
          <div className="pt-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MessageSquare size={11} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Processed Messages ({entry.processedMessageCount})</span>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {entry.processedMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No messages captured</p>
              ) : (
                entry.processedMessages.map((msg, i) => (
                  <div key={i} className="rounded-lg bg-background border border-border p-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${roleColor(msg.role)}`}>{msg.role}</span>
                    <pre className="text-xs text-foreground mt-1 whitespace-pre-wrap break-all font-sans leading-relaxed max-h-32 overflow-y-auto">
                      {msg.content}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>

          {entry.responseContent !== null && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <MessageSquare size={11} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Response</span>
              </div>
              <div className="rounded-lg bg-background border border-border p-2">
                <pre className="text-xs text-foreground whitespace-pre-wrap break-all font-sans leading-relaxed max-h-48 overflow-y-auto">
                  {entry.responseContent}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequestLogPanel({ logs, loading, onRefresh }: { logs: RequestLogEntry[]; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Request Log</h2>
          <span className="text-xs text-muted-foreground">(last 20)</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-6 text-center">
          <Terminal size={20} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No requests yet. Send a message in JanitorAI to see logs here.</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {logs.map(entry => (
              <LogEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [connections, setConnections] = useState<ConnectionPreset[]>([]);
  const [presets, setPresets] = useState<ChatCompletionPreset[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [timeUntilReset, setTimeUntilReset] = useState<{ hours: number; minutes: number } | null>(null);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [janitorApiKey, setJanitorApiKey] = useState<string | null>(null);
  const [logs, setLogs] = useState<RequestLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const proxyUrl = `${window.location.protocol}//${window.location.host}/api/proxy/chat-completion`;

  const loadData = useCallback(() => {
    setConnections(storage.connections.getAll());
    setPresets(storage.presets.getAll());
    setActiveConnectionId(storage.active.getConnectionId());
    setActivePresetId(storage.active.getPresetId());
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.stats.get();
      setStats(res.stats);
      setTimeUntilReset(res.timeUntilReset);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadApiKey = useCallback(async () => {
    try {
      const res = await api.apiKey.get();
      setJanitorApiKey(res.apiKey);
    } catch {
      // Auth may not be configured — key is still available publicly on the health endpoint
      // Try fetching it directly
      try {
        const res = await fetch('/api/auth/api-key');
        if (res.ok) {
          const data = await res.json() as { apiKey: string };
          setJanitorApiKey(data.apiKey);
        }
      } catch {}
    }
  }, []);

  const handleRotateApiKey = useCallback(async () => {
    try {
      const res = await api.apiKey.rotate();
      setJanitorApiKey(res.apiKey);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to rotate key');
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await api.logs.get();
      setLogs(res.logs);
    } catch {
      // silently ignore
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadStats();
    loadApiKey();
    loadLogs();
    const interval = setInterval(() => {
      loadStats();
      loadLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData, loadStats, loadApiKey, loadLogs]);

  const activeConnection = connections.find(c => c.id === activeConnectionId) || null;
  const activePreset = presets.find(p => p.id === activePresetId) || null;

  const handleActivate = async () => {
    if (!activeConnection) {
      setActivationError('Please select a connection first');
      return;
    }
    setActivating(true);
    setActivationError(null);
    setActivationSuccess(false);
    try {
      const regexScripts = storage.regexScripts.getAll().filter(s => !s.disabled);
      const settings = storage.settings.get();
      await api.settings.update({
        activeConnectionPreset: activeConnection,
        activeChatCompletionPreset: activePreset,
        activeRegexScripts: regexScripts,
        defaultPostProcessing: settings.defaultPostProcessing,
        strictPlaceholderMessage: settings.strictPlaceholderMessage,
      });
      setActivationSuccess(true);
      setTimeout(() => setActivationSuccess(false), 3000);
    } catch (e) {
      setActivationError(e instanceof Error ? e.message : 'Failed to activate');
    } finally {
      setActivating(false);
    }
  };

  const handleSelectConnection = (id: string) => {
    storage.active.setConnectionId(id);
    setActiveConnectionId(id);
  };

  const handleSelectPreset = (id: string | null) => {
    storage.active.setPresetId(id);
    setActivePresetId(id);
  };

  const totalRequests = stats?.totalRequests ?? 0;
  const totalTokens = stats?.totalTokens ?? 0;
  const dailyRequests = stats?.dailyRequests ?? 0;
  const dailyTokens = stats?.dailyTokens ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your active connection and preset, then copy the proxy URL into JanitorAI.</p>
      </div>

      <ProxyUrlCard url={proxyUrl} />
      <ApiKeyCard apiKey={janitorApiKey} onRotate={handleRotateApiKey} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Active Connection</h2>
            </div>
            <Link href="/connections">
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                Manage <ChevronRight size={12} />
              </button>
            </Link>
          </div>

          {connections.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No connections yet</p>
              <Link href="/connections">
                <button className="mt-2 text-xs text-primary hover:underline">+ Add connection</button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {connections.map(conn => (
                <button
                  key={conn.id}
                  onClick={() => handleSelectConnection(conn.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm',
                    activeConnectionId === conn.id
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border hover:border-border/80 hover:bg-muted/30 text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {activeConnectionId === conn.id && <CheckCircle2 size={13} className="text-primary shrink-0" />}
                    <span className="font-medium truncate">{conn.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate pl-0">{conn.baseUrl} · {conn.model || 'No model'}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Active Preset</h2>
            </div>
            <Link href="/presets">
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                Manage <ChevronRight size={12} />
              </button>
            </Link>
          </div>

          <button
            onClick={() => handleSelectPreset(null)}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm',
              activePresetId === null
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border hover:border-border/80 hover:bg-muted/30 text-foreground'
            )}
          >
            <div className="flex items-center gap-2">
              {activePresetId === null && <CheckCircle2 size={13} className="text-primary shrink-0" />}
              <span className="font-medium">Pass-through (no preset)</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Forward messages as-is from JanitorAI</div>
          </button>

          {presets.length > 0 && (
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm',
                    activePresetId === preset.id
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border hover:border-border/80 hover:bg-muted/30 text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {activePresetId === preset.id && <CheckCircle2 size={13} className="text-primary shrink-0" />}
                    <span className="font-medium truncate">{preset.name}</span>
                  </div>
                  {preset.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{preset.description}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        {activationError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-3">
            <AlertCircle size={14} />
            {activationError}
          </div>
        )}
        {activationSuccess && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm mb-3">
            <CheckCircle2 size={14} />
            Configuration activated! JanitorAI requests will now use the selected connection.
          </div>
        )}
        <button
          onClick={handleActivate}
          disabled={activating || !activeConnectionId}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
            activeConnectionId
              ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-md'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {activating ? (
            <><RefreshCw size={16} className="animate-spin" /> Activating...</>
          ) : (
            <><Zap size={16} /> Activate Configuration</>
          )}
        </button>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Press this after changing your connection or preset.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Usage Statistics</h2>
          </div>
          {timeUntilReset && (
            <span className="text-xs text-muted-foreground">Resets in {timeUntilReset.hours}h {timeUntilReset.minutes}m</span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Requests" value={loadingStats ? '...' : totalRequests.toLocaleString()} />
          <StatCard label="Total Tokens" value={loadingStats ? '...' : totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens} />
          <StatCard label="Today's Requests" value={loadingStats ? '...' : dailyRequests.toLocaleString()} />
          <StatCard label="Today's Tokens" value={loadingStats ? '...' : dailyTokens >= 1000 ? `${(dailyTokens / 1000).toFixed(1)}k` : dailyTokens} />
        </div>
      </div>

      <RequestLogPanel logs={logs} loading={loadingLogs} onRefresh={loadLogs} />

      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Quick Start</h3>
        </div>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="text-primary font-bold shrink-0">1.</span>
            <span>Go to <Link href="/connections"><span className="text-primary hover:underline cursor-pointer">Connections</span></Link> and add your AI provider (OpenAI, Anthropic, etc.)</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold shrink-0">2.</span>
            <span>Optionally go to <Link href="/presets"><span className="text-primary hover:underline cursor-pointer">Presets</span></Link> to import a SillyTavern preset for prompt engineering</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold shrink-0">3.</span>
            <span>Select your connection (and optional preset) above, then click <strong className="text-foreground">Activate Configuration</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold shrink-0">4.</span>
            <span>Copy the <strong className="text-foreground">Proxy URL</strong> and paste it into JanitorAI → Settings → Custom AI → API URL</span>
          </li>
        </ol>
      </div>
    </div>
  );
}

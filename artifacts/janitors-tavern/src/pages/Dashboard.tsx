import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import {
  Activity, Plug, ScrollText, Code2, ChevronRight, CheckCircle2, AlertCircle,
  TrendingUp, Coins, RefreshCw, Copy, Check, Zap, Info
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { api } from '@/lib/api';
import type { ConnectionPreset, ChatCompletionPreset, UsageStats } from '@/lib/types';
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
        In JanitorAI → Settings → Custom AI → API URL. Leave the API key field empty or use any placeholder.
      </p>
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

  useEffect(() => {
    loadData();
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadData, loadStats]);

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

import { useMemo, useState } from 'react';
import { ScanSearch, Play, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Cpu, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { storage } from '@/lib/storage';
import type { UILanguage } from '@/lib/types';
import { useLang } from '@/hooks/useLang';

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
  requestBody: Record<string, unknown>;
  totalMessages: number;
  totalTokens: number;
  byRole: Record<string, number>;
  inputMessageCount: number;
}

interface SelectedConnection {
  id: string;
  name: string;
  includeBodyParams?: string;
  excludeBodyParams?: string;
}

function parseInlineBodyParams(raw: string | undefined): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  const result: Record<string, unknown> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    try {
      result[key] = JSON.parse(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function parseBodyExclusions(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.startsWith('-') ? line.slice(1).trim() : line)
    .filter(Boolean);
}

function applyBodyOverrides(body: Record<string, unknown>, includeRaw?: string, excludeRaw?: string): Record<string, unknown> {
  const next = { ...body };
  for (const key of parseBodyExclusions(excludeRaw)) delete next[key];
  Object.assign(next, parseInlineBodyParams(includeRaw));
  return next;
}

const I18N: Record<UILanguage, Record<string, string>> = {
  en: {
    title: 'Request Inspector',
    subtitle: "Preview what the proxy will send to the upstream model — request body, message structure, roles, and token estimates.",
    simulatePreset: 'Simulate with Preset',
    activePreset: 'Active preset (server state)',
    noPreset: 'No preset (pass-through)',
    activePresetHelp: 'Will use whatever preset is currently active on the server.',
    noPresetHelp: 'Messages will be forwarded with macro expansion only, no prompt blocks.',
    injectPreset: 'Will inject the "{name}" preset.',
    requestJson: 'JanitorAI Request JSON',
    resetMock: 'Reset to mock',
    simulateConnection: 'Simulate with Connection',
    activeConnection: 'Active connection (server state)',
    noConnection: 'No connection override',
    activeConnectionHelp: 'Will use the currently active connection on the server.',
    noConnectionHelp: 'No connection preset will be attached.',
    injectConnection: 'Will inject the "{name}" connection.',
    finalDraft: 'Final Draft',
    finalDraftHelp: 'Preset processed, STScript parsed, structured output processed, input regex parsed.',
    runPreview: 'Run Preview',
    running: 'Running…',
    connectionWorkflow: 'Connection Workflow',
    presetWorkflow: 'Preset Workflow',
    connectionLabel: 'Connection:',
    bodyInclude: 'Body include:',
    bodyExclude: 'Body exclude:',
    presetLabel: 'Preset:',
    messagesOut: 'Messages out',
    estTokens: 'Est. tokens',
    inputMsgs: 'Input msgs',
    modelLabel: 'Model',
    postProcessingLabel: 'Post-processing',
    finalRequestBody: 'Final request body',
    samplerParams: 'Sampler Parameters (will be sent)',
    showLess: 'Show less',
    showMoreChars: 'Show {n} more chars',
    previewFailed: 'Preview failed',
    runPreviewHint: 'Run a preview to see the assembled request',
  },
  ru: {
    title: 'Инспектор запроса',
    subtitle: 'Показывает, что прокси отправит модели — тело запроса, структуру сообщений, роли и оценку токенов.',
    simulatePreset: 'Проверить с пресетом',
    activePreset: 'Активный пресет (состояние сервера)',
    noPreset: 'Без пресета (прямой проход)',
    activePresetHelp: 'Будет использован текущий активный пресет на сервере.',
    noPresetHelp: 'Сообщения пройдут только через макросы, без блоков промпта.',
    injectPreset: 'Будет подставлен пресет «{name}».',
    requestJson: 'JSON запроса JanitorAI',
    resetMock: 'Сбросить к примеру',
    simulateConnection: 'Проверить с подключением',
    activeConnection: 'Активное подключение (состояние сервера)',
    noConnection: 'Без замены подключения',
    activeConnectionHelp: 'Будет использовано текущее активное подключение на сервере.',
    noConnectionHelp: 'Подключение не будет подставлено.',
    injectConnection: 'Будет подставлено подключение «{name}».',
    finalDraft: 'Итоговый черновик',
    finalDraftHelp: 'Пресет обработан, STScript разобран, structured output применён, input regex применён.',
    runPreview: 'Запустить просмотр',
    running: 'Выполняется…',
    connectionWorkflow: 'Подключение',
    presetWorkflow: 'Пресет',
    connectionLabel: 'Подключение:',
    bodyInclude: 'Тело (включить):',
    bodyExclude: 'Тело (исключить):',
    presetLabel: 'Пресет:',
    messagesOut: 'Сообщений отправлено',
    estTokens: 'Прим. токенов',
    inputMsgs: 'Вх. сообщений',
    modelLabel: 'Модель',
    postProcessingLabel: 'Постобработка',
    finalRequestBody: 'Итоговое тело запроса',
    samplerParams: 'Параметры сэмплера (будут отправлены)',
    showLess: 'Свернуть',
    showMoreChars: 'Ещё {n} символов',
    previewFailed: 'Предпросмотр не удался',
    runPreviewHint: 'Запустите предпросмотр, чтобы увидеть собранный запрос',
  },
};

function t(lang: UILanguage, key: keyof typeof I18N.en, vars?: Record<string, string>): string {
  const raw = I18N[lang][key] || I18N.en[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '') : raw;
}

const ROLE_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
  system:    { badge: 'bg-violet-500/15 text-violet-400 border border-violet-500/30', bar: 'bg-violet-500', label: 'SYSTEM' },
  user:      { badge: 'bg-blue-500/15 text-blue-400 border border-blue-400/30',       bar: 'bg-blue-500',   label: 'USER' },
  assistant: { badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30', bar: 'bg-emerald-500', label: 'AI' },
};

function MessageRow({ msg, index }: { msg: PreviewMessage; index: number }) {
  const lang = useLang();
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
            {expanded ? <><ChevronUp size={12} /> {t(lang, 'showLess')}</> : <><ChevronDown size={12} /> {t(lang, 'showMoreChars', { n: String(msg.content.length - 300) })}</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RequestInspector() {
  const connections = storage.connections.getAll();
  const presets = storage.presets.getAll();
  const activeConnection = storage.connections.get(storage.active.getConnectionId() || '') as SelectedConnection | null;
  const [selectedPresetId, setSelectedPresetId] = useState<string>('active');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('active');
  const [requestJson, setRequestJson] = useState<string>(MOCK_REQUEST);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const uiLanguage = useLang();
  const presetPreview = useMemo(() => {
    if (selectedPresetId === 'none') return null;
    if (selectedPresetId === 'active') return storage.presets.getAll().find(p => p.id === storage.active.getPresetId()) ?? null;
    return storage.presets.get(selectedPresetId);
  }, [selectedPresetId]);
  const connectionPreview = useMemo(() => {
    if (selectedConnectionId === 'none') return null;
    if (selectedConnectionId === 'active') return activeConnection;
    return connections.find(c => c.id === selectedConnectionId) ?? null;
  }, [activeConnection, connections, selectedConnectionId]);

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
    if (selectedConnectionId !== 'none') {
      const connection = selectedConnectionId === 'active' ? activeConnection : storage.connections.get(selectedConnectionId);
      if (connection) parsed.connectionPreset = connection;
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
          <h1 className="text-xl font-bold text-foreground">{t(uiLanguage, 'title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(uiLanguage, 'subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Left: Input */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t(uiLanguage, 'simulatePreset')}</h2>
            <select
              value={selectedPresetId}
              onChange={e => setSelectedPresetId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="active">{t(uiLanguage, 'activePreset')}</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="none">{t(uiLanguage, 'noPreset')}</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              {selectedPresetId === 'active'
                ? t(uiLanguage, 'activePresetHelp')
                : selectedPresetId === 'none'
                ? t(uiLanguage, 'noPresetHelp')
                : t(uiLanguage, 'injectPreset', { name: presets.find(p => p.id === selectedPresetId)?.name || '' })}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{t(uiLanguage, 'requestJson')}</h2>
              <button
                onClick={() => { setRequestJson(MOCK_REQUEST); setJsonError(null); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border"
              >
                <RefreshCw size={11} /> {t(uiLanguage, 'resetMock')}
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
                <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> {t(uiLanguage, 'running')}</>
              ) : (
                <><Play size={14} /> {t(uiLanguage, 'runPreview')}</>
              )}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t(uiLanguage, 'simulateConnection')}</h2>
            <select
              value={selectedConnectionId}
              onChange={e => setSelectedConnectionId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="active">{t(uiLanguage, 'activeConnection')}</option>
              {connections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="none">{t(uiLanguage, 'noConnection')}</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              {selectedConnectionId === 'active'
                ? t(uiLanguage, 'activeConnectionHelp')
                : selectedConnectionId === 'none'
                ? t(uiLanguage, 'noConnectionHelp')
                : t(uiLanguage, 'injectConnection', { name: connections.find(c => c.id === selectedConnectionId)?.name || '' })}
            </p>
          </div>

          {connectionPreview && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{t(uiLanguage, 'connectionWorkflow')}</h2>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">{t(uiLanguage, 'connectionLabel')}</span>
                  <span className="font-medium text-foreground truncate">{connectionPreview.name}</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">{t(uiLanguage, 'bodyInclude')}</span>
                  <span className="font-mono text-foreground truncate">{connectionPreview.includeBodyParams ? 'set' : 'none'}</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">{t(uiLanguage, 'bodyExclude')}</span>
                  <span className="font-mono text-foreground truncate">{connectionPreview.excludeBodyParams ? 'set' : 'none'}</span>
                </div>
              </div>
            </div>
          )}

          {presetPreview && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{t(uiLanguage, 'presetWorkflow')}</h2>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">{t(uiLanguage, 'presetLabel')}</span>
                  <span className="font-medium text-foreground truncate">{presetPreview.name}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {apiError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">{t(uiLanguage, 'previewFailed')}</p>
                <p className="text-xs text-destructive/80 mt-0.5">{apiError}</p>
              </div>
            </div>
          )}

          {!result && !apiError && !loading && (
            <div className="rounded-xl border border-border bg-card/50 flex items-center justify-center h-64 text-center">
              <div className="space-y-2">
                <ScanSearch size={32} className="text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">{t(uiLanguage, 'runPreviewHint')}</p>
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
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t(uiLanguage, 'messagesOut')}</div>
                  </div>
                  <div className="text-center border-x border-border/40">
                    <div className="text-2xl font-bold text-primary tabular-nums">~{result.totalTokens.toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t(uiLanguage, 'estTokens')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground tabular-nums">{result.inputMessageCount}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t(uiLanguage, 'inputMsgs')}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40">
                    <Cpu size={12} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-muted-foreground">{t(uiLanguage, 'modelLabel')}</div>
                      <div className="text-foreground font-medium truncate">{result.model}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40">
                    <Zap size={12} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-muted-foreground">{t(uiLanguage, 'postProcessingLabel')}</div>
                      <div className="text-foreground font-medium truncate">{result.postProcessingMode}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-muted/30 border border-border/60 p-3">
                  <div className="text-[11px] font-semibold text-foreground mb-2">{t(uiLanguage, 'finalRequestBody')}</div>
                  <pre className="text-[11px] font-mono text-foreground/90 whitespace-pre-wrap break-words overflow-x-auto">
                    {JSON.stringify(result.requestBody, null, 2)}
                  </pre>
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
                  <h3 className="text-xs font-semibold text-foreground mb-2">{t(uiLanguage, 'samplerParams')}</h3>
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

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-xs font-semibold text-foreground mb-1">{t(uiLanguage, 'finalDraft')}</h3>
                <p className="text-[11px] text-muted-foreground mb-3">{t(uiLanguage, 'finalDraftHelp')}</p>
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

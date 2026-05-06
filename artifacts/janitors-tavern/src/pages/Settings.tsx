import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Download, Upload, Trash2, Moon, Sun, Monitor, AlertTriangle, RefreshCw, CheckCircle2, BookOpen } from 'lucide-react';
import { storage } from '@/lib/storage';
import { api } from '@/lib/api';
import type { AppSettings, PromptPostProcessingMode, UILanguage } from '@/lib/types';
import { useTheme } from '@/hooks/useTheme';
import { useLang } from '@/hooks/useLang';
import { t, ppLabel, ppTip } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const POST_PROCESSING_MODES: PromptPostProcessingMode[] = [
  'none','merge','merge-tools','semi-strict','semi-strict-tools',
  'strict','strict-tools','single-user','anthropic','anthropic-merge-consecutives'
];

const LANGUAGE_OPTIONS: Array<{ value: UILanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
];

export default function Settings() {
  const lang = useLang();
  const { theme, changeTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(() => storage.settings.get());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [statsResetting, setStatsResetting] = useState(false);
  const [statsResetDone, setStatsResetDone] = useState(false);
  const [quickStartDismissed, setQuickStartDismissed] = useState(() => storage.quickStart.isDismissed());

  const handleRestoreQuickStart = () => {
    storage.quickStart.restore();
    setQuickStartDismissed(false);
  };

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(s => ({ ...s, ...partial }));
  };

  const handleLanguageChange = (newLang: UILanguage) => {
    updateSettings({ uiLanguage: newLang });
    const current = storage.settings.get();
    storage.settings.save({ ...current, uiLanguage: newLang });
    window.dispatchEvent(new CustomEvent('jt:language-change'));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      storage.settings.save(settings);
      await api.settings.update({
        defaultPostProcessing: settings.defaultPostProcessing,
        strictPlaceholderMessage: settings.strictPlaceholderMessage,
        logging: settings.logging,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const handleExport = () => {
    const data = storage.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `janitors-tavern-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        storage.importAll(ev.target?.result as string);
        setSettings(storage.settings.get());
        window.location.reload();
      } catch {}
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (clearConfirm) {
      storage.clearAll();
      setClearConfirm(false);
      setClearSuccess(true);
      setTimeout(() => { setClearSuccess(false); window.location.reload(); }, 2000);
    } else {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 5000);
    }
  };

  const handleResetStats = async () => {
    setStatsResetting(true);
    try {
      await api.stats.reset();
      setStatsResetDone(true);
      setTimeout(() => setStatsResetDone(false), 3000);
    } catch {}
    setStatsResetting(false);
  };

  const loggingItems = [
    { key: 'logRequests', label: t(lang, 'logRequests'), desc: t(lang, 'logRequestsDesc') },
    { key: 'logResponses', label: t(lang, 'logResponses'), desc: t(lang, 'logResponsesDesc') },
    { key: 'logRawRequestBody', label: t(lang, 'logRawRequestBody'), desc: t(lang, 'logRawRequestBodyDesc') },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t(lang, 'settingsTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t(lang, 'settingsSubtitle')}</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">{t(lang, 'appearance')}</h2>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">{t(lang, 'theme')}</label>
          <div className="flex gap-2">
            {[
              { value: 'light' as const, label: 'Light', icon: Sun },
              { value: 'dark' as const, label: 'Dark', icon: Moon },
              { value: 'system' as const, label: 'System', icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => { changeTheme(value); updateSettings({ theme: value }); }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                  theme === value
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-muted/20 border-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">{t(lang, 'uiLanguage')}</label>
          <select
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={settings.uiLanguage}
            onChange={e => handleLanguageChange(e.target.value as UILanguage)}
          >
            {LANGUAGE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen size={13} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{t(lang, 'quickStartGuide')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-5">
              {quickStartDismissed ? t(lang, 'quickStartHidden') : t(lang, 'quickStartShown')}
            </p>
          </div>
          <button
            onClick={handleRestoreQuickStart}
            disabled={!quickStartDismissed}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              quickStartDismissed
                ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                : 'bg-muted/20 text-muted-foreground border-border cursor-default opacity-50'
            )}
          >
            {quickStartDismissed ? t(lang, 'showAgain') : t(lang, 'showing')}
          </button>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">{t(lang, 'proxyDefaults')}</h2>
        <p className="text-xs text-muted-foreground">{t(lang, 'proxyDefaultsSubtitle')}</p>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">{t(lang, 'defaultPostProcessing')}</label>
          <select
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={settings.defaultPostProcessing}
            onChange={e => updateSettings({ defaultPostProcessing: e.target.value as PromptPostProcessingMode })}
          >
            {POST_PROCESSING_MODES.map(m => (
              <option key={m} value={m}>{ppLabel(lang, m)}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{ppTip(lang, settings.defaultPostProcessing)}</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t(lang, 'strictPlaceholder')}</label>
          <input
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={settings.strictPlaceholderMessage}
            onChange={e => updateSettings({ strictPlaceholderMessage: e.target.value })}
            placeholder="[Start a new chat]"
          />
          <p className="text-xs text-muted-foreground">{t(lang, 'strictPlaceholderHelp')}</p>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">{t(lang, 'logging')}</h2>
        <p className="text-xs text-muted-foreground">{t(lang, 'loggingSubtitle')}</p>
        <div className="space-y-3">
          {loggingItems.map(({ key, label, desc }) => (
            <div key={key} className="flex items-start gap-3">
              <input
                type="checkbox"
                id={key}
                checked={settings.logging[key as keyof typeof settings.logging]}
                onChange={e => updateSettings({ logging: { ...settings.logging, [key]: e.target.checked } })}
                className="accent-primary mt-0.5"
              />
              <label htmlFor={key} className="flex-1 cursor-pointer">
                <div className="text-sm text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm">
          <CheckCircle2 size={14} /> {t(lang, 'saved')}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {saving ? <><RefreshCw size={14} className="animate-spin" /> {t(lang, 'saving')}</> : t(lang, 'saveSettings')}
      </button>

      <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">{t(lang, 'dataManagement')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-secondary-border text-sm font-medium transition-colors"
          >
            <Download size={14} /> {t(lang, 'exportAllData')}
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-secondary-border text-sm font-medium transition-colors cursor-pointer">
            <Upload size={14} /> {t(lang, 'importData')}
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">{t(lang, 'resetUsageStats')}</h3>
              <p className="text-xs text-muted-foreground">{t(lang, 'resetUsageStatsHelp')}</p>
            </div>
            <button
              onClick={handleResetStats}
              disabled={statsResetting}
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground border border-secondary-border text-sm font-medium hover:bg-secondary/80 disabled:opacity-40"
            >
              {statsResetDone
                ? <span className="text-green-600 dark:text-green-400">{t(lang, 'resetDone')}</span>
                : statsResetting
                ? t(lang, 'resetting')
                : t(lang, 'resetStats')}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-destructive" />
                {t(lang, 'clearAllData')}
              </h3>
              <p className="text-xs text-muted-foreground">{t(lang, 'clearAllDataHelp')}</p>
            </div>
            <button
              onClick={handleClearAll}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                clearConfirm
                  ? 'bg-destructive text-destructive-foreground border-destructive'
                  : 'bg-destructive/10 text-destructive border-destructive/40 hover:bg-destructive/20'
              )}
            >
              {clearSuccess ? t(lang, 'cleared') : clearConfirm ? t(lang, 'clickAgainConfirm') : t(lang, 'clearAll')}
            </button>
          </div>
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-xs text-muted-foreground">{t(lang, 'footerOne')}</p>
        <p className="text-xs text-muted-foreground">{t(lang, 'footerTwo')}</p>
      </div>
    </div>
  );
}

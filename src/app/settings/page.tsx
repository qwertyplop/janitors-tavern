'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getSettings,
  updateSettings,
  getProfiles,
  getConnectionPresets,
  getPromptPresets,
  getSamplerPresets,
  saveConnectionPresets,
  saveChatCompletionPresets,
  saveSettings as saveSettingsToStorage,
  getChatCompletionPresets,
} from '@/lib/storage';
import { downloadJson, readJsonFile } from '@/lib/utils';
import { useSync } from '@/components/providers/SyncProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import { AppSettings, Profile, ConnectionPreset, PromptPreset, SamplerPreset, ThemeMode, LoggingSettings, ChatCompletionPreset } from '@/types';

interface ServerSettings {
  logging: LoggingSettings;
}

interface BackupData {
  version: string;
  exportedAt: string;
  connections: ConnectionPreset[];
  presets: ChatCompletionPreset[];
  settings: AppSettings;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<ConnectionPreset[]>([]);
  const [chatCompletionPresets, setChatCompletionPresets] = useState<ChatCompletionPreset[]>([]);
  const [prompts, setPrompts] = useState<PromptPreset[]>([]);
  const [samplers, setSamplers] = useState<SamplerPreset[]>([]);
  const [saved, setSaved] = useState(false);
  const [serverSaved, setServerSaved] = useState(false);


  // Storage sync from context
  const { initialized, blobConfigured: firebaseConfigured, lastSync, syncing, forcePush, forcePull } = useSync();
  const { t } = useI18n();

  // Local sync status for UI feedback
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(getSettings());
    setProfiles(getProfiles());
    setConnections(getConnectionPresets());
    setChatCompletionPresets(getChatCompletionPresets());
    setPrompts(getPromptPresets());
    setSamplers(getSamplerPresets());

    // Fetch server settings
    fetchServerSettings();
  }, []);

  // Re-fetch data when sync initializes (data may have been pulled from Firebase)
  useEffect(() => {
    if (initialized) {
      setSettings(getSettings());
      setConnections(getConnectionPresets());
      setChatCompletionPresets(getChatCompletionPresets());
    }
  }, [initialized]);

  const fetchServerSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setServerSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch server settings:', error);
    }
  };

  const handleSave = () => {
    if (!settings) return;
    updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveServerSettings = async () => {
    if (!serverSettings) return;

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverSettings),
      });

      if (response.ok) {
        setServerSaved(true);
        setTimeout(() => setServerSaved(false), 2000);
      }
    } catch (error) {
      console.error('Failed to save server settings:', error);
    }
  };

  const handleChange = (key: keyof AppSettings, value: unknown) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleLoggingChange = (key: keyof LoggingSettings, value: unknown) => {
    if (!serverSettings) return;
    setServerSettings({
      ...serverSettings,
      logging: { ...serverSettings.logging, [key]: value },
    });
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // Export all data as a backup file
  const handleExportBackup = () => {
    const backup: BackupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      connections: getConnectionPresets(),
      presets: getChatCompletionPresets(),
      settings: getSettings(),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    downloadJson(backup, `janitors-tavern-backup-${timestamp}.json`);
  };

  // Import data from a backup file
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const backup = await readJsonFile<BackupData>(file);

      // Validate backup structure
      if (!backup.connections || !backup.presets || !backup.settings) {
        throw new Error('Invalid backup file structure');
      }

      // Confirm import
      if (!confirm(`This will replace all your current data with the backup from ${backup.exportedAt}. Continue?`)) {
        return;
      }

      // Import data
      saveConnectionPresets(backup.connections);
      saveChatCompletionPresets(backup.presets);
      saveSettingsToStorage(backup.settings);

      // Force sync to cloud before reloading (if Firebase is configured)
      if (firebaseConfigured) {
        setSyncFeedback({ type: 'success', message: 'Syncing imported data to cloud...' });
        await forcePush();
      }

      // Refresh page to load new data
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Clear file input
    if (importFileRef.current) {
      importFileRef.current.value = '';
    }
  };

  // Push local data to Firebase
  const handlePushToFirebase = async () => {
    if (!firebaseConfigured) return;

    setSyncFeedback(null);

    const success = await forcePush();

    if (success) {
      setSyncFeedback({ type: 'success', message: 'Data pushed to cloud successfully!' });
      setTimeout(() => setSyncFeedback(null), 3000);
    } else {
      setSyncFeedback({ type: 'error', message: 'Failed to push data to cloud' });
    }
  };

  // Pull data from Firebase to local
  const handlePullFromFirebase = async () => {
    if (!firebaseConfigured) return;

    if (!confirm('This will replace your local data with cloud data. Continue?')) {
      return;
    }

    setSyncFeedback(null);

    const success = await forcePull();

    if (!success) {
      setSyncFeedback({ type: 'error', message: 'Failed to pull data from cloud' });
    }
    // If successful, the page will reload automatically
  };



  if (!settings) {
    return <div>{t.common.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t.settings.subtitle}
        </p>
      </div>

      {/* Logging Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t.settings.requestResponseLogging}
            {serverSettings?.logging.enabled && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {t.common.enabled}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {t.settings.loggingDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {serverSettings ? (
            <>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="loggingEnabled"
                  checked={serverSettings.logging.enabled}
                  onChange={(e) => handleLoggingChange('enabled', e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <Label htmlFor="loggingEnabled">{t.settings.enableLogging}</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="logRequests"
                  checked={serverSettings.logging.logRequests}
                  onChange={(e) => handleLoggingChange('logRequests', e.target.checked)}
                  disabled={!serverSettings.logging.enabled}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <Label htmlFor="logRequests">{t.settings.logRequests}</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="logResponses"
                  checked={serverSettings.logging.logResponses}
                  onChange={(e) => handleLoggingChange('logResponses', e.target.checked)}
                  disabled={!serverSettings.logging.enabled}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <Label htmlFor="logResponses">{t.settings.logResponses}</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logFilePath">{t.settings.logFilePath}</Label>
                <Input
                  id="logFilePath"
                  value={serverSettings.logging.logFilePath}
                  onChange={(e) => handleLoggingChange('logFilePath', e.target.value)}
                  placeholder="logs/proxy.log"
                  disabled={!serverSettings.logging.enabled}
                />
                <p className="text-xs text-zinc-500">{t.settings.logFilePathHint}</p>
              </div>

              <div className="flex items-center gap-4">
                <Button onClick={handleSaveServerSettings}>{t.settings.saveLoggingSettings}</Button>
                {serverSaved && (
                  <span className="text-sm text-green-600 dark:text-green-400">{t.settings.settingsSaved}</span>
                )}
              </div>
            </>
          ) : (
            <p className="text-zinc-500">{t.settings.loadingServerSettings}</p>
          )}
        </CardContent>
      </Card>

      {/* Log Viewer */}
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.logViewer}</CardTitle>
          <CardDescription>{t.settings.viewRecentLogs}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Logs are available in the Function logs dashboard.
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
              Go to your deployment platform logs to view request/response logs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t.settings.dataManagement}
            <Badge className={firebaseConfigured
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
            }>
              {firebaseConfigured ? t.settings.autoSyncEnabled : t.settings.localOnly}
            </Badge>
          </CardTitle>
          <CardDescription>
            {t.settings.importExportSync}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Backup & Restore */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t.settings.backupRestore}</h4>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportBackup}>
                {t.settings.exportBackup}
              </Button>
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
              <Button variant="outline" onClick={() => importFileRef.current?.click()}>
                {t.settings.importBackup}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              {t.settings.backupHint}
            </p>
          </div>

          {/* Cloud Sync */}
          {firebaseConfigured && (
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t.settings.cloudSync}</h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePushToFirebase}
                  disabled={syncing}
                >
                  {syncing ? t.settings.syncingData : t.settings.pushToCloud}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePullFromFirebase}
                  disabled={syncing}
                >
                  {t.settings.pullFromCloud}
                </Button>
              </div>
              {syncFeedback && (
                <p className={`text-sm ${
                  syncFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {syncFeedback.message}
                </p>
              )}
              <p className="text-xs text-zinc-500">
                {t.settings.autoSyncHint}
              </p>
              {lastSync && (
                <p className="text-xs text-zinc-400">
                  {t.settings.lastSync} {new Date(lastSync).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Storage Status Info */}
          <div className="rounded-md bg-zinc-50 dark:bg-zinc-800 p-3 text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              {firebaseConfigured ? (
                <>
                  <span className="font-medium text-green-600 dark:text-green-400">{t.settings.autoSyncEnabledMessage}</span>
                  {' '}{t.settings.changesAutoSaved}
                </>
              ) : (
                <>
                  <span className="font-medium">{t.settings.localStorageOnly}</span>
                  {' '}{t.settings.addBlobStore}
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.appearance}</CardTitle>
          <CardDescription>{t.settings.customizeAppLooks}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">{t.settings.theme}</Label>
            <Select
              id="theme"
              value={settings.theme}
              onChange={(e) => handleChange('theme', e.target.value as ThemeMode)}
            >
              <option value="system">{t.settings.themeSystem}</option>
              <option value="light">{t.settings.themeLight}</option>
              <option value="dark">{t.settings.themeDark}</option>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showAdvanced"
              checked={settings.showAdvancedOptions}
              onChange={(e) => handleChange('showAdvancedOptions', e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <Label htmlFor="showAdvanced">{t.settings.showAdvancedOptions}</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.defaultPresets}</CardTitle>
          <CardDescription>
            {t.settings.defaultPresetsHint}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultProfile">{t.settings.defaultProfile}</Label>
            <Select
              id="defaultProfile"
              value={settings.defaultProfileId || ''}
              onChange={(e) => handleChange('defaultProfileId', e.target.value || undefined)}
            >
              <option value="">{t.common.none}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultConnection">{t.settings.defaultConnection}</Label>
            <Select
              id="defaultConnection"
              value={settings.defaultConnectionId || ''}
              onChange={(e) => handleChange('defaultConnectionId', e.target.value || undefined)}
            >
              <option value="">{t.common.none}</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultChatCompletion">{t.settings.defaultChatCompletion}</Label>
            <Select
              id="defaultChatCompletion"
              value={settings.defaultChatCompletionPresetId || ''}
              onChange={(e) => handleChange('defaultChatCompletionPresetId', e.target.value || undefined)}
            >
              <option value="">{t.common.none}</option>
              {chatCompletionPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-zinc-500">{t.settings.usedWhenNoPreset}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultPrompt">{t.settings.defaultPromptPreset}</Label>
            <Select
              id="defaultPrompt"
              value={settings.defaultPromptPresetId || ''}
              onChange={(e) => handleChange('defaultPromptPresetId', e.target.value || undefined)}
            >
              <option value="">{t.common.none}</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultSampler">{t.settings.defaultSamplerPreset}</Label>
            <Select
              id="defaultSampler"
              value={settings.defaultSamplerPresetId || ''}
              onChange={(e) => handleChange('defaultSamplerPresetId', e.target.value || undefined)}
            >
              <option value="">{t.common.none}</option>
              {samplers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.proxyInformation}</CardTitle>
          <CardDescription>{t.settings.apiEndpointDetails}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t.settings.chatCompletionEndpoint}</Label>
            <div className="mt-1 rounded-md bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-800">
              <code>POST /api/proxy/chat-completion</code>
            </div>
          </div>
          <div>
            <Label>{t.settings.healthCheckEndpoint}</Label>
            <div className="mt-1 rounded-md bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-800">
              <code>GET /api/health</code>
            </div>
          </div>
          <div>
            <Label>{t.settings.testConnectionEndpoint}</Label>
            <div className="mt-1 rounded-md bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-800">
              <code>POST /api/proxy/test-connection</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">{t.settings.dangerZone}</CardTitle>
          <CardDescription>{t.settings.irreversibleActions}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleClearData}>
            {t.settings.clearAllData}
          </Button>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {t.settings.clearAllDataHint}
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave}>{t.settings.saveSettings}</Button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">{t.settings.settingsSaved}</span>}
      </div>
    </div>
  );
}

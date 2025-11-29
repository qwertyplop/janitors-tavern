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

  // Cloud logs state
  const [logEntries, setLogEntries] = useState<Array<{
    id: string;
    timestamp: string;
    type: string;
    requestId: string;
    data: unknown;
    durationMs?: number;
  }>>([]);
  const [logCount, setLogCount] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Storage sync from context
  const { initialized, blobConfigured, lastSync, syncing, forcePush, forcePull } = useSync();

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

  // Re-fetch data when sync initializes (data may have been pulled from blob)
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

      // Force sync to cloud before reloading (if blob is configured)
      if (blobConfigured) {
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

  // Push local data to Vercel Blob
  const handlePushToBlob = async () => {
    if (!blobConfigured) return;

    setSyncFeedback(null);

    const success = await forcePush();

    if (success) {
      setSyncFeedback({ type: 'success', message: 'Data pushed to cloud successfully!' });
      setTimeout(() => setSyncFeedback(null), 3000);
    } else {
      setSyncFeedback({ type: 'error', message: 'Failed to push data to cloud' });
    }
  };

  // Pull data from Vercel Blob to local
  const handlePullFromBlob = async () => {
    if (!blobConfigured) return;

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

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const response = await fetch('/api/storage/logs');
      if (response.ok) {
        const data = await response.json();
        setLogEntries(data.logs || []);
        setLogCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs?')) return;

    try {
      const response = await fetch('/api/storage/logs', {
        method: 'DELETE',
      });

      if (response.ok) {
        setLogEntries([]);
        setLogCount(0);
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };


  if (!settings) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Application preferences and default configurations
        </p>
      </div>

      {/* Logging Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Request/Response Logging
            {serverSettings?.logging.enabled && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Enabled
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Capture raw request and response bodies to a log file for debugging
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
                <Label htmlFor="loggingEnabled">Enable logging</Label>
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
                <Label htmlFor="logRequests">Log requests</Label>
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
                <Label htmlFor="logResponses">Log responses</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logFilePath">Log file path</Label>
                <Input
                  id="logFilePath"
                  value={serverSettings.logging.logFilePath}
                  onChange={(e) => handleLoggingChange('logFilePath', e.target.value)}
                  placeholder="logs/proxy.log"
                  disabled={!serverSettings.logging.enabled}
                />
                <p className="text-xs text-zinc-500">Relative to the project root</p>
              </div>

              <div className="flex items-center gap-4">
                <Button onClick={handleSaveServerSettings}>Save Logging Settings</Button>
                {serverSaved && (
                  <span className="text-sm text-green-600 dark:text-green-400">Settings saved!</span>
                )}
              </div>
            </>
          ) : (
            <p className="text-zinc-500">Loading server settings...</p>
          )}
        </CardContent>
      </Card>

      {/* Log Viewer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Log Viewer</span>
            {logCount > 0 && (
              <span className="text-sm font-normal text-zinc-500">
                {logCount} entries
              </span>
            )}
          </CardTitle>
          <CardDescription>View recent request/response logs (stored in Vercel Blob)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={fetchLogs} disabled={loadingLogs} variant="outline">
              {loadingLogs ? 'Loading...' : 'Refresh Logs'}
            </Button>
            <Button onClick={clearLogs} variant="outline" className="text-red-600 hover:text-red-700">
              Clear Logs
            </Button>
          </div>
          <div className="max-h-[500px] overflow-auto rounded-md border border-zinc-200 dark:border-zinc-700">
            {logEntries.length === 0 ? (
              <div className="p-4 text-center text-zinc-500">
                No logs yet. Click &quot;Refresh Logs&quot; to load.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {logEntries.map((entry) => (
                  <details key={entry.id} className="group">
                    <summary className="flex cursor-pointer items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <Badge className={
                        entry.type === 'error'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : entry.type === 'request'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : entry.type === 'response'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
                      }>
                        {entry.type}
                      </Badge>
                      <span className="font-mono text-xs text-zinc-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <span className="font-mono text-xs text-zinc-400">
                        [{entry.requestId}]
                      </span>
                      {entry.durationMs && (
                        <span className="text-xs text-zinc-500">
                          {entry.durationMs}ms
                        </span>
                      )}
                    </summary>
                    <div className="bg-zinc-50 p-3 dark:bg-zinc-900">
                      <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                        {JSON.stringify(entry.data, null, 2)}
                      </pre>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Data Management
            <Badge className={blobConfigured
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
            }>
              {blobConfigured ? 'Auto-Sync Enabled' : 'Local Only'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Import, export, and sync your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Backup & Restore */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Backup & Restore</h4>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportBackup}>
                Export Backup
              </Button>
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
              <Button variant="outline" onClick={() => importFileRef.current?.click()}>
                Import Backup
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Export all connections, presets, and settings as a JSON file for backup or migration.
            </p>
          </div>

          {/* Cloud Sync */}
          {blobConfigured && (
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Cloud Sync (Vercel Blob)</h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePushToBlob}
                  disabled={syncing}
                >
                  {syncing ? 'Syncing...' : 'Push to Cloud'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePullFromBlob}
                  disabled={syncing}
                >
                  Pull from Cloud
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
                Changes are automatically synced to cloud. Use these buttons to force sync or recover data.
              </p>
              {lastSync && (
                <p className="text-xs text-zinc-400">
                  Last sync: {new Date(lastSync).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Storage Status Info */}
          <div className="rounded-md bg-zinc-50 dark:bg-zinc-800 p-3 text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              {blobConfigured ? (
                <>
                  <span className="font-medium text-green-600 dark:text-green-400">Auto-sync is enabled.</span>
                  {' '}Changes are automatically saved to cloud storage.
                </>
              ) : (
                <>
                  <span className="font-medium">Local storage only.</span>
                  {' '}To enable cloud storage, add a Blob store in your Vercel dashboard.
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              id="theme"
              value={settings.theme}
              onChange={(e) => handleChange('theme', e.target.value as ThemeMode)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
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
            <Label htmlFor="showAdvanced">Show advanced options</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Presets</CardTitle>
          <CardDescription>
            Default presets used when no specific preset is specified in requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultProfile">Default Profile</Label>
            <Select
              id="defaultProfile"
              value={settings.defaultProfileId || ''}
              onChange={(e) => handleChange('defaultProfileId', e.target.value || undefined)}
            >
              <option value="">None</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultConnection">Default Connection</Label>
            <Select
              id="defaultConnection"
              value={settings.defaultConnectionId || ''}
              onChange={(e) => handleChange('defaultConnectionId', e.target.value || undefined)}
            >
              <option value="">None</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultChatCompletion">Default Chat Completion Preset</Label>
            <Select
              id="defaultChatCompletion"
              value={settings.defaultChatCompletionPresetId || ''}
              onChange={(e) => handleChange('defaultChatCompletionPresetId', e.target.value || undefined)}
            >
              <option value="">None (use first available)</option>
              {chatCompletionPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-zinc-500">Used when JanitorAI sends requests without a preset</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultPrompt">Default Prompt Preset</Label>
            <Select
              id="defaultPrompt"
              value={settings.defaultPromptPresetId || ''}
              onChange={(e) => handleChange('defaultPromptPresetId', e.target.value || undefined)}
            >
              <option value="">None</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultSampler">Default Sampler Preset</Label>
            <Select
              id="defaultSampler"
              value={settings.defaultSamplerPresetId || ''}
              onChange={(e) => handleChange('defaultSamplerPresetId', e.target.value || undefined)}
            >
              <option value="">None</option>
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
          <CardTitle>Proxy Information</CardTitle>
          <CardDescription>API endpoint details for JanitorAI integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Chat Completion Endpoint</Label>
            <div className="mt-1 rounded-md bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-800">
              <code>POST /api/proxy/chat-completion</code>
            </div>
          </div>
          <div>
            <Label>Health Check Endpoint</Label>
            <div className="mt-1 rounded-md bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-800">
              <code>GET /api/health</code>
            </div>
          </div>
          <div>
            <Label>Test Connection Endpoint</Label>
            <div className="mt-1 rounded-md bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-800">
              <code>POST /api/proxy/test-connection</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleClearData}>
            Clear All Data
          </Button>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            This will delete all presets, profiles, and settings from local storage.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave}>Save Settings</Button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Settings saved!</span>}
      </div>
    </div>
  );
}

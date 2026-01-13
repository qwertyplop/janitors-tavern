'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getSettings,
  updateSettings,
  getProfiles,
  saveProfiles,
  getConnectionPresets,
  saveConnectionPresets,
  saveChatCompletionPresets,
  saveSettings as saveSettingsToStorage,
  getChatCompletionPresets,
  getPromptPresets,
  savePromptPresets,
  getSamplerPresets,
  saveSamplerPresets,
  getExtensions,
  saveExtensions,
  getExtensionsPipelines,
  saveExtensionsPipelines,
  getRegexScripts,
  saveRegexScripts,
} from '@/lib/storage';
import { getStats } from '@/lib/stats';
import { downloadJson, readJsonFile } from '@/lib/utils';
import { useSync } from '@/components/providers/SyncProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import {
  AppSettings,
  Profile,
  ConnectionPreset,
  ThemeMode,
  LoggingSettings,
  ChatCompletionPreset,
  PromptPreset,
  SamplerPreset,
  Extension,
  ExtensionsPipeline,
  RegexScript,
} from '@/types';
import { UsageStats } from '@/lib/stats';
// Remove direct import of server-side auth functions
// These functions are now called via API endpoints

interface BackupData {
  version: string;
  exportedAt: string;
  appVersion?: string;
  connections: ConnectionPreset[];
  chatCompletionPresets: ChatCompletionPreset[];
  // For backward compatibility with v1.0 backups
  presets?: ChatCompletionPreset[];
  // Optional fields for backward compatibility (v2.0+)
  promptPresets?: PromptPreset[];
  samplerPresets?: SamplerPreset[];
  profiles?: Profile[];
  extensions?: Extension[];
  extensionsPipelines?: ExtensionsPipeline[];
  regexScripts?: RegexScript[];
  settings: AppSettings;
  serverSettings?: AppSettings;
  // Firebase data
  stats?: UsageStats;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<ConnectionPreset[]>([]);
  const [chatCompletionPresets, setChatCompletionPresets] = useState<ChatCompletionPreset[]>([]);
  const [saved, setSaved] = useState(false);

  // Storage sync from context
  const { initialized, blobConfigured: firebaseConfigured, lastSync, syncing, forcePush, forcePull } = useSync();
  const { t } = useI18n();

  // Local sync status for UI feedback
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Clear data verification state
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [verificationText1, setVerificationText1] = useState('');
  const [verificationText2, setVerificationText2] = useState('');

  useEffect(() => {
    // Load local settings first
    const localSettings = getSettings();
    setSettings(localSettings);
    setProfiles(getProfiles());
    setConnections(getConnectionPresets());
    setChatCompletionPresets(getChatCompletionPresets());

    // Fetch server settings and merge them
    fetchServerSettings(localSettings);
  }, []);


  // Re-fetch data when sync initializes (data may have been pulled from Firebase)
  useEffect(() => {
    if (initialized) {
      setSettings(getSettings());
      setConnections(getConnectionPresets());
      setChatCompletionPresets(getChatCompletionPresets());
    }
  }, [initialized]);

  const fetchServerSettings = async (localSettings: AppSettings) => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const serverSettings = await response.json();
        // Merge server settings with local settings, preferring server settings for logging and strictPlaceholderMessage
        setSettings({
          ...localSettings,
          logging: serverSettings.logging || localSettings.logging,
          strictPlaceholderMessage: serverSettings.strictPlaceholderMessage || localSettings.strictPlaceholderMessage,
        });
      }
    } catch (error) {
      console.error('Failed to fetch server settings:', error);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    // Save local settings
    updateSettings(settings);
    
    // Save server settings (logging and strictPlaceholderMessage) to API
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logging: settings.logging,
          strictPlaceholderMessage: settings.strictPlaceholderMessage,
        }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
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
    if (!settings) return;
    setSettings({
      ...settings,
      logging: { ...settings.logging, [key]: value },
    });
  };

  const handleClearData = () => {
    setShowClearDataDialog(true);
  };

  const handleConfirmClearData = async () => {
    // Check if both verification texts match exactly
    if (verificationText1 === 'delete all data' && verificationText2 === 'I understand this cannot be undone') {
      try {
        // Clear local storage
        localStorage.clear();
        
        // If Firebase is configured, also clear cloud data
        if (firebaseConfigured) {
          const response = await fetch('/api/storage/all', {
            method: 'DELETE',
          });
          
          if (!response.ok) {
            console.error('Failed to clear Firebase data:', await response.text());
            // Continue anyway - we've cleared local storage
          }
        }
        
        // Reload the page
        window.location.reload();
      } catch (error) {
        console.error('Error clearing data:', error);
        alert('Failed to clear all data. Please try again.');
      }
    }
  };

  const handleCloseClearDataDialog = () => {
    setShowClearDataDialog(false);
    setVerificationText1('');
    setVerificationText2('');
  };

  // Export all data as a backup file
  const handleExportBackup = async () => {
    try {
      // Fetch stats from Firebase if available
      let stats: UsageStats | undefined;
      if (firebaseConfigured) {
        try {
          stats = await getStats();
        } catch (error) {
          console.warn('Failed to fetch stats from Firebase:', error);
          // Continue without stats
        }
      }

      const backup: BackupData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        connections: getConnectionPresets(),
        chatCompletionPresets: getChatCompletionPresets(),
        promptPresets: getPromptPresets(),
        samplerPresets: getSamplerPresets(),
        profiles: getProfiles(),
        extensions: getExtensions(),
        extensionsPipelines: getExtensionsPipelines(),
        regexScripts: getRegexScripts(),
        settings: getSettings(),
        stats,
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      downloadJson(backup, `janitors-tavern-backup-${timestamp}.json`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export backup. Please try again.');
    }
  };

  // Import data from a backup file
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const backup = await readJsonFile<BackupData>(file);

      // Handle backward compatibility: check for old backup format with "presets" field
      const chatCompletionPresets = backup.chatCompletionPresets || backup.presets || [];

      // Validate backup structure - require at least connections and settings
      if (!backup.connections || !backup.settings) {
        throw new Error('Invalid backup file structure');
      }

      // Confirm import
      if (!confirm(`This will replace all your current data with the backup from ${backup.exportedAt}. Continue?`)) {
        return;
      }

      // Import all data types
      saveConnectionPresets(backup.connections);
      saveChatCompletionPresets(chatCompletionPresets);
      
      // Import optional data types if they exist in the backup
      if (backup.promptPresets) {
        savePromptPresets(backup.promptPresets);
      }
      if (backup.samplerPresets) {
        saveSamplerPresets(backup.samplerPresets);
      }
      if (backup.profiles) {
        saveProfiles(backup.profiles);
      }
      if (backup.extensions) {
        saveExtensions(backup.extensions);
      }
      if (backup.extensionsPipelines) {
        saveExtensionsPipelines(backup.extensionsPipelines);
      }
      if (backup.regexScripts) {
        saveRegexScripts(backup.regexScripts);
      }
      
      saveSettingsToStorage(backup.settings);

      // Note: Stats are not imported as they are usage statistics
      // that are typically not restored from backup

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
      {/* Sticky header with save button */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm py-4 -mx-6 px-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t.settings.title}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t.settings.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={handleSave}>{t.settings.saveSettings}</Button>
            {saved && <span className="text-sm text-green-600 dark:text-green-400">{t.settings.settingsSaved}</span>}
          </div>
        </div>
      </div>

      {/* Logging Settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t.settings.requestResponseLogging}
          </CardTitle>
          <CardDescription>
            {t.settings.loggingDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings ? (
            <>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="logRequests"
                  checked={settings.logging.logRequests}
                  onChange={(e) => handleLoggingChange('logRequests', e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <Label htmlFor="logRequests">{t.settings.logRequests}</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="logResponses"
                  checked={settings.logging.logResponses}
                  onChange={(e) => handleLoggingChange('logResponses', e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <Label htmlFor="logResponses">{t.settings.logResponses}</Label>
              </div>

            </>
          ) : (
            <p className="text-zinc-500">{t.settings.loadingServerSettings}</p>
          )}
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
              
              {/* Logging Status Check */}
              {settings && (
                <div className="space-y-2 border-t pt-4 mt-4">
                  <h5 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t.settings.loggingStatus}</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${settings.logging.logRequests ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span>{t.settings.logRequestsStatus}: {settings.logging.logRequests ? t.common.enabled : t.common.disabled}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${settings.logging.logResponses ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span>{t.settings.logResponsesStatus}: {settings.logging.logResponses ? t.common.enabled : t.common.disabled}</span>
                    </div>
                  </div>
                </div>
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
          <CardTitle>{t.settings.postProcessingSettings}</CardTitle>
          <CardDescription>{t.settings.postProcessingDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="strictPlaceholderMessage">{t.settings.strictPlaceholderMessage}</Label>
            <Input
              id="strictPlaceholderMessage"
              value={settings.strictPlaceholderMessage || '[Start a new chat]'}
              onChange={(e) => handleChange('strictPlaceholderMessage', e.target.value)}
              placeholder="[Start a new chat]"
            />
            <p className="text-xs text-zinc-500">
              {t.settings.strictPlaceholderHint}
            </p>
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

      {/* Clear Data Confirmation Dialog */}
      <Dialog open={showClearDataDialog} onOpenChange={handleCloseClearDataDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">{t.settings.clearAllData}</DialogTitle>
            <DialogDescription>
              {t.settings.confirmClearData}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="verification1">
                Type <span className="font-mono font-bold">"delete all data"</span> to confirm:
              </Label>
              <Input
                id="verification1"
                value={verificationText1}
                onChange={(e) => setVerificationText1(e.target.value)}
                placeholder="delete all data"
              />
              {verificationText1 !== 'delete all data' && verificationText1.length > 0 && (
                <p className="text-sm text-red-500">Text does not match. Please type exactly: "delete all data"</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="verification2">
                Type <span className="font-mono font-bold">"I understand this cannot be undone"</span> to confirm:
              </Label>
              <Input
                id="verification2"
                value={verificationText2}
                onChange={(e) => setVerificationText2(e.target.value)}
                placeholder="I understand this cannot be undone"
              />
              {verificationText2 !== 'I understand this cannot be undone' && verificationText2.length > 0 && (
                <p className="text-sm text-red-500">Text does not match. Please type exactly: "I understand this cannot be undone"</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseClearDataDialog}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmClearData}
              disabled={verificationText1 !== 'delete all data' || verificationText2 !== 'I understand this cannot be undone'}
            >
              {t.settings.clearAllData}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

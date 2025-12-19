'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  getConnectionPresets,
  getChatCompletionPresets,
  getSettings,
  updateSettings,
} from '@/lib/storage';
import { forceSync } from '@/lib/storage-sync';
import { ConnectionPreset, ChatCompletionPreset, AppSettings, PromptPostProcessingMode } from '@/types';
import { useSync } from '@/components/providers/SyncProvider';
import { useI18n } from '@/components/providers/I18nProvider';

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  dailyRequests: number;
  dailyTokens: number;
  lastDailyReset: string;
  lastUpdated: string;
  timeUntilReset: { hours: number; minutes: number };
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export default function DashboardPage() {
  const [connections, setConnections] = useState<ConnectionPreset[]>([]);
  const [presets, setPresets] = useState<ChatCompletionPreset[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { initialized } = useSync();
  const { t } = useI18n();

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/storage/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
    fetchStats();
  }, [fetchStats]);

  // Reload data when sync initializes (data may have been pulled from Firebase)
  useEffect(() => {
    if (initialized) {
      loadData();
      fetchStats();
    }
  }, [initialized, fetchStats]);

  // Refresh stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const loadData = () => {
    setConnections(getConnectionPresets());
    setPresets(getChatCompletionPresets());
    setSettings(getSettings());
  };

  const handleConnectionChange = (connectionId: string) => {
    const newSettings = updateSettings({ defaultConnectionId: connectionId || undefined });
    setSettings(newSettings);
    setConfirmed(false);
  };

  const handlePresetChange = (presetId: string) => {
    const newSettings = updateSettings({ defaultChatCompletionPresetId: presetId || undefined });
    setSettings(newSettings);
    setConfirmed(false);
  };

  const handlePostProcessingChange = (mode: string) => {
    const newSettings = updateSettings({
      defaultPostProcessing: (mode || 'none') as PromptPostProcessingMode
    });
    setSettings(newSettings);
    setConfirmed(false);
  };

  const handleConfirmChoice = async () => {
    setConfirming(true);
    setConfirmed(false);

    try {
      // Force push to Firebase to ensure proxy has latest settings
      await forceSync('push').catch(() => {});
      setConfirmed(true);
      // Auto-hide after 3 seconds
      setTimeout(() => setConfirmed(false), 3000);
    } catch (error) {
      console.error('Failed to sync settings:', error);
    } finally {
      setConfirming(false);
    }
  };

  const defaultConnection = connections.find((c) => c.id === settings?.defaultConnectionId);
  const defaultPreset = presets.find((p) => p.id === settings?.defaultChatCompletionPresetId);

  const postProcessingOptions: { value: PromptPostProcessingMode; label: string }[] = [
    { value: 'none', label: t.dashboard.postProcessingNone },
    { value: 'merge', label: t.dashboard.postProcessingMerge },
    { value: 'merge-tools', label: t.dashboard.postProcessingMergeTools },
    { value: 'semi-strict', label: t.dashboard.postProcessingSemiStrict },
    { value: 'semi-strict-tools', label: t.dashboard.postProcessingSemiStrictTools },
    { value: 'strict', label: t.dashboard.postProcessingStrict },
    { value: 'strict-tools', label: t.dashboard.postProcessingStrictTools },
    { value: 'single-user', label: t.dashboard.postProcessingSingleUser },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t.dashboard.title}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t.dashboard.subtitle}
        </p>
      </div>

      {/* Proxy Endpoint Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.proxyEndpoint}</CardTitle>
          <CardDescription>{t.dashboard.configureJanitor}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-800">
            <code>/api/proxy/chat-completion</code>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {t.dashboard.sendRequestsWith} <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">presetId</code> {t.dashboard.or}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 ml-1">connectionId</code> {t.dashboard.inRequestBody}
          </p>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/connections">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardDescription>{t.dashboard.connections}</CardDescription>
              <CardTitle className="text-3xl">{connections.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.dashboard.apiConnectionPresets}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/presets">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardDescription>{t.dashboard.presets}</CardDescription>
              <CardTitle className="text-3xl">{presets.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.dashboard.chatCompletionPresets}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Default Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.activePresets}</CardTitle>
          <CardDescription>{t.dashboard.selectPresetsForJanitor}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dashboardConnection">{t.dashboard.connection}</Label>
              <Select
                id="dashboardConnection"
                value={settings?.defaultConnectionId || ''}
                onChange={(e) => handleConnectionChange(e.target.value)}
              >
                <option value="">{t.dashboard.selectConnection}</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.model ? `(${c.model})` : ''}
                  </option>
                ))}
              </Select>
              {defaultConnection && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {defaultConnection.baseUrl}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboardPreset">{t.dashboard.chatCompletionPreset}</Label>
              <Select
                id="dashboardPreset"
                value={settings?.defaultChatCompletionPresetId || ''}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="">{t.dashboard.selectPreset}</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              {defaultPreset && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {defaultPreset.promptBlocks.length} {t.dashboard.blocksTemp} {defaultPreset.sampler.temperature}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dashboardPostProcessing">{t.dashboard.postProcessing}</Label>
            <Select
              id="dashboardPostProcessing"
              value={settings?.defaultPostProcessing || 'none'}
              onChange={(e) => handlePostProcessingChange(e.target.value)}
            >
              {postProcessingOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t.dashboard.postProcessingTips[settings?.defaultPostProcessing || 'none']}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleConfirmChoice}
              disabled={!settings?.defaultConnectionId || !settings?.defaultChatCompletionPresetId || confirming}
            >
              {confirming ? t.common.loading : t.dashboard.confirmChoice}
            </Button>
            {confirmed && (
              <span className="text-sm text-green-600 dark:text-green-400 animate-pulse">
                {t.dashboard.choiceConfirmed}
              </span>
            )}
          </div>
          {(!settings?.defaultConnectionId || !settings?.defaultChatCompletionPresetId) && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t.dashboard.selectBothWarning}
              </p>
            </div>
          )}
          {settings?.defaultConnectionId && settings?.defaultChatCompletionPresetId && (
            <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3">
              <p className="text-sm text-green-800 dark:text-green-200">
                {t.dashboard.readyToReceive}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.usageStatistics}</CardTitle>
          <CardDescription>
            {t.dashboard.requestAndTokenTracking}
            {stats?.timeUntilReset && (
              <span className="ml-2 text-zinc-400">
                · {t.dashboard.dailyResetsIn} {stats.timeUntilReset.hours}h {stats.timeUntilReset.minutes}m
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="text-center py-4 text-zinc-500">{t.dashboard.loadingStatistics}</div>
          ) : stats ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t.dashboard.totalRequests}</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {formatNumber(stats.totalRequests)}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.common.allTime}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t.dashboard.dailyRequests}</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatNumber(stats.dailyRequests)}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.dashboard.since10AM}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t.dashboard.totalTokens}</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {formatNumber(stats.totalTokens)}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.common.allTime}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t.dashboard.dailyTokens}</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatNumber(stats.dailyTokens)}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.dashboard.since10AM}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-zinc-500">
              {t.dashboard.noStatisticsYet}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getConnectionPresets,
  getChatCompletionPresets,
  getSettings,
  updateSettings,
  getSelectedApiKey,
} from '@/lib/storage';
import { ConnectionPreset, ChatCompletionPreset, AppSettings, PromptPostProcessingMode } from '@/types';
import { useSync } from '@/components/providers/SyncProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import { getAuthSettings } from '@/lib/auth';

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
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { initialized, forcePush } = useSync();
  const { t } = useI18n();

  // Pending selections (not yet saved to settings)
  const [pendingConnectionId, setPendingConnectionId] = useState<string>('');
  const [pendingPresetId, setPendingPresetId] = useState<string>('');
  const [pendingPostProcessing, setPendingPostProcessing] = useState<PromptPostProcessingMode>('none');

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
    console.log('Dashboard - Component mounted, loading data...');
    loadData();
    fetchStats();
    fetchApiKey();
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
    const currentSettings = getSettings();
    setConnections(getConnectionPresets());
    setPresets(getChatCompletionPresets());
    setSettings(currentSettings);
    
    // Initialize pending selections with current settings
    setPendingConnectionId(currentSettings.defaultConnectionId || '');
    setPendingPresetId(currentSettings.defaultChatCompletionPresetId || '');
    setPendingPostProcessing(currentSettings.defaultPostProcessing || 'none');
  };

  const fetchApiKey = async () => {
    try {
      console.log('Dashboard - Fetching API key using getAuthSettings() from client-side');
      
      const authSettings = await getAuthSettings();
      console.log('Dashboard - Auth settings received:', {
        isAuthenticated: authSettings.isAuthenticated,
        hasApiKey: !!authSettings.janitorApiKey,
        apiKeyPreview: authSettings.janitorApiKey ? authSettings.janitorApiKey.substring(0, 8) + '...' : 'none'
      });
      
      setApiKey(authSettings.janitorApiKey || null);
    } catch (error) {
      console.error('Dashboard - Error fetching API key:', error);
      setApiKey(null);
    }
  };

  const handleConnectionChange = (connectionId: string) => {
    setPendingConnectionId(connectionId || '');
    setConfirmed(false);
  };

  const handlePresetChange = (presetId: string) => {
    setPendingPresetId(presetId || '');
    setConfirmed(false);
  };

  const handlePostProcessingChange = (mode: string) => {
    setPendingPostProcessing((mode || 'none') as PromptPostProcessingMode);
    console.log('[Dashboard] Post-processing changed to:', mode, 'Pending update');
    setConfirmed(false);
  };

  const handleConfirmChoice = async () => {
    setConfirming(true);
    setConfirmed(false);

    try {
      // Apply pending selections to actual settings
      const newSettings = updateSettings({
        defaultConnectionId: pendingConnectionId || undefined,
        defaultChatCompletionPresetId: pendingPresetId || undefined,
        defaultPostProcessing: pendingPostProcessing || 'none'
      });
      setSettings(newSettings);
      
      // Force push to Firebase to ensure proxy has latest settings
      // Use forcePush from useSync to trigger syncing status
      await forcePush().catch(() => {});
      setConfirmed(true);
      // Auto-hide after 3 seconds
      setTimeout(() => setConfirmed(false), 3000);
    } catch (error) {
      console.error('Failed to sync settings:', error);
    } finally {
      setConfirming(false);
    }
  };

  // Helper to get connection/preset details for pending selections
  const pendingConnection = connections.find((c) => c.id === pendingConnectionId);
  const pendingPreset = presets.find((p) => p.id === pendingPresetId);
  const confirmedConnection = connections.find((c) => c.id === settings?.defaultConnectionId);
  const confirmedPreset = presets.find((p) => p.id === settings?.defaultChatCompletionPresetId);

  // Check if there are any pending changes that need confirmation
  const hasPendingChanges =
    pendingConnectionId !== settings?.defaultConnectionId ||
    pendingPresetId !== settings?.defaultChatCompletionPresetId ||
    pendingPostProcessing !== settings?.defaultPostProcessing;

  // Check if the selected connection is Anthropic
  const isAnthropicConnection = pendingConnection?.baseUrl?.includes('anthropic.com') || false;
  
  // Determine available post-processing options based on provider
  const postProcessingOptions: { value: PromptPostProcessingMode; label: string }[] = isAnthropicConnection
    ? [
        { value: 'anthropic', label: t.dashboard.postProcessingAnthropic },
        { value: 'anthropic-merge-consecutives', label: t.dashboard.postProcessingAnthropicMergeConsecutives },
      ]
    : [
        { value: 'none', label: t.dashboard.postProcessingNone },
        { value: 'merge', label: t.dashboard.postProcessingMerge },
        { value: 'merge-tools', label: t.dashboard.postProcessingMergeTools },
        { value: 'semi-strict', label: t.dashboard.postProcessingSemiStrict },
        { value: 'semi-strict-tools', label: t.dashboard.postProcessingSemiStrictTools },
        { value: 'strict', label: t.dashboard.postProcessingStrict },
        { value: 'strict-tools', label: t.dashboard.postProcessingStrictTools },
        { value: 'single-user', label: t.dashboard.postProcessingSingleUser },
        { value: 'anthropic', label: t.dashboard.postProcessingAnthropic },
        { value: 'anthropic-merge-consecutives', label: t.dashboard.postProcessingAnthropicMergeConsecutives },
      ];
  
  // If Anthropic connection is selected but current post-processing mode is not Anthropic,
  // automatically switch to 'anthropic' mode
  useEffect(() => {
    if (isAnthropicConnection &&
        pendingPostProcessing !== 'anthropic' &&
        pendingPostProcessing !== 'anthropic-merge-consecutives') {
      console.log('[Dashboard] Anthropic connection detected, switching post-processing to "anthropic"');
      setPendingPostProcessing('anthropic');
    }
  }, [isAnthropicConnection, pendingPostProcessing]);

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
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Proxy Endpoint</Label>
            <div className="rounded-md bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-800">
              <code>/api/proxy/chat-completion</code>
            </div>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t.dashboard.sendRequestsWith} <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">presetId</code> {t.dashboard.or}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 ml-1">connectionId</code> {t.dashboard.inRequestBody}
            </p>
          </div>
          
          <div>
            <Label className="mb-2 block">API Key</Label>
            <div className="flex gap-2">
              <Input
                value={apiKey ? `${apiKey.substring(0, 4)}....${apiKey.slice(-2)}` : 'Loading...'}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (apiKey) {
                    navigator.clipboard.writeText(apiKey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                disabled={!apiKey}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Configure JanitorAI to use this endpoint with your API key
            </p>
          </div>
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
                value={pendingConnectionId || ''}
                onChange={(e) => handleConnectionChange(e.target.value)}
              >
                <option value="">{t.dashboard.selectConnection}</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.model ? `(${c.model})` : ''}
                  </option>
                ))}
              </Select>
              {pendingConnection && (() => {
                const selectedKey = getSelectedApiKey(pendingConnection.id);
                return (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
                    <span className="truncate min-w-0 overflow-hidden text-ellipsis break-all">{pendingConnection.baseUrl}</span>
                    {selectedKey && (
                      <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
                        • {t.common.key}: {selectedKey.name}
                      </span>
                    )}
                    {pendingConnectionId !== settings?.defaultConnectionId && (
                      <span className="shrink-0 text-amber-600 dark:text-amber-400">(pending)</span>
                    )}
                  </p>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboardPreset">{t.dashboard.chatCompletionPreset}</Label>
              <Select
                id="dashboardPreset"
                value={pendingPresetId || ''}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="">{t.dashboard.selectPreset}</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              {pendingPreset && pendingPresetId !== settings?.defaultChatCompletionPresetId && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="text-amber-600 dark:text-amber-400">(pending)</span>
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dashboardPostProcessing">{t.dashboard.postProcessing}</Label>
            <Select
              id="dashboardPostProcessing"
              value={pendingPostProcessing || 'none'}
              onChange={(e) => handlePostProcessingChange(e.target.value)}
            >
              {postProcessingOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t.dashboard.postProcessingTips[pendingPostProcessing || 'none']}
              {pendingPostProcessing !== settings?.defaultPostProcessing && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">(pending)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleConfirmChoice}
              disabled={!pendingConnectionId || !pendingPresetId || !hasPendingChanges || confirming}
            >
              {confirming ? t.common.loading : t.dashboard.confirmChoice}
            </Button>
            {confirmed && (
              <span className="text-sm text-green-600 dark:text-green-400 animate-pulse">
                {t.dashboard.choiceConfirmed}
              </span>
            )}
          </div>
          {(!pendingConnectionId || !pendingPresetId) && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t.dashboard.selectBothWarning}
              </p>
            </div>
          )}
          {pendingConnectionId && pendingPresetId && (
            <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3">
              <p className="text-sm text-green-800 dark:text-green-200">
                {t.dashboard.readyToReceive}
                {(pendingConnectionId !== settings?.defaultConnectionId ||
                 pendingPresetId !== settings?.defaultChatCompletionPresetId ||
                 pendingPostProcessing !== settings?.defaultPostProcessing) ? (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">(pending confirmation)</span>
                ) : (
                  <span className="ml-2 text-green-600 dark:text-green-400">(confirmed)</span>
                )}
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

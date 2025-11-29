'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  getConnectionPresets,
  getChatCompletionPresets,
  getSettings,
  updateSettings,
} from '@/lib/storage';
import { ConnectionPreset, ChatCompletionPreset, AppSettings } from '@/types';
import { useSync } from '@/components/providers/SyncProvider';

export default function DashboardPage() {
  const [connections, setConnections] = useState<ConnectionPreset[]>([]);
  const [presets, setPresets] = useState<ChatCompletionPreset[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const { initialized } = useSync();

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Reload data when sync initializes (data may have been pulled from blob)
  useEffect(() => {
    if (initialized) {
      loadData();
    }
  }, [initialized]);

  const loadData = () => {
    setConnections(getConnectionPresets());
    setPresets(getChatCompletionPresets());
    setSettings(getSettings());
  };

  const handleConnectionChange = (connectionId: string) => {
    const newSettings = updateSettings({ defaultConnectionId: connectionId || undefined });
    setSettings(newSettings);
  };

  const handlePresetChange = (presetId: string) => {
    const newSettings = updateSettings({ defaultChatCompletionPresetId: presetId || undefined });
    setSettings(newSettings);
  };

  const defaultConnection = connections.find((c) => c.id === settings?.defaultConnectionId);
  const defaultPreset = presets.find((p) => p.id === settings?.defaultChatCompletionPresetId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Proxy control panel overview and quick access
        </p>
      </div>

      {/* Proxy Endpoint Info */}
      <Card>
        <CardHeader>
          <CardTitle>Proxy Endpoint</CardTitle>
          <CardDescription>Configure JanitorAI to use this endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-800">
            <code>/api/proxy/chat-completion</code>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Send requests with <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">presetId</code> or
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 ml-1">connectionId</code> in the request body.
          </p>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/connections">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardDescription>Connections</CardDescription>
              <CardTitle className="text-3xl">{connections.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">API connection presets</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/presets">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardDescription>Presets</CardDescription>
              <CardTitle className="text-3xl">{presets.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Chat completion presets (prompts + samplers)</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Default Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Active Presets</CardTitle>
          <CardDescription>Select the presets to use for incoming JanitorAI requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dashboardConnection">Connection</Label>
              <Select
                id="dashboardConnection"
                value={settings?.defaultConnectionId || ''}
                onChange={(e) => handleConnectionChange(e.target.value)}
              >
                <option value="">Select a connection...</option>
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
              <Label htmlFor="dashboardPreset">Chat Completion Preset</Label>
              <Select
                id="dashboardPreset"
                value={settings?.defaultChatCompletionPresetId || ''}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="">Select a preset...</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              {defaultPreset && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {defaultPreset.promptBlocks.length} blocks · Temp: {defaultPreset.sampler.temperature}
                </p>
              )}
            </div>
          </div>
          {(!settings?.defaultConnectionId || !settings?.defaultChatCompletionPresetId) && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Please select both a connection and a preset for JanitorAI requests to work.
              </p>
            </div>
          )}
          {settings?.defaultConnectionId && settings?.defaultChatCompletionPresetId && (
            <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3">
              <p className="text-sm text-green-800 dark:text-green-200">
                Ready to receive requests from JanitorAI.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Presets */}
      {presets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Presets</CardTitle>
            <CardDescription>Quick access to your chat completion presets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {presets.slice(0, 5).map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div>
                    <p className="font-medium">{preset.name}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {preset.promptBlocks.length} blocks · Temp: {preset.sampler.temperature}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {preset.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getConnectionPresets,
  getChatCompletionPresets,
  getSettings,
} from '@/lib/storage';
import { ConnectionPreset, ChatCompletionPreset, AppSettings } from '@/types';

export default function DashboardPage() {
  const [connections, setConnections] = useState<ConnectionPreset[]>([]);
  const [presets, setPresets] = useState<ChatCompletionPreset[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    setConnections(getConnectionPresets());
    setPresets(getChatCompletionPresets());
    setSettings(getSettings());
  }, []);

  const defaultConnection = connections.find((c) => c.id === settings?.defaultConnectionId);

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
          <CardTitle>Default Configuration</CardTitle>
          <CardDescription>Currently active defaults for incoming requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Default Connection</span>
            {defaultConnection ? (
              <Badge variant="secondary">{defaultConnection.name}</Badge>
            ) : (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Not set</span>
            )}
          </div>
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

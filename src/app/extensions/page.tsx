'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ExtensionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Extensions</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Pre/post-processing extensions for request transformation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Coming Soon
            <Badge variant="secondary">Planned</Badge>
          </CardTitle>
          <CardDescription>
            Extensions system is under development
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Extensions will allow you to transform requests and responses with custom logic:
          </p>
          <div className="space-y-3">
            <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <h4 className="font-medium">Pre-processing Extensions</h4>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Modify incoming requests before prompt composition. Examples: language detection,
                content filters, auto-tagging.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <h4 className="font-medium">Prompt Extensions</h4>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Inject additional instructions or context. Examples: add style guidelines,
                safety instructions.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <h4 className="font-medium">Post-processing Extensions</h4>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Modify model output. Examples: formatting, content filtering,
                response splitting.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extension Pipeline</CardTitle>
          <CardDescription>
            Configure the order and settings for your extensions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-zinc-400 dark:text-zinc-500">
            No extensions configured
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

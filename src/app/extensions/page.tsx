'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/components/providers/I18nProvider';

export default function ExtensionsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t.extensions.title}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t.extensions.subtitle}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t.extensions.comingSoon}
            <Badge variant="secondary">{t.extensions.planned}</Badge>
          </CardTitle>
          <CardDescription>
            {t.extensions.underDevelopment}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {t.extensions.extensionsWillAllow}
          </p>
          <div className="space-y-3">
            <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <h4 className="font-medium">{t.extensions.preProcessing}</h4>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t.extensions.preProcessingDesc}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <h4 className="font-medium">{t.extensions.promptExtensions}</h4>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t.extensions.promptExtensionsDesc}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <h4 className="font-medium">{t.extensions.postProcessing}</h4>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t.extensions.postProcessingDesc}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.extensions.extensionPipeline}</CardTitle>
          <CardDescription>
            {t.extensions.configureOrder}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-zinc-400 dark:text-zinc-500">
            {t.extensions.noExtensionsConfigured}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

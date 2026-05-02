'use client';

import { useI18n } from '@/components/providers/I18nProvider';
import RegexScriptManager from '@/components/extensions/RegexScriptManager';

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

      <RegexScriptManager />
    </div>
  );
}

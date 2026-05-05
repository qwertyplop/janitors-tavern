import { useState, useEffect } from 'react';
import { storage } from '@/lib/storage';
import type { UILanguage } from '@/lib/types';

export function useLang(): UILanguage {
  const [lang, setLang] = useState<UILanguage>(() => storage.settings.get().uiLanguage ?? 'en');

  useEffect(() => {
    const handler = () => setLang(storage.settings.get().uiLanguage ?? 'en');
    window.addEventListener('jt:language-change', handler);
    return () => window.removeEventListener('jt:language-change', handler);
  }, []);

  return lang;
}

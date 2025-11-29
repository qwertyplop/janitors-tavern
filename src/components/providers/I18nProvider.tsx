'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, languages, getTranslation, TranslationKeys } from '@/lib/i18n';
import { getSettings, updateSettings } from '@/lib/storage';

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
  languages: typeof languages;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  // Load language from settings on mount
  useEffect(() => {
    const settings = getSettings();
    if (settings.language && (settings.language === 'en' || settings.language === 'ru')) {
      setLanguageState(settings.language);
    }
    setMounted(true);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    // Save to settings storage (auto-syncs to blob)
    updateSettings({ language: lang });
  }, []);

  const t = getTranslation(language);

  // Prevent hydration mismatch by rendering default language until mounted
  const value: I18nContextValue = {
    language: mounted ? language : 'en',
    setLanguage,
    t: mounted ? t : getTranslation('en'),
    languages,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

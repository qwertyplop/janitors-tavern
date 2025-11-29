import { en, TranslationKeys } from './translations/en';
import { ru } from './translations/ru';
import { Language } from '@/types';

export type { Language };

export const languages: { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
];

export const translations: Record<Language, TranslationKeys> = {
  en,
  ru,
};

export function getTranslation(lang: Language): TranslationKeys {
  return translations[lang] || translations.en;
}

export type { TranslationKeys };

import de from './locales/de';
import en from './locales/en';

export const languages = {
  de: 'Deutsch',
  en: 'English',
} as const;

export const defaultLang = 'en';

export const translations = {
  de,
  en,
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations[typeof defaultLang];

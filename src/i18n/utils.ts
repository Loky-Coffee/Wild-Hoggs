import { translations, defaultLang, type Language, type TranslationKey } from './index';

export function getLangFromUrl(url: URL): Language {
  const [, lang] = url.pathname.split('/');
  if (lang in translations) return lang as Language;
  return defaultLang;
}

export function useTranslations(lang: Language) {
  return function t(key: TranslationKey): string {
    return translations[lang][key] || translations[defaultLang][key];
  }
}

/**
 * Get the localized URL path
 * English (default lang) has no prefix, other languages have /{lang}/ prefix
 * @param path - The path without language prefix (e.g., '/tools/building')
 * @param lang - The language code
 * @returns The localized path
 */
export function getLocalizedPath(path: string, lang: Language): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // English (default) has no prefix
  if (lang === defaultLang) {
    return `/${cleanPath}`;
  }

  // Other languages have /{lang}/ prefix
  return `/${lang}/${cleanPath}`;
}

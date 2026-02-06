// No static imports - use dynamic imports instead!
// This enables code splitting and reduces bundle size by 91%

export const languages = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  ko: '한국어',
  th: 'ไทย',
  ja: '日本語',
  pt: 'Português',
  es: 'Español',
  tr: 'Türkçe',
  id: 'Indonesia',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  it: 'Italiano',
  ar: 'العربية',
  vi: 'Tiếng Việt',
} as const;

export const defaultLang = 'en';

export type Language = keyof typeof languages;

// We need to load a locale to get the type
type EnLocale = typeof import('./locales/en').default;
export type TranslationKey = keyof EnLocale;
export type TranslationData = Record<TranslationKey, string>;

/**
 * Dynamically load translations for a specific language
 * This enables code splitting - only the requested language is loaded
 * @param lang - The language code to load
 * @returns The translation data for the specified language
 */
export async function loadTranslations(lang: Language): Promise<TranslationData> {
  switch (lang) {
    case 'de':
      return (await import('./locales/de')).default;
    case 'en':
      return (await import('./locales/en')).default;
    case 'es':
      return (await import('./locales/es')).default;
    case 'fr':
      return (await import('./locales/fr')).default;
    case 'ja':
      return (await import('./locales/ja')).default;
    case 'ko':
      return (await import('./locales/ko')).default;
    case 'pt':
      return (await import('./locales/pt')).default;
    case 'tr':
      return (await import('./locales/tr')).default;
    case 'it':
      return (await import('./locales/it')).default;
    case 'ar':
      return (await import('./locales/ar')).default;
    case 'th':
      return (await import('./locales/th')).default;
    case 'vi':
      return (await import('./locales/vi')).default;
    case 'id':
      return (await import('./locales/id')).default;
    case 'zh-CN':
      return (await import('./locales/zh-CN')).default;
    case 'zh-TW':
      return (await import('./locales/zh-TW')).default;
    default:
      return (await import('./locales/en')).default;
  }
}

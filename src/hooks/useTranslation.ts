/**
 * Shared Translation Hook
 *
 * Provides type-safe translation function for components.
 * Eliminates ~150 LOC of duplicated translation logic.
 *
 * Usage:
 * ```typescript
 * const t = useTranslation(lang, {
 *   de: { title: 'Titel', description: 'Beschreibung' },
 *   en: { title: 'Title', description: 'Description' }
 * });
 *
 * t('title') // Returns 'Titel' or 'Title' based on lang
 * ```
 */

type TranslationDict = Record<string, string>;

export function useTranslation<T extends TranslationDict>(
  lang: 'de' | 'en',
  translations: Record<'de' | 'en', T>
): (key: keyof T) => string {
  return (key: keyof T): string => {
    const translated = translations[lang][key];
    return translated !== undefined ? translated : String(key);
  };
}

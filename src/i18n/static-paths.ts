import { languages } from './index';

/**
 * Generate static paths for all supported languages
 * Use this in getStaticPaths() functions in Astro pages
 * English (default locale) has no prefix, other languages have /{lang}/ prefix
 */
export function getLanguagePaths() {
  const languagePaths = Object.keys(languages)
    .filter(lang => lang !== 'en')
    .map(lang => ({ params: { lang } }));

  return [
    ...languagePaths,
    { params: { lang: undefined } } // English without prefix
  ];
}

/**
 * Generate static paths for dynamic routes with language support
 * @param items - Array of items with an 'id' field
 * @returns Array of path objects with lang and item params
 */
export function getLanguagePathsWithId<T extends { id: string }>(items: T[]) {
  const langs = Object.keys(languages);
  const paths = [];

  for (const lang of langs) {
    for (const item of items) {
      paths.push({
        params: { lang, ...item },
      });
    }
  }

  return paths;
}

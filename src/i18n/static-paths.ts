import { languages } from './index';

/**
 * Generate static paths for all supported languages
 * Use this in getStaticPaths() functions in Astro pages
 */
export function getLanguagePaths() {
  return Object.keys(languages).map((lang) => ({
    params: { lang },
  }));
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

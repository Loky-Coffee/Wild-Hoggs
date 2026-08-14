/**
 * Shared Formatter Utilities
 *
 * Centralized formatting functions for numbers, dates, etc.
 * Eliminates ~30-40 LOC of duplicated formatter logic.
 */

/**
 * Format number with locale-specific thousand separators
 *
 * @param num - The number to format
 * @param lang - Language code ('de' or 'en')
 * @returns Formatted number string
 *
 * @example
 * formatNumber(12345, 'de') // "12.345"
 * formatNumber(12345, 'en') // "12,345"
 */
export function formatNumber(num: number, lang: string): string {
  // Alle 15 Sprachen, nicht nur zwei: Vorher bekamen dreizehn Sprachfassungen
  // amerikanische Trennzeichen, weil alles ausser 'de' auf 'en-US' fiel.
  return num.toLocaleString(sprachkennung(lang));
}

/** BCP-47-Kennung fuer Intl. Unbekanntes faellt auf Englisch zurueck. */
function sprachkennung(lang: string): string {
  const karte: Record<string, string> = {
    de: 'de-DE', en: 'en-US', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT',
    tr: 'tr-TR', ja: 'ja-JP', ko: 'ko-KR', id: 'id-ID', th: 'th-TH', vi: 'vi-VN',
    'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', ar: 'ar',
  };
  return karte[lang] ?? 'en-US';
}

/**
 * Grosse Zahl kurz darstellen — "2,86 Mrd." / "2.86B" / "28.6亿".
 *
 * Es gab davon zwei Fassungen: eine mit eigenen Kuerzeln (1.50G, 1.5M, 1.5K),
 * die ihren lang-Parameter entgegennahm und ignorierte, und eine mit
 * Intl.NumberFormat. Dieselbe Zahl sah in zwei Rechnern nebeneinander
 * verschieden aus, und im deutschen Bau-Rechner stand ein Dezimalpunkt.
 */
export function formatCompact(num: number, lang: string): string {
  try {
    return new Intl.NumberFormat(sprachkennung(lang), {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return String(num);
  }
}


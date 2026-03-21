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
export function formatNumber(num: number, lang: 'de' | 'en'): string {
  return num.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
}


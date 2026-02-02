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

/**
 * Format duration in seconds to human-readable string
 *
 * @param seconds - Duration in seconds
 * @param lang - Language code ('de' or 'en')
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(3661, 'en') // "1h 1m 1s"
 * formatDuration(3661, 'de') // "1Std 1Min 1Sek"
 */
export function formatDuration(seconds: number, lang: 'de' | 'en'): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const units = lang === 'de'
    ? { h: 'Std', m: 'Min', s: 'Sek' }
    : { h: 'h', m: 'm', s: 's' };

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}${units.h}`);
  if (minutes > 0) parts.push(`${minutes}${units.m}`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}${units.s}`);

  return parts.join(' ');
}

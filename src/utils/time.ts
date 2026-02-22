/**
 * Time Utilities
 *
 * Provides timezone conversions and time calculations for Last-Z game times.
 * Last-Z uses "Apocalypse Time" which is UTC-2.
 */
import { APOCALYPSE_TIMEZONE_OFFSET } from '../config/game';

/**
 * Get current time in Apocalypse Time (UTC-2)
 *
 * @returns Date object representing current time in UTC-2 timezone
 *
 * @example
 * ```typescript
 * const apocalypseTime = getApocalypseTime();
 * console.log('Current Apocalypse Time:', apocalypseTime.toISOString());
 * ```
 */
export function getApocalypseTime(): Date {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcTime + (APOCALYPSE_TIMEZONE_OFFSET * 3600000));
}

/**
 * Format Apocalypse Time as a readable string
 *
 * @param includeSeconds - Whether to include seconds in the output
 * @returns Formatted time string (HH:MM or HH:MM:SS)
 *
 * @example
 * ```typescript
 * formatApocalypseTime() // "14:30"
 * formatApocalypseTime(true) // "14:30:45"
 * ```
 */
export function formatApocalypseTime(includeSeconds: boolean = false): string {
  const time = getApocalypseTime();
  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');

  if (includeSeconds) {
    const seconds = String(time.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  return `${hours}:${minutes}`;
}

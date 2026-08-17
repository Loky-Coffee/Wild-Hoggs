/**
 * Gründe für eine Kontosperre.
 *
 * Gespeichert wird der Code, nicht der ausformulierte Satz. Nur so lässt sich
 * dem Gesperrten der Grund in seiner eigenen Sprache anzeigen — ein Freitext
 * wäre für einen koreanischen oder arabischen Spieler unlesbar, und von 305
 * Konten sind die wenigsten deutschsprachig.
 *
 * 'sonstiges' erlaubt zusätzlich einen Freitext. Der erscheint dann so, wie er
 * eingegeben wurde — dafür gibt es keine Übersetzung.
 */
export const SPERRGRUENDE = [
  'chat_beleidigung',
  'chat_spam',
  'chat_inhalt',
  'mehrfachkonto',
  'email_unbestaetigt',
  'sonstiges',
] as const;

export type Sperrgrund = typeof SPERRGRUENDE[number];

/** i18n-Schlüssel zum Code. */
export function sperrgrundKey(code: string): string {
  return SPERRGRUENDE.includes(code as Sperrgrund)
    ? `ban.reason.${code}`
    : 'ban.reason.sonstiges';
}

/**
 * Trennt den gespeicherten Wert in Code und Freitext.
 *
 * Format in der Datenbank: "code" oder "code|freitext". Das Trennzeichen ist
 * bewusst ein senkrechter Strich — in einem Grund kommt er praktisch nie vor,
 * und alles nach dem ersten bleibt zusammen.
 */
export function zerlegeGrund(wert: string | null | undefined): { code: string; text: string } {
  if (!wert) return { code: '', text: '' };
  const i = wert.indexOf('|');
  return i === -1
    ? { code: wert, text: '' }
    : { code: wert.slice(0, i), text: wert.slice(i + 1) };
}

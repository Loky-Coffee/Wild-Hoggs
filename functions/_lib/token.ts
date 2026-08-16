/**
 * Einmal-Token für Links, die per Mail verschickt werden.
 *
 * Gemeinsam für Passwort-Reset und E-Mail-Bestätigung: Beide funktionieren
 * gleich — ein zufälliger Wert wandert in die Mail, sein Hash in die
 * Datenbank. Wer die Tabelle liest, hält nur den Hash in der Hand und kann
 * daraus keinen gültigen Link bauen.
 *
 * 32 Byte aus crypto.getRandomValues. Das ist derselbe Umfang, den auch die
 * Sitzungs-Token haben, und weit jenseits dessen, was sich durchprobieren
 * lässt.
 */

/** Neuer Token als Hex-Zeichenkette (64 Zeichen). */
export function neuerToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 als Hex — das, was gespeichert wird. */
export async function tokenHash(token: string): Promise<string> {
  const daten = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest('SHA-256', daten);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Sieht der Wert überhaupt nach einem unserer Token aus? */
export function istTokenForm(wert: unknown): wert is string {
  return typeof wert === 'string' && /^[0-9a-f]{64}$/.test(wert);
}

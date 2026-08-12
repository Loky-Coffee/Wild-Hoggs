// Grenzen für gespeicherte Rechner-Zustände.
//
// Bis hierher konnte jedes angemeldete Konto beliebig viele Zeilen in
// calculator_states schreiben, unter frei erfundenem calc_type und calc_key und
// in beliebiger Grösse — die Werte kamen ungeprüft aus Route und Query. Ein
// einziges Konto hätte damit die Datenbank vollschreiben können.
//
// Die Zahlen unten sind an den echten Daten gewählt (Stand 13.08.2026: 63
// Zeilen, grösster Zustand 1140 Bytes, höchstens 22 Zeilen je Profil), mit
// reichlich Luft nach oben. Niemand stösst im normalen Gebrauch dagegen.

/**
 * Die Rechner, die es wirklich gibt. Wird ein neuer gebaut, muss sein Name
 * hier stehen — sonst lehnt der Server das Speichern ab. scripts/check-calc-
 * types.mjs vergleicht diese Liste vor jedem Build mit den Aufrufen im
 * Frontend und bricht ab, wenn einer fehlt.
 */
export const RECHNER_TYPEN = [
  'building',
  'building-hidedupes',
  'building-saving',
  'buildspeed',
  'caravan',
  'hero-exp',
  'labspeed',
  'research',
  'tank',
] as const;

/**
 * Der Schlüssel ist meist 'main'; beim Forschungsrechner ist es die Kategorie
 * ('new_home', 'elite_troops', …). Eine feste Liste wäre hier falsch — sie
 * müsste bei jeder neuen Forschungskategorie nachgezogen werden —, deshalb nur
 * eine Form: Kleinbuchstaben, Ziffern, Unterstrich, Bindestrich.
 */
export const KEY_MUSTER = /^[a-z0-9_-]{1,40}$/;

/** 32 KB je Zustand — das 28-fache des grössten echten Werts. */
export const MAX_STATE_BYTES = 32 * 1024;

/**
 * Zeilen je Profil. Neun Rechnertypen und rund zwanzig Forschungskategorien
 * ergeben etwa dreissig; sechzig lässt Raum für neue, ohne dass ein Konto
 * unbegrenzt anlegen kann. Vorhandene Zeilen bleiben auch beim Erreichen der
 * Grenze änderbar, sonst würde ein Deckel Daten einfrieren.
 */
export const MAX_ZEILEN_PRO_PROFIL = 60;

/** Spielprofile je Konto. Aktuell hat niemand mehr als vier. */
export const MAX_PROFILE_PRO_KONTO = 10;

export function istRechnerTyp(wert: string): boolean {
  return (RECHNER_TYPEN as readonly string[]).includes(wert);
}

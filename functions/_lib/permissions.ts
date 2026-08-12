// Rechteprüfung an einer Stelle.
//
// Vorher stand in jeder Schnittstelle sinngemäß `if (user.is_admin !== 1)`.
// Das war nicht nur zehnmal derselbe Satz, es liess auch nichts dazwischen zu:
// Wer die Meldungen bearbeiten sollte, bekam alles andere zwangsläufig dazu.
//
// Wichtig: Die Häkchen im Admin-Panel sind nur die Anzeige. Verlassen darf man
// sich ausschliesslich auf die Prüfung hier — wer die Adresse einer Schnittstelle
// kennt, ruft sie sonst direkt auf.

export const RECHTE = [
  'reports.view',          // Meldungen ansehen
  'reports.resolve',       // Meldungen abschliessen
  'messages.delete',       // Chat-Nachrichten löschen
  'messages.history',      // gelöschte Nachrichten einsehen
  'users.view',            // Nutzerliste
  'users.ban',             // Konten sperren
  'users.roles',           // Rollen und Rechte vergeben
  'codes.approve',         // Discord-Funde freigeben
  'codes.manage',          // Codes anlegen und löschen
  'content.announcement',  // Ankündigung an alle
  'content.rose',          // Glücksrose setzen
  'content.changelog',     // Changelog-Einträge
  'stats.view',            // Statistik
  'system.settings',       // Systemeinstellungen
] as const;

export type Recht = typeof RECHTE[number];

// Vorlagen fürs Admin-Panel — damit nicht jedes Mal vierzehn Häkchen einzeln
// gesetzt werden müssen.
export const VORLAGEN: Record<string, Recht[]> = {
  'chat-mod': ['reports.view', 'reports.resolve', 'messages.delete', 'users.view'],
  'redakteur': ['codes.approve', 'codes.manage', 'content.announcement', 'content.rose', 'content.changelog'],
  'voll': [...RECHTE],
  'nichts': [],
};

/** Liest die gespeicherte Rechteliste. Kaputtes JSON gilt als "keine Rechte". */
export function parseRechte(roh: string | null | undefined): Recht[] {
  if (!roh) return [];
  try {
    const liste = JSON.parse(roh);
    if (!Array.isArray(liste)) return [];
    return liste.filter((r): r is Recht => RECHTE.includes(r));
  } catch {
    return [];
  }
}

/** Nur bekannte Rechte durchlassen, doppelte entfernen — für das Speichern. */
export function saubereRechte(eingabe: unknown): Recht[] {
  if (!Array.isArray(eingabe)) return [];
  return [...new Set(eingabe.filter((r): r is Recht => RECHTE.includes(r as Recht)))];
}

interface KontoMitRechten {
  is_admin?: number;
  permissions?: string | null;
}

/**
 * Darf dieses Konto das?
 *
 * Administratoren dürfen alles — ohne diese Ausnahme könnte man sich mit einem
 * unbedachten Häkchen selbst aus der Verwaltung aussperren.
 */
export function darf(user: KontoMitRechten | null | undefined, recht: Recht): boolean {
  if (!user) return false;
  if (user.is_admin === 1) return true;
  return parseRechte(user.permissions).includes(recht);
}

/** Darf das Konto mindestens eines dieser Rechte? */
export function darfEines(user: KontoMitRechten | null | undefined, ...rechte: Recht[]): boolean {
  return rechte.some((r) => darf(user, r));
}

/**
 * Abkürzung für Schnittstellen: liefert eine fertige Antwort, wenn das Recht
 * fehlt — sonst null.
 *
 *     const nein = verlangt(user, 'codes.approve');
 *     if (nein) return nein;
 */
export function verlangt(user: KontoMitRechten | null | undefined, recht: Recht): Response | null {
  if (darf(user, recht)) return null;
  return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
}

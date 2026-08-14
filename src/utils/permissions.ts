// Rechteprüfung für die Oberfläche.
//
// Spiegelt functions/_lib/permissions.ts, entscheidet aber nichts: Hier wird
// nur bestimmt, was angezeigt wird. Ob eine Aktion erlaubt ist, prüft
// ausschliesslich der Server — sonst genügte es, die Adresse direkt aufzurufen.

export type Recht =
  | 'reports.view' | 'reports.resolve'
  | 'messages.delete' | 'messages.history'
  | 'users.view' | 'users.ban' | 'users.roles'
  | 'codes.approve' | 'codes.manage'
  | 'content.announcement' | 'content.rose' | 'content.changelog'
  | 'stats.view' | 'system.settings';

interface KontoMitRechten {
  is_admin?: number;
  permissions?: string | null;
}

export function parseRechte(roh: string | null | undefined): string[] {
  if (!roh) return [];
  try {
    const liste = JSON.parse(roh);
    return Array.isArray(liste) ? liste.filter((r) => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

/** Administratoren dürfen alles — sonst könnte man sich selbst aussperren. */
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
 * Hat das Konto ueberhaupt irgendein Recht?
 *
 * Fuer die Frage, ob der Zugang zum Verwaltungsbereich angeboten wird. Der
 * Server entscheidet allein ueber is_admin und die Rechteliste; die Rolle
 * "Moderator" ist nur eine Beschriftung. Wer danach fragte, verbarg vergebene
 * Rechte hinter einem Flag, das der Server gar nicht auswertet.
 */
export function hatIrgendeinRecht(user: KontoMitRechten | null | undefined): boolean {
  if (!user) return false;
  if (user.is_admin === 1) return true;
  return parseRechte(user.permissions).length > 0;
}

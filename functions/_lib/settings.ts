// Betriebseinstellungen der Seite.
//
// Liegen als Schlüssel/Wert in app_settings — derselben Tabelle, in der auch
// die Glücksrose und der Discord-Lesezeiger stehen. Alles hier beeinflusst,
// wie sich die Seite verhält; Inhalte gehören nicht her.
//
// Jede Einstellung hat einen Standardwert. Fehlt der Eintrag in der Datenbank,
// gilt der Standard — so bleibt die Seite auch dann bedienbar, wenn nie jemand
// etwas eingestellt hat.

export interface Einstellung {
  key: string;
  typ: 'schalter' | 'zahl';
  standard: number;
  min?: number;
  max?: number;
}

export const EINSTELLUNGEN: Einstellung[] = [
  // Zugang
  { key: 'registration_open', typ: 'schalter', standard: 1 },
  // Chat
  { key: 'chat_enabled',      typ: 'schalter', standard: 1 },
  { key: 'chat_max_length',   typ: 'zahl',     standard: 500, min: 50,  max: 2000 },
  { key: 'chat_rate_limit',   typ: 'zahl',     standard: 10,  min: 1,   max: 120 },
];

const NACH_KEY = new Map(EINSTELLUNGEN.map((e) => [e.key, e]));

export type Werte = Record<string, number>;

/** Alle Einstellungen mit Standardwerten für alles, was nicht gespeichert ist. */
export async function ladeEinstellungen(db: any): Promise<Werte> {
  const werte: Werte = {};
  for (const e of EINSTELLUNGEN) werte[e.key] = e.standard;

  try {
    const platzhalter = EINSTELLUNGEN.map(() => '?').join(',');
    const { results } = await db
      .prepare(`SELECT key, value FROM app_settings WHERE key IN (${platzhalter})`)
      .bind(...EINSTELLUNGEN.map((e) => e.key))
      .all();

    for (const r of results ?? []) {
      const zahl = Number(r.value);
      if (Number.isFinite(zahl)) werte[r.key] = zahl;
    }
  } catch {
    // Fehlt die Tabelle oder hakt die Datenbank, gelten die Standardwerte —
    // eine kaputte Einstellung darf die Seite nicht lahmlegen.
  }
  return werte;
}

/** Eine einzelne Einstellung — für Stellen, die nur eine brauchen. */
export async function ladeEinstellung(db: any, key: string): Promise<number> {
  const e = NACH_KEY.get(key);
  const standard = e?.standard ?? 0;
  try {
    const row = await db.prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .bind(key).first() as { value: string } | null;
    const zahl = Number(row?.value);
    return Number.isFinite(zahl) ? zahl : standard;
  } catch {
    return standard;
  }
}

/**
 * Prüft und begrenzt einen eingehenden Wert.
 * Liefert null, wenn der Schlüssel unbekannt oder der Wert unbrauchbar ist.
 */
export function pruefeWert(key: string, roh: unknown): number | null {
  const e = NACH_KEY.get(key);
  if (!e) return null;

  // null und undefined vor Number() abfangen: Number(null) ist 0, und eine
  // Zeichengrenze würde damit stillschweigend auf ihr Minimum fallen, statt
  // dass die unsinnige Angabe verworfen wird.
  if (roh === null || roh === undefined || roh === '') return null;

  const zahl = Number(roh);
  if (!Number.isFinite(zahl)) return null;

  if (e.typ === 'schalter') return zahl ? 1 : 0;

  const ganz = Math.round(zahl);
  if (e.min !== undefined && ganz < e.min) return e.min;
  if (e.max !== undefined && ganz > e.max) return e.max;
  return ganz;
}

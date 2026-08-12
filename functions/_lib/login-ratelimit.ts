// Bremse gegen das Durchprobieren von Passwörtern.
//
// Zwei Zähler mit unterschiedlicher Aufgabe:
//
//   "ip|e-mail"  — 8 Versuche je 15 Minuten. Schützt ein einzelnes Konto.
//   "ip"         — 30 Versuche je 15 Minuten. Greift, wenn jemand viele
//                  verschiedene Adressen durchprobiert.
//
// Warum die Adresse mit der IP zusammen gezählt wird und nicht allein: Sonst
// könnte jeder, der die E-Mail eines Mitglieds kennt, dieses Mitglied gezielt
// aussperren, indem er absichtlich falsche Passwörter schickt. In der
// Kombination sperrt er nur sich selbst aus.
//
// Warum acht statt der üblichen fünf: Wer sein Passwort halb vergessen hat,
// probiert ein paar Varianten. Acht Versuche kosten einen Angreifer nichts,
// ersparen einem echten Mitglied aber Ärger. Ein erfolgreicher Login setzt
// beide Zähler sofort zurück.
//
// Die Sperre dauert höchstens 15 Minuten und läuft von selbst ab — es gibt
// keinen Zustand, aus dem sich jemand nicht selbst befreien kann.

const FENSTER_MS       = 15 * 60_000;
const MAX_JE_KONTO     = 8;
const MAX_JE_IP        = 30;

// Registrierung: eigenes, deutlich längeres Fenster.
//
// Zehn Neuanmeldungen je Stunde und Absender sind grosszügig gewählt. Hinter
// einer IP können mehrere Personen stehen — Mobilfunk fasst ganze Regionen
// zusammen, und wenn nach einem Discord-Beitrag eine Allianz gemeinsam
// beitritt, kommen die Anmeldungen im Zweifel aus demselben Netz. Ein Skript,
// das Wegwerfkonten anlegt, überschreitet die Grenze trotzdem sofort.
const REG_FENSTER_MS   = 60 * 60_000;
const MAX_REG_JE_IP    = 10;

export interface LoginLimit {
  erlaubt: boolean;
  wartenSek?: number;
}

function sqliteZeit(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function alsMs(sqlite: string): number {
  // SQLite liefert UTC ohne Kennzeichnung — ohne das 'Z' würde der Wert als
  // Ortszeit gelesen und die Sperre je nach Serverzone falsch berechnet.
  const ms = new Date(sqlite.includes('T') ? sqlite : sqlite.replace(' ', 'T') + 'Z').getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Absender bestimmen. Hinter Cloudflare steht die echte Adresse im Header. */
export function ipVon(request: Request): string {
  return request.headers.get('CF-Connecting-IP')
      ?? request.headers.get('X-Forwarded-For')?.split(',')[0].trim()
      ?? 'unbekannt';
}

/**
 * Prüft beide Zähler, ohne sie hochzuzählen.
 *
 * Wirft nicht: Hakt die Datenbank, wird der Login durchgelassen. Eine
 * kaputte Bremse darf nicht dazu führen, dass sich niemand mehr anmelden kann.
 */
export async function pruefeLoginLimit(db: any, ip: string, email: string): Promise<LoginLimit> {
  const jetzt = Date.now();
  const grenze = sqliteZeit(jetzt - FENSTER_MS);

  try {
    const { results } = await db.prepare(
      `SELECT key, window_start, attempts FROM login_attempts
        WHERE key IN (?, ?) AND window_start > ?`
    ).bind(`${ip}|${email}`, ip, grenze).all() as {
      results: Array<{ key: string; window_start: string; attempts: number }>
    };

    for (const r of results ?? []) {
      const max = r.key.includes('|') ? MAX_JE_KONTO : MAX_JE_IP;
      if (r.attempts >= max) {
        const frei = alsMs(r.window_start) + FENSTER_MS;
        return { erlaubt: false, wartenSek: Math.max(1, Math.ceil((frei - jetzt) / 1000)) };
      }
    }
    return { erlaubt: true };
  } catch {
    return { erlaubt: true };
  }
}

/**
 * Dasselbe für die Registrierung — ein Zähler, längeres Fenster.
 *
 * Der Schlüssel trägt das Präfix "reg|", damit sich Anmelde- und
 * Registrierungsversuche nicht gegenseitig blockieren: Wer sein Passwort
 * vergessen hat, soll sich trotzdem noch ein Konto anlegen können.
 */
export async function pruefeRegisterLimit(db: any, ip: string): Promise<LoginLimit> {
  const jetzt = Date.now();
  const grenze = sqliteZeit(jetzt - REG_FENSTER_MS);

  try {
    const row = await db.prepare(
      `SELECT window_start, attempts FROM login_attempts WHERE key = ? AND window_start > ?`
    ).bind(`reg|${ip}`, grenze).first() as { window_start: string; attempts: number } | null;

    if (row && row.attempts >= MAX_REG_JE_IP) {
      const frei = alsMs(row.window_start) + REG_FENSTER_MS;
      return { erlaubt: false, wartenSek: Math.max(1, Math.ceil((frei - jetzt) / 1000)) };
    }
    return { erlaubt: true };
  } catch {
    return { erlaubt: true };
  }
}

/** Einen Registrierungsversuch mitzählen — gelungen wie misslungen. */
export async function zaehleRegistrierung(db: any, ip: string): Promise<void> {
  const jetzt    = Date.now();
  const jetztStr = sqliteZeit(jetzt);
  const grenze   = sqliteZeit(jetzt - REG_FENSTER_MS);

  try {
    await db.prepare(
      `INSERT INTO login_attempts (key, window_start, attempts) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         attempts     = CASE WHEN login_attempts.window_start > ? THEN login_attempts.attempts + 1 ELSE 1 END,
         window_start = CASE WHEN login_attempts.window_start > ? THEN login_attempts.window_start ELSE ? END`
    ).bind(`reg|${ip}`, jetztStr, grenze, grenze, jetztStr).run();
  } catch { /* Bremse ausgefallen — die Registrierung läuft weiter */ }
}

/** Nach einem Fehlversuch beide Zähler erhöhen. */
export async function zaehleFehlversuch(db: any, ip: string, email: string): Promise<void> {
  const jetzt = Date.now();
  const jetztStr = sqliteZeit(jetzt);
  const grenze   = sqliteZeit(jetzt - FENSTER_MS);

  // Ein abgelaufenes Fenster beginnt neu, statt endlos weiterzuzählen —
  // sonst bliebe jemand nach einem alten Tippfehler dauerhaft nahe der Grenze.
  const hoch = (key: string) => db.prepare(
    `INSERT INTO login_attempts (key, window_start, attempts) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       attempts     = CASE WHEN login_attempts.window_start > ? THEN login_attempts.attempts + 1 ELSE 1 END,
       window_start = CASE WHEN login_attempts.window_start > ? THEN login_attempts.window_start ELSE ? END`
  ).bind(key, jetztStr, grenze, grenze, jetztStr);

  try {
    await db.batch([hoch(`${ip}|${email}`), hoch(ip)]);
  } catch { /* Bremse ausgefallen — der Login selbst läuft weiter */ }
}

/**
 * Nach erfolgreichem Login aufräumen.
 *
 * Räumt zugleich abgelaufene Zeilen anderer Absender mit weg. So bleibt die
 * Tabelle klein, ohne dass es dafür einen eigenen Zeitplan braucht.
 */
export async function loginGelungen(db: any, ip: string, email: string): Promise<void> {
  const grenze = sqliteZeit(Date.now() - FENSTER_MS);
  try {
    await db.batch([
      db.prepare(`DELETE FROM login_attempts WHERE key IN (?, ?)`).bind(`${ip}|${email}`, ip),
      db.prepare(`DELETE FROM login_attempts WHERE window_start <= ?`).bind(grenze),
    ]);
  } catch { /* nicht kritisch */ }
}

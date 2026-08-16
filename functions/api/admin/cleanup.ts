/**
 * Aufräumen verwaister Konten — Vorschau und Ausführung.
 *
 * GET  liefert die Kandidaten samt Begründung. Ändert nichts.
 * POST löscht genau die Konten, deren Kennungen übergeben werden.
 *
 * Bewusst kein Zeitplan, keine Automatik: Gelöscht wird, was ein Mensch
 * ausgewählt hat. Ein Fehler in der Bedingung würde sonst unbemerkt echte
 * Konten mitnehmen — und davon gibt es 303, von denen 175 im letzten Monat
 * aktiv waren.
 *
 * Ein Konto gilt als Kandidat, wenn ALLE Bedingungen zutreffen:
 *
 *   1. Adresse nicht bestätigt
 *   2. Frist abgelaufen (Registrierung bzw. Stichtag + FRIST_TAGE)
 *   3. seit STILL_TAGE nicht mehr gesehen
 *   4. weder Administrator noch Moderator
 *
 * Punkt 3 ist der wichtigste. Nicht-Bestätigung allein misst nicht, ob jemand
 * weg ist: Viele benutzen für Spiele eine Adresse, in die sie selten schauen.
 * Wer die Seite benutzt, ist da — unabhängig davon, ob er seine Mail liest.
 */
import { getToken, validateSession } from '../../_lib/auth';
import { verlangt } from '../../_lib/permissions';

/** Tage nach Fristbeginn, bis eine fehlende Bestätigung zählt. */
const FRIST_TAGE = 30;

/** Tage ohne Lebenszeichen, bis ein Konto als verwaist gilt. */
const STILL_TAGE = 90;

const ANON = 'Gelöschter Nutzer';

function kandidatenAbfrage() {
  return `
    SELECT u.id, u.username, u.email, u.created_at, u.last_seen,
           COALESCE(u.email_verified, 0) AS email_verified,
           MAX(u.created_at, COALESCE(
             (SELECT value FROM app_settings WHERE key = 'email_verification_since'),
             u.created_at
           )) AS frist_beginn,
           (SELECT COUNT(*) FROM chat_global g WHERE g.user_id = u.id) AS msg_global,
           (SELECT COUNT(*) FROM chat_server v WHERE v.user_id = u.id) AS msg_server,
           (SELECT COUNT(*) FROM game_profiles p WHERE p.user_id = u.id) AS profile,
           (SELECT COUNT(*) FROM calculator_states c WHERE c.user_id = u.id) AS rechnerstaende
      FROM users u
     WHERE COALESCE(u.email_verified, 0) = 0
       AND u.is_admin != 1
       AND COALESCE(u.is_moderator, 0) != 1
       AND datetime(MAX(u.created_at, COALESCE(
             (SELECT value FROM app_settings WHERE key = 'email_verification_since'),
             u.created_at
           )), '+${FRIST_TAGE} days') < datetime('now')
       AND (u.last_seen IS NULL OR u.last_seen < datetime('now', '-${STILL_TAGE} days'))
     ORDER BY u.last_seen ASC NULLS FIRST, u.created_at ASC`;
}

// GET /api/admin/cleanup — Vorschau
export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const user = await validateSession(DB, getToken(ctx.request) ?? '');
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  if (user.is_admin !== 1) return Response.json({ error: 'Nur für Administratoren' }, { status: 403 });

  const { results } = await DB.prepare(kandidatenAbfrage()).all();

  // Zahlen fürs Verhältnis: Wie viele Konten gibt es überhaupt, wie viele
  // davon sind unbestätigt, wie viele davon sind trotzdem aktiv. Ohne diese
  // Einordnung sieht eine Kandidatenliste nach mehr aus, als sie ist.
  const zahlen = await DB.prepare(
    `SELECT COUNT(*) AS gesamt,
            SUM(CASE WHEN COALESCE(email_verified,0)=1 THEN 1 ELSE 0 END) AS bestaetigt,
            SUM(CASE WHEN COALESCE(email_verified,0)=0
                      AND last_seen > datetime('now','-30 days') THEN 1 ELSE 0 END) AS unbestaetigt_aber_aktiv
       FROM users`
  ).first();

  return Response.json(
    {
      kandidaten: results ?? [],
      zahlen,
      regeln: { frist_tage: FRIST_TAGE, still_tage: STILL_TAGE },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// POST /api/admin/cleanup — löscht die übergebenen Konten
export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;
  const user = await validateSession(DB, getToken(ctx.request) ?? '');
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  if (user.is_admin !== 1) return Response.json({ error: 'Nur für Administratoren' }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({}));
  const ids: unknown = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: 'Keine Konten ausgewählt' }, { status: 400 });
  }
  if (ids.length > 200) {
    return Response.json({ error: 'Höchstens 200 auf einmal' }, { status: 400 });
  }

  // Jede übergebene Kennung muss die Bedingung heute noch erfüllen. Zwischen
  // Anzeige und Klick können Minuten liegen — in denen jemand die Seite
  // besucht oder seine Adresse bestätigt haben kann. Ohne diese zweite Prüfung
  // liesse sich über diesen Endpunkt ausserdem jedes beliebige Konto löschen,
  // indem man einfach eine andere Kennung schickt.
  const { results } = await DB.prepare(kandidatenAbfrage()).all();
  const erlaubt = new Set((results ?? []).map((r: any) => r.id));

  const zuLoeschen = (ids as string[]).filter(id => erlaubt.has(id));
  const abgelehnt = (ids as string[]).filter(id => !erlaubt.has(id));

  for (const id of zuLoeschen) {
    // Dieselbe Reihenfolge wie beim Löschen des eigenen Kontos in
    // functions/api/user/account.ts: Namen in offenen Kanälen überschreiben,
    // damit Gespräche lesbar bleiben, alles Persönliche entfernen.
    await DB.batch([
      DB.prepare(`UPDATE chat_global SET username = ?, faction = NULL, server = NULL, user_id = NULL WHERE user_id = ?`).bind(ANON, id),
      DB.prepare(`UPDATE chat_server SET username = ?, faction = NULL, user_id = NULL WHERE user_id = ?`).bind(ANON, id),
      DB.prepare(`DELETE FROM chat_pm WHERE sender_id = ? OR receiver_id = ?`).bind(id, id),
      DB.prepare(`DELETE FROM chat_reports WHERE reported_by = ?`).bind(id),
      DB.prepare(`DELETE FROM chat_rate_limits WHERE user_id = ?`).bind(id),
      DB.prepare(`DELETE FROM calculator_states WHERE user_id = ?`).bind(id),
      DB.prepare(`DELETE FROM game_profiles WHERE user_id = ?`).bind(id),
      DB.prepare(`DELETE FROM email_verifications WHERE user_id = ?`).bind(id),
      DB.prepare(`DELETE FROM password_resets WHERE user_id = ?`).bind(id),
      DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id),
      DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id),
    ]);
  }

  return Response.json({ geloescht: zuLoeschen.length, abgelehnt: abgelehnt.length });
}

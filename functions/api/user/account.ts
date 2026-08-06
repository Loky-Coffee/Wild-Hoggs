// DELETE /api/user/account — eigenes Konto endgültig löschen
//
// Verlangt das Passwort zur Bestätigung: Ein Klick allein (oder ein fremder,
// offener Browser) darf ein Konto nicht auslöschen.
//
// Was passiert mit den Daten:
//   • Spielprofile, gespeicherte Rechnerstände, private Nachrichten,
//     Meldungen und Sitzungen verschwinden — die Datenbank räumt das über
//     ON DELETE CASCADE selbst auf.
//   • Chat-Nachrichten bleiben stehen, aber anonymisiert. Der Name steht dort
//     als Text in der Zeile, wird also aktiv überschrieben — sonst bliebe er
//     trotz gelöschtem Konto lesbar. Gespräche behalten so ihren Verlauf,
//     ohne die Person erkennbar zu lassen.

import { getToken, validateSession, verifyPassword } from '../../_lib/auth';

const ANON = 'Gelöschter Nutzer';

export async function onRequestDelete(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password) {
    return Response.json({ error: 'Passwort erforderlich' }, { status: 400 });
  }

  const row = await DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.user_id).first() as { password_hash: string } | null;
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return Response.json({ error: 'Passwort falsch' }, { status: 403 });
  }

  // Die Seite darf nicht ohne Verwaltung dastehen.
  if (user.is_admin === 1) {
    const others = await DB.prepare(
      'SELECT COUNT(*) AS cnt FROM users WHERE is_admin = 1 AND id != ?'
    ).bind(user.user_id).first() as { cnt: number } | null;
    if ((others?.cnt ?? 0) === 0) {
      return Response.json(
        { error: 'Das letzte Administratorkonto kann nicht gelöscht werden.' },
        { status: 409 },
      );
    }
  }

  const id = user.user_id;

  // Alles einzeln löschen statt auf ON DELETE CASCADE zu vertrauen: SQLite
  // erzwingt Fremdschlüssel nur bei eingeschaltetem PRAGMA foreign_keys, und
  // beim Testen blieben so tatsächlich Spielprofile und Sitzungen zurück.
  // Explizit ist hier auch schlicht nachvollziehbarer — man sieht, was ein
  // gelöschtes Konto hinterlässt.
  await DB.batch([
    // Namen in den offenen Kanälen überschreiben. Die Zeilen bleiben stehen,
    // damit Gespräche nicht auseinanderfallen, die Person ist aber weg.
    DB.prepare(`UPDATE chat_global SET username = ?, faction = NULL, server = NULL, user_id = NULL WHERE user_id = ?`)
      .bind(ANON, id),
    DB.prepare(`UPDATE chat_server SET username = ?, faction = NULL, user_id = NULL WHERE user_id = ?`)
      .bind(ANON, id),

    // Alles, was ausschließlich dieser Person gehört, verschwindet.
    DB.prepare(`DELETE FROM chat_pm WHERE sender_id = ? OR receiver_id = ?`).bind(id, id),
    DB.prepare(`DELETE FROM chat_reports WHERE reported_by = ?`).bind(id),
    DB.prepare(`DELETE FROM chat_rate_limits WHERE user_id = ?`).bind(id),
    DB.prepare(`DELETE FROM calculator_states WHERE user_id = ?`).bind(id),
    DB.prepare(`DELETE FROM game_profiles WHERE user_id = ?`).bind(id),
    DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id),
    DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id),
  ]);

  return Response.json({ success: true });
}

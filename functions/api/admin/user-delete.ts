/**
 * Konto endgültig löschen (nur Administratoren).
 *
 * Anders als das Aufräumen verwaister Konten gilt hier keine Bedingung: Was
 * hier steht, wird gelöscht. Deshalb eng gefasst — nur is_admin, nicht über
 * ein Einzelrecht, und mit Protokolleintrag.
 *
 * Für Ärger im Chat ist Sperren die bessere Antwort (user-ban.ts): Es lässt
 * sich zurücknehmen, und die Nachrichten bleiben zuordenbar.
 *
 * Was bleibt: Öffentliche Chatnachrichten. Sie verlieren den Namen, bleiben
 * aber stehen — sonst zerfielen Gespräche, in denen jemand geantwortet hat.
 * Genau so verfährt auch das Löschen des eigenen Kontos.
 */
import { getToken, validateSession } from '../../_lib/auth';

const ANON = 'Gelöschter Nutzer';

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;

  const admin = await validateSession(DB, getToken(ctx.request) ?? '');
  if (!admin) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  if (admin.is_admin !== 1) {
    return Response.json({ error: 'Nur für Administratoren' }, { status: 403 });
  }

  const body = await ctx.request.json().catch(() => ({}));
  const userId = String(body?.user_id ?? '');

  if (!userId) return Response.json({ error: 'user_id erforderlich' }, { status: 400 });
  if (userId === admin.user_id) {
    return Response.json({ error: 'Eigenes Konto nicht löschbar' }, { status: 400 });
  }

  const ziel = await DB.prepare(
    'SELECT id, username, email, is_admin FROM users WHERE id = ?'
  ).bind(userId).first() as
    { id: string; username: string; email: string; is_admin: number } | null;

  if (!ziel) return Response.json({ error: 'Konto nicht gefunden' }, { status: 404 });

  // Ein Administrator wird nicht über diesen Weg gelöscht. Wer das wirklich
  // will, nimmt ihm zuerst die Rolle — dann ist es ein bewusster zweiter
  // Schritt und kein Versehen in der Zeile darüber.
  if (ziel.is_admin === 1) {
    return Response.json(
      { error: 'Administratoren lassen sich so nicht löschen — zuerst die Rolle entziehen' },
      { status: 403 },
    );
  }

  // Dieselbe Reihenfolge wie beim Löschen des eigenen Kontos
  // (functions/api/user/account.ts) und beim Aufräumen.
  await DB.batch([
    DB.prepare(`UPDATE chat_global SET username = ?, faction = NULL, server = NULL, user_id = NULL WHERE user_id = ?`).bind(ANON, userId),
    DB.prepare(`UPDATE chat_server SET username = ?, faction = NULL, user_id = NULL WHERE user_id = ?`).bind(ANON, userId),
    DB.prepare(`DELETE FROM chat_pm WHERE sender_id = ? OR receiver_id = ?`).bind(userId, userId),
    DB.prepare(`DELETE FROM chat_reports WHERE reported_by = ?`).bind(userId),
    DB.prepare(`DELETE FROM chat_rate_limits WHERE user_id = ?`).bind(userId),
    DB.prepare(`DELETE FROM calculator_states WHERE user_id = ?`).bind(userId),
    DB.prepare(`DELETE FROM game_profiles WHERE user_id = ?`).bind(userId),
    DB.prepare(`DELETE FROM email_verifications WHERE user_id = ?`).bind(userId),
    DB.prepare(`DELETE FROM password_resets WHERE user_id = ?`).bind(userId),
    DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId),
    DB.prepare(`DELETE FROM users WHERE id = ?`).bind(userId),
  ]);

  console.log(
    `[admin] ${admin.username} (${admin.user_id}) hat das Konto ` +
    `${ziel.username} (${userId}, ${ziel.email}) geloescht`
  );

  return Response.json({ ok: true, geloescht: ziel.username });
}

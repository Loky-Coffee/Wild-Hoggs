/**
 * Konto sperren und entsperren.
 *
 * Sperren statt löschen ist bei Ärger im Chat die richtige Antwort: Es lässt
 * sich zurücknehmen, und die Nachrichten bleiben zuordenbar, falls sich später
 * herausstellt, dass jemand zu Unrecht getroffen wurde.
 *
 * Was eine Sperre bewirkt:
 *   - Anmelden nicht mehr möglich (login.ts prüft banned_at)
 *   - alle offenen Sitzungen werden beendet, also auch der laufende Chat
 *   - offene Passwort- und Bestätigungslinks verfallen
 *
 * Wer darf: 'users.ban'. Administratoren lassen sich damit nicht sperren —
 * sonst könnte ein Moderator mit diesem Recht die Verwaltung lahmlegen.
 */
import { getToken, validateSession } from '../../_lib/auth';
import { verlangt } from '../../_lib/permissions';

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;

  const admin = await validateSession(DB, getToken(ctx.request) ?? '');
  if (!admin) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const nein = verlangt(admin, 'users.ban');
  if (nein) return nein;

  const body = await ctx.request.json().catch(() => ({}));
  const userId = String(body?.user_id ?? '');
  const sperren = body?.sperren !== false;          // Standard: sperren
  const grund = String(body?.grund ?? '').trim().slice(0, 200);

  if (!userId) return Response.json({ error: 'user_id erforderlich' }, { status: 400 });

  if (userId === admin.user_id) {
    return Response.json({ error: 'Eigenes Konto nicht sperrbar' }, { status: 400 });
  }

  const ziel = await DB.prepare(
    'SELECT id, username, is_admin, banned_at FROM users WHERE id = ?'
  ).bind(userId).first() as
    { id: string; username: string; is_admin: number; banned_at: string | null } | null;

  if (!ziel) return Response.json({ error: 'Konto nicht gefunden' }, { status: 404 });

  // Ein Administrator ist gegen Sperren geschützt. Andernfalls genügte das
  // Recht 'users.ban', um die gesamte Verwaltung auszusperren.
  if (ziel.is_admin === 1) {
    return Response.json({ error: 'Administratoren lassen sich nicht sperren' }, { status: 403 });
  }

  if (sperren) {
    await DB.batch([
      DB.prepare(`UPDATE users
                     SET banned_at = datetime('now'), banned_by = ?, ban_grund = ?
                   WHERE id = ?`).bind(admin.username, grund || null, userId),
      // Laufende Sitzungen beenden — sonst bliebe jemand bis zum Ablauf des
      // Zugangs weiter im Chat, obwohl er gesperrt ist.
      DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
      DB.prepare(`UPDATE password_resets SET used_at = datetime('now')
                   WHERE user_id = ? AND used_at IS NULL`).bind(userId),
      DB.prepare(`UPDATE email_verifications SET used_at = datetime('now')
                   WHERE user_id = ? AND used_at IS NULL`).bind(userId),
    ]);
    console.log(`[admin] ${admin.username} hat ${ziel.username} (${userId}) gesperrt` +
      (grund ? `: ${grund}` : ''));
  } else {
    await DB.prepare(`UPDATE users
                         SET banned_at = NULL, banned_by = NULL, ban_grund = NULL
                       WHERE id = ?`).bind(userId).run();
    console.log(`[admin] ${admin.username} hat die Sperre von ${ziel.username} (${userId}) aufgehoben`);
  }

  return Response.json({ ok: true, gesperrt: sperren });
}

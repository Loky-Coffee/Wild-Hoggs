/**
 * Bestätigungslink einlösen.
 *
 * Braucht keine Sitzung: Der Link wird oft in einem anderen Programm geöffnet
 * (Mail-App auf dem Handy), wo niemand angemeldet ist. Der Token selbst ist
 * der Nachweis.
 */
import { tokenHash, istTokenForm } from '../../_lib/token';

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;

  const body = await ctx.request.json().catch(() => ({}));
  const token = body?.token;

  if (!istTokenForm(token)) {
    return Response.json({ error: 'invalid_token' }, { status: 400 });
  }

  try {
    const hash = await tokenHash(token);

    const eintrag = await DB.prepare(
      `SELECT id, user_id, email, used_at, expires_at
         FROM email_verifications WHERE token_hash = ?`
    ).bind(hash).first() as
      { id: string; user_id: string; email: string; used_at: string | null; expires_at: string } | null;

    if (!eintrag || eintrag.used_at) {
      return Response.json({ error: 'invalid_token' }, { status: 400 });
    }

    const abgelaufen = await DB.prepare(`SELECT datetime('now') > ? AS vorbei`)
      .bind(eintrag.expires_at).first() as { vorbei: number };
    if (abgelaufen?.vorbei) {
      return Response.json({ error: 'invalid_token' }, { status: 400 });
    }

    // Adresse zwischenzeitlich geändert? Dann bestätigt dieser Link die
    // falsche. Der Eintrag merkt sich, an welche Adresse er ging.
    const user = await DB.prepare('SELECT email FROM users WHERE id = ?')
      .bind(eintrag.user_id).first() as { email: string } | null;

    if (!user || user.email.toLowerCase() !== eintrag.email.toLowerCase()) {
      return Response.json({ error: 'adresse_geaendert' }, { status: 400 });
    }

    await DB.batch([
      DB.prepare(`UPDATE users
                     SET email_verified = 1,
                         email_verified_at = datetime('now')
                   WHERE id = ?`).bind(eintrag.user_id),
      DB.prepare(`UPDATE email_verifications SET used_at = datetime('now') WHERE id = ?`)
        .bind(eintrag.id),
      // Übrige offene Links desselben Kontos verfallen mit.
      DB.prepare(`UPDATE email_verifications SET used_at = datetime('now')
                   WHERE user_id = ? AND used_at IS NULL`).bind(eintrag.user_id),
    ]);

    return Response.json({ ok: true });
  } catch (e) {
    console.error('verify:', e);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}

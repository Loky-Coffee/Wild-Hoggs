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

    const user = await DB.prepare('SELECT email FROM users WHERE id = ?')
      .bind(eintrag.user_id).first() as { email: string } | null;

    if (!user) {
      return Response.json({ error: 'invalid_token' }, { status: 400 });
    }

    // eintrag.email ist die Adresse, die dieser Link bestätigt — nicht
    // zwingend die, die gerade am Konto steht.
    //
    // Bei der Registrierung sind beide gleich. Bei einer Adressänderung ist
    // eintrag.email die NEUE: Sie wird erst in diesem Moment übernommen, weil
    // erst der Klick beweist, dass das Postfach erreichbar ist. Bis dahin
    // bleibt die alte Adresse stehen — wer sich vertippt, sperrt sich damit
    // nicht selbst aus.
    //
    // Zwischenzeitlich veraltete Links sind kein Problem: change-email
    // entwertet beim Anfordern alle offenen Links des Kontos, es kann also
    // immer nur der zuletzt angeforderte eingelöst werden.
    const wechsel = user.email.toLowerCase() !== eintrag.email.toLowerCase();

    // Zwischen Anfordern und Einlösen kann jemand anderes dieselbe Adresse
    // registriert haben. Dann darf sie hier nicht ein zweites Mal vergeben
    // werden — email hat einen eindeutigen Index, der Einfügeversuch würde
    // ohnehin scheitern, aber mit einer nichtssagenden Fehlermeldung.
    if (wechsel) {
      const belegt = await DB.prepare(
        'SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?'
      ).bind(eintrag.email, eintrag.user_id).first();
      if (belegt) {
        return Response.json({ error: 'adresse_belegt' }, { status: 409 });
      }
    }

    await DB.batch([
      DB.prepare(`UPDATE users
                     SET email = ?,
                         email_verified = 1,
                         email_verified_at = datetime('now')
                   WHERE id = ?`).bind(eintrag.email, eintrag.user_id),
      DB.prepare(`UPDATE email_verifications SET used_at = datetime('now') WHERE id = ?`)
        .bind(eintrag.id),
      // Übrige offene Links desselben Kontos verfallen mit.
      DB.prepare(`UPDATE email_verifications SET used_at = datetime('now')
                   WHERE user_id = ? AND used_at IS NULL`).bind(eintrag.user_id),
    ]);

    return Response.json({ ok: true, gewechselt: wechsel, email: eintrag.email });
  } catch (e) {
    console.error('verify:', e);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}

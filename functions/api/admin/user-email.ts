/**
 * E-Mail-Adresse eines fremden Kontos berichtigen (nur Administratoren).
 *
 * Gedacht für den Fall, den es tatsächlich gibt: Zwei der 305 Konten haben
 * einen Tippfehler in der Adresse (gmai.com, naver.con) und können deshalb
 * weder eine Bestätigung noch einen Passwort-Reset empfangen. Wer sich nicht
 * meldet, sitzt fest — dann muss jemand von Hand nachhelfen können.
 *
 * Bewusst eng gehalten:
 *
 * - Nur is_admin, nicht über ein Einzelrecht. Wer fremde Adressen setzen kann,
 *   kann jedes Konto übernehmen: neue Adresse eintragen, Passwort vergessen,
 *   fertig. Das ist keine Moderationsaufgabe.
 *
 * - Die neue Adresse gilt sofort, aber als UNBESTÄTIGT. Der Betroffene bekommt
 *   den Hinweisbalken und muss selbst bestätigen. Ein Administrator kann also
 *   niemandem eine bestätigte Adresse unterschieben.
 *
 * - Jede Änderung landet im Protokoll, mit beiden Adressen und dem Konto, das
 *   sie vorgenommen hat.
 */
import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;

  const admin = await validateSession(DB, getToken(ctx.request) ?? '');
  if (!admin) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  if (admin.is_admin !== 1) {
    return Response.json({ error: 'Nur für Administratoren' }, { status: 403 });
  }

  const body = await ctx.request.json().catch(() => ({}));
  const userId = String(body?.user_id ?? '');
  const neueAdresse = String(body?.email ?? '').trim().toLowerCase();

  if (!userId) {
    return Response.json({ error: 'user_id erforderlich' }, { status: 400 });
  }
  if (!neueAdresse || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(neueAdresse)) {
    return Response.json({ error: 'ungueltige_adresse' }, { status: 400 });
  }

  const ziel = await DB.prepare('SELECT id, email, username FROM users WHERE id = ?')
    .bind(userId).first() as { id: string; email: string; username: string } | null;
  if (!ziel) {
    return Response.json({ error: 'Konto nicht gefunden' }, { status: 404 });
  }

  if (neueAdresse === ziel.email.toLowerCase()) {
    return Response.json({ error: 'gleiche_adresse' }, { status: 400 });
  }

  const belegt = await DB.prepare(
    'SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?'
  ).bind(neueAdresse, userId).first();
  if (belegt) {
    return Response.json({ error: 'adresse_belegt' }, { status: 409 });
  }

  await DB.batch([
    DB.prepare(`UPDATE users
                   SET email = ?, email_verified = 0, email_verified_at = NULL
                 WHERE id = ?`).bind(neueAdresse, userId),
    // Offene Links zeigten auf die alte Adresse und gelten nicht mehr.
    DB.prepare(`UPDATE email_verifications SET used_at = datetime('now')
                 WHERE user_id = ? AND used_at IS NULL`).bind(userId),
    // Ebenso offene Passwort-Anfragen: Sie wurden an die alte Adresse
    // geschickt, und die gehört jetzt nicht mehr zum Konto.
    DB.prepare(`UPDATE password_resets SET used_at = datetime('now')
                 WHERE user_id = ? AND used_at IS NULL`).bind(userId),
  ]);

  // Landet im Cloudflare-Protokoll. Ein Eingriff in fremde Kontodaten soll
  // nachvollziehbar sein, auch ohne eigene Protokolltabelle.
  console.log(
    `[admin] ${admin.username} (${admin.user_id}) hat die Adresse von ` +
    `${ziel.username} (${ziel.id}) geaendert: ${ziel.email} -> ${neueAdresse}`
  );

  return Response.json({ ok: true, alt: ziel.email, neu: neueAdresse });
}

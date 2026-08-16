/**
 * Bestätigungsmail (erneut) verschicken.
 *
 * Aufgerufen vom Balken "Bitte bestätige deine E-Mail-Adresse" und direkt nach
 * der Registrierung. Setzt eine gültige Sitzung voraus — anders als beim
 * Passwort-Reset weiss der Aufrufer hier also schon, wer er ist, und es gibt
 * nichts zu verbergen.
 *
 * Der Balken ist der wichtigere der beiden Wege: Die Domain hat gerade erst
 * angefangen zu senden, und 200 der 303 Adressen liegen bei Gmail. Ein Teil
 * der Mails wird anfangs im Spam landen. Wer den Balken sieht, kann dann
 * wenigstens gezielt nachsehen und erneut anfordern.
 */
import { getToken, validateSession } from '../../_lib/auth';
import { sendeMail } from '../../_lib/mail';
import { verifyMailText } from '../../_lib/mail-texte';
import { neuerToken, tokenHash } from '../../_lib/token';

/** Wie lange ein Bestätigungslink gilt. Grosszügiger als beim Reset — hier
 *  eilt nichts, und wer die Mail erst nach dem Urlaub liest, soll sie noch
 *  benutzen können. */
export const GUELTIG_TAGE = 7;

/** Höchstens so viele Mails je Konto und Stunde. */
const MAX_PRO_STUNDE = 3;

export async function onRequestPost(ctx: any) {
  const { DB, RESEND_API_KEY } = ctx.env;

  const sitzung = await validateSession(DB, getToken(ctx.request) ?? '');
  if (!sitzung) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = await ctx.request.json().catch(() => ({}));
  const sprache = String(body?.lang ?? 'en');

  const user = await DB.prepare(
    'SELECT id, email, username, email_verified FROM users WHERE id = ?'
  ).bind(sitzung.user_id).first() as
    { id: string; email: string; username: string; email_verified: number } | null;

  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  // Schon bestätigt: nichts tun, aber auch nicht meckern. Kann passieren, wenn
  // jemand zwei Fenster offen hat und im einen bereits geklickt hat.
  if (user.email_verified) return Response.json({ ok: true, bereits: true });

  const zuletzt = await DB.prepare(
    `SELECT COUNT(*) AS n FROM email_verifications
      WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`
  ).bind(user.id).first() as { n: number };

  if ((zuletzt?.n ?? 0) >= MAX_PRO_STUNDE) {
    return Response.json({ error: 'zu_oft' }, { status: 429 });
  }

  const token = neuerToken();
  const hash = await tokenHash(token);

  await DB.prepare(
    `INSERT INTO email_verifications (user_id, token_hash, email, expires_at)
     VALUES (?, ?, ?, datetime('now', ?))`
  ).bind(user.id, hash, user.email, `+${GUELTIG_TAGE} days`).run();

  const basis = new URL(ctx.request.url).origin;
  const pfad = sprache && sprache !== 'en' ? `/${sprache}/verify/` : '/verify/';
  const link = `${basis}${pfad}?token=${token}`;

  const { betreff, html, text } = verifyMailText(sprache, user.username, link, GUELTIG_TAGE);
  const ergebnis = await sendeMail(RESEND_API_KEY, user.email, betreff, html, text);

  if (!ergebnis.ok) {
    // Hier darf der Fehler sichtbar werden: Der Aufrufer ist angemeldet, es
    // gibt nichts zu verraten. Und wenn der Versand klemmt, soll er das
    // erfahren, statt auf eine Mail zu warten, die nie kommt.
    console.error('Bestätigungsmail fehlgeschlagen:', ergebnis.fehler);
    return Response.json({ error: 'versand_fehlgeschlagen' }, { status: 502 });
  }

  return Response.json({ ok: true });
}

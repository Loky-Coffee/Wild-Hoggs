/**
 * E-Mail-Adresse ändern.
 *
 * Warum es das braucht: Von 305 Konten haben zwei nachweislich einen
 * Tippfehler in der Adresse (gmai.com statt gmail.com, naver.con statt
 * naver.com). Ohne diesen Weg sitzen sie fest — sie sehen den Hinweis zur
 * Bestätigung, fordern Mails an, die nie ankommen, und verlieren ihr Konto,
 * sobald sie das Passwort vergessen.
 *
 * Zwei Vorkehrungen:
 *
 * 1. Das aktuelle Passwort muss stimmen. Wer die Adresse ändern kann, kann
 *    sonst über "Passwort vergessen" das ganze Konto übernehmen — eine offene
 *    Sitzung an einem fremden Rechner würde reichen.
 *
 * 2. Die neue Adresse wird NICHT sofort übernommen. Der Bestätigungslink geht
 *    dorthin, und erst der Klick schreibt sie ins Konto (siehe verify.ts).
 *    Wer sich beim Ändern erneut vertippt, behält seine alte Adresse und kann
 *    es noch einmal versuchen.
 */
import { getToken, validateSession, verifyPassword } from '../../_lib/auth';
import { sendeMail } from '../../_lib/mail';
import { verifyMailText } from '../../_lib/mail-texte';
import { neuerToken, tokenHash } from '../../_lib/token';

const GUELTIG_TAGE = 7;

/** Höchstens so viele Änderungsversuche je Konto und Stunde. */
const MAX_PRO_STUNDE = 3;

const SPRACHEN = [
  'en','de','fr','es','it','pt','tr','ja','ko','id','th','vi','zh-CN','zh-TW','ar',
];

export async function onRequestPost(ctx: any) {
  const { DB, RESEND_API_KEY } = ctx.env;

  const sitzung = await validateSession(DB, getToken(ctx.request) ?? '');
  if (!sitzung) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = await ctx.request.json().catch(() => ({}));
  const neueAdresse = String(body?.email ?? '').trim().toLowerCase();
  const passwort = String(body?.password ?? '');
  const gewuenscht = String(body?.lang ?? '');
  const sprache = SPRACHEN.includes(gewuenscht) ? gewuenscht : 'en';

  if (!neueAdresse || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(neueAdresse)) {
    return Response.json({ error: 'ungueltige_adresse' }, { status: 400 });
  }
  if (!passwort) {
    return Response.json({ error: 'passwort_fehlt' }, { status: 400 });
  }

  const user = await DB.prepare(
    'SELECT id, email, username, password_hash FROM users WHERE id = ?'
  ).bind(sitzung.user_id).first() as
    { id: string; email: string; username: string; password_hash: string } | null;

  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  if (!(await verifyPassword(passwort, user.password_hash))) {
    return Response.json({ error: 'passwort_falsch' }, { status: 403 });
  }

  if (neueAdresse === user.email.toLowerCase()) {
    return Response.json({ error: 'gleiche_adresse' }, { status: 400 });
  }

  // Gehört die Adresse schon jemandem? Die Meldung verrät das — anders als
  // beim Anmelden ist das hier unbedenklich: Der Aufrufer hat sein Passwort
  // gerade bewiesen und probiert damit sein eigenes Konto durch, nicht fremde.
  const belegt = await DB.prepare(
    'SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?'
  ).bind(neueAdresse, user.id).first();
  if (belegt) {
    return Response.json({ error: 'adresse_belegt' }, { status: 409 });
  }

  const zuletzt = await DB.prepare(
    `SELECT COUNT(*) AS n FROM email_verifications
      WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`
  ).bind(user.id).first() as { n: number };
  if ((zuletzt?.n ?? 0) >= MAX_PRO_STUNDE) {
    return Response.json({ error: 'zu_oft' }, { status: 429 });
  }

  const token = neuerToken();
  const hash = await tokenHash(token);

  // Offene Links entwerten, bevor der neue entsteht. Sonst könnte ein älterer
  // Link später eine Adresse setzen, die längst überholt ist.
  await DB.batch([
    DB.prepare(`UPDATE email_verifications SET used_at = datetime('now')
                 WHERE user_id = ? AND used_at IS NULL`).bind(user.id),
    DB.prepare(`INSERT INTO email_verifications (user_id, token_hash, email, expires_at)
                VALUES (?, ?, ?, datetime('now', ?))`)
      .bind(user.id, hash, neueAdresse, `+${GUELTIG_TAGE} days`),
  ]);

  const basis = new URL(ctx.request.url).origin;
  const pfad = sprache !== 'en' ? `/${sprache}/verify/` : '/verify/';
  const link = `${basis}${pfad}?token=${token}`;

  const { betreff, html, text } = verifyMailText(sprache, user.username, link, GUELTIG_TAGE);

  // An die NEUE Adresse. Hier wird auf das Ergebnis gewartet: Der Aufrufer ist
  // angemeldet und hat sein Passwort bewiesen, es gibt nichts zu verbergen —
  // und er soll erfahren, wenn der Versand klemmt, statt auf eine Mail zu
  // warten, die nie kommt.
  const ergebnis = await sendeMail(RESEND_API_KEY, neueAdresse, betreff, html, text);
  if (!ergebnis.ok) {
    console.error('Adressänderung, Versand fehlgeschlagen:', ergebnis.fehler);
    return Response.json({ error: 'versand_fehlgeschlagen' }, { status: 502 });
  }

  return Response.json({ ok: true, gesendet_an: neueAdresse });
}

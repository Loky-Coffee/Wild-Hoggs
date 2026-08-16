/**
 * "Passwort vergessen" — Schritt 1: Link anfordern.
 *
 * Zwei Dinge sind hier wichtiger als Bequemlichkeit:
 *
 * 1. Die Antwort ist IMMER dieselbe, egal ob die Adresse ein Konto hat oder
 *    nicht. Sonst liesse sich über dieses Formular durchprobieren, wer hier
 *    angemeldet ist — bei 302 Konten mit echten Adressen ein lohnendes Ziel.
 *    Auch die Antwortzeit verrät nichts: Der Versand läuft über waitUntil und
 *    hält die Antwort nicht auf.
 *
 * 2. Der Token steht nur in der Mail. In der Datenbank liegt sein SHA-256-Wert.
 *    Wer die Tabelle liest, kann damit kein Passwort setzen.
 */
import { sendeMail } from '../../_lib/mail';
import { resetMailText } from '../../_lib/mail-texte';

/** Wie lange ein Link gilt. Kurz genug, um zu wirken; lang genug für jemanden,
 *  der die Mail erst später liest. */
const GUELTIG_MINUTEN = 60;

/** Höchstens so viele Anfragen je Adresse und Stunde. */
const MAX_PRO_STUNDE = 3;

async function sha256(text: string): Promise<string> {
  const daten = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', daten);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function zufallsToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(ctx: any) {
  const { DB, RESEND_API_KEY } = ctx.env;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const sprache = String(body?.lang ?? 'en');

  // Immer dieselbe Antwort — ab hier passiert alles im Verborgenen.
  const antwort = Response.json({ ok: true });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return antwort;

  try {
    const user = await DB.prepare('SELECT id, username FROM users WHERE email = ?')
      .bind(email).first() as { id: string; username: string } | null;
    if (!user) return antwort;

    // Wer es zu oft versucht, bekommt keine weitere Mail — aber dieselbe
    // Antwort. Sonst wird aus der Bremse ein Hinweis, dass es das Konto gibt.
    const offen = await DB.prepare(
      `SELECT COUNT(*) AS n FROM password_resets
        WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`
    ).bind(user.id).first() as { n: number };
    if ((offen?.n ?? 0) >= MAX_PRO_STUNDE) return antwort;

    const token = zufallsToken();
    const hash = await sha256(token);

    await DB.prepare(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES (?, ?, datetime('now', ?))`
    ).bind(user.id, hash, `+${GUELTIG_MINUTEN} minutes`).run();

    const basis = new URL(ctx.request.url).origin;
    const pfad = sprache && sprache !== 'en' ? `/${sprache}/reset/` : '/reset/';
    const link = `${basis}${pfad}?token=${token}`;

    const { betreff, html, text } = resetMailText(sprache, user.username, link, GUELTIG_MINUTEN);

    // Der Versand hält die Antwort nicht auf: Sonst dauerte eine Anfrage für
    // eine bekannte Adresse messbar länger als für eine unbekannte.
    ctx.waitUntil(
      sendeMail(RESEND_API_KEY, email, betreff, html, text).then(e => {
        if (!e.ok) console.error('Reset-Mail fehlgeschlagen:', e.fehler);
      }),
    );
  } catch (e) {
    // Auch ein Fehler darf nichts verraten.
    console.error('forgot:', e);
  }

  return antwort;
}

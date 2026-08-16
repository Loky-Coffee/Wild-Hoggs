/**
 * "Passwort vergessen" — Schritt 2: Token einlösen, neues Passwort setzen.
 *
 * Der Token kommt aus dem Link in der Mail. Hier wird er gehasht und mit der
 * Tabelle verglichen — der Klartext-Token steht nirgends bei uns.
 *
 * Nach dem Wechsel fliegen ALLE Sitzungen des Kontos raus, auch die, von der
 * die Anfrage kommt. Wer sein Passwort zurücksetzt, tut das oft, weil er
 * jemand anderen im Konto vermutet; eine bestehende Sitzung wäre dann genau
 * der Zugang, den man schliessen will. Danach muss man sich neu anmelden.
 */
import { hashPassword } from '../../_lib/auth';

async function sha256(text: string): Promise<string> {
  const daten = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', daten);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const token = String(body?.token ?? '').trim();
  const passwort = String(body?.password ?? '');

  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return Response.json({ error: 'invalid_token' }, { status: 400 });
  }
  // Dieselbe Untergrenze wie bei der Registrierung — sonst liesse sich über
  // diesen Weg ein schwächeres Passwort setzen, als die Anmeldung zulässt.
  if (passwort.length < 8) {
    return Response.json({ error: 'password_too_short' }, { status: 400 });
  }

  try {
    const hash = await sha256(token);

    const eintrag = await DB.prepare(
      `SELECT id, user_id, used_at, expires_at
         FROM password_resets
        WHERE token_hash = ?`
    ).bind(hash).first() as
      { id: string; user_id: string; used_at: string | null; expires_at: string } | null;

    // Unbekannt, schon benutzt, abgelaufen — für den Aufrufer alles dasselbe.
    // Der Unterschied hilft nur jemandem, der Token durchprobiert.
    if (!eintrag || eintrag.used_at) {
      return Response.json({ error: 'invalid_token' }, { status: 400 });
    }

    const abgelaufen = await DB.prepare(
      `SELECT datetime('now') > ? AS vorbei`
    ).bind(eintrag.expires_at).first() as { vorbei: number };
    if (abgelaufen?.vorbei) {
      return Response.json({ error: 'invalid_token' }, { status: 400 });
    }

    const neuerHash = await hashPassword(passwort);

    // Alles drei oder nichts: Passwort setzen, Token entwerten, Sitzungen
    // beenden. Bliebe der Token gültig, weil nur der erste Schritt lief,
    // liesse er sich ein zweites Mal einlösen.
    await DB.batch([
      DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .bind(neuerHash, eintrag.user_id),
      DB.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE id = ?`)
        .bind(eintrag.id),
      // Auch die übrigen offenen Anfragen desselben Kontos verfallen: Wer
      // dreimal geklickt hat, soll nicht drei gültige Links im Postfach haben.
      DB.prepare(`UPDATE password_resets SET used_at = datetime('now')
                   WHERE user_id = ? AND used_at IS NULL`)
        .bind(eintrag.user_id),
      DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(eintrag.user_id),
    ]);

    return Response.json({ ok: true });
  } catch (e) {
    console.error('reset:', e);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}

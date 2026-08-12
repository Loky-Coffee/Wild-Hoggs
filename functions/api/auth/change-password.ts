// POST /api/auth/change-password — change own password

import { getToken, validateSession, verifyPassword, hashPassword } from '../../_lib/auth';

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  let body: any;
  try { body = await ctx.request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return Response.json({ error: 'Fehlende Felder' }, { status: 400 });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return Response.json({ error: 'Neues Passwort: min. 8 Zeichen' }, { status: 400 });
  }

  const dbUser = await DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.user_id).first() as any;

  const ok = await verifyPassword(currentPassword, dbUser.password_hash);
  if (!ok) return Response.json({ error: 'Aktuelles Passwort ist falsch' }, { status: 400 });

  const newHash = await hashPassword(newPassword);
  await DB.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(newHash, user.user_id).run();

  // Alle übrigen Anmeldungen beenden.
  //
  // Ohne das lief das Passwortändern ins Leere: Wer ein Sitzungs-Token
  // erbeutet hatte — vom fremden Gerät, aus einem geteilten Rechner —, behielt
  // damit dreissig Tage Zugriff. Ausgerechnet die Massnahme, die man in dieser
  // Lage ergreift, änderte daran nichts.
  //
  // Die eigene Anmeldung bleibt bestehen: Wer hier gerade tippt, soll nicht
  // sofort herausfliegen und sich mit dem neuen Passwort neu anmelden müssen —
  // ein Tippfehler darin hätte ihn sonst ausgesperrt.
  const weg = await DB.prepare(
    'DELETE FROM sessions WHERE user_id = ? AND token != ?'
  ).bind(user.user_id, token).run();

  return Response.json({
    success: true,
    // Wie viele andere Geräte abgemeldet wurden — die Oberfläche kann es
    // anzeigen, und wer eine unerwartete Zahl sieht, weiss Bescheid.
    signedOutDevices: weg?.meta?.changes ?? 0,
  });
}

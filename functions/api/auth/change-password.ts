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

  return Response.json({ success: true });
}

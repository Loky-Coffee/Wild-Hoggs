import { verifyPassword, generateToken, expiresAt } from '../../_lib/auth';

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, password } = body ?? {};
  if (!email || !password) {
    return Response.json({ error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
  }

  const user = await DB.prepare(
    'SELECT id, email, username, password_hash, faction, language FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first() as any;

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return Response.json({ error: 'Ungültige E-Mail oder Passwort' }, { status: 401 });
  }

  const token = generateToken();
  await DB.prepare(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(user.id, token, expiresAt(30)).run();

  return Response.json({
    user: { id: user.id, email: user.email, username: user.username, faction: user.faction, language: user.language },
    token
  });
}

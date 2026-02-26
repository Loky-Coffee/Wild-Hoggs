import { hashPassword, generateToken, expiresAt } from '../../_lib/auth';

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, username, password, server } = body ?? {};

  // Validation
  if (!email || !username || !password) {
    return Response.json({ error: 'Email, Username und Passwort sind erforderlich' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Ungültige E-Mail Adresse' }, { status: 400 });
  }
  if (username.length < 3 || username.length > 20) {
    return Response.json({ error: 'Username muss 3–20 Zeichen haben' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return Response.json({ error: 'Username darf nur Buchstaben, Zahlen und _ enthalten' }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 });
  }

  // Check duplicates
  const existingEmail = await DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase()).first();
  if (existingEmail) {
    return Response.json({ error: 'Diese E-Mail ist bereits registriert' }, { status: 400 });
  }

  const existingUsername = await DB.prepare('SELECT id FROM users WHERE lower(username) = lower(?)')
    .bind(username).first();
  if (existingUsername) {
    return Response.json({ error: 'Dieser Username ist bereits vergeben' }, { status: 400 });
  }

  // Validate server (optional — 1–10 alphanumeric chars)
  const serverVal = server ? String(server).trim().slice(0, 10) : null;
  if (serverVal && !/^[a-zA-Z0-9]+$/.test(serverVal)) {
    return Response.json({ error: 'Server: nur Zahlen/Buchstaben erlaubt' }, { status: 400 });
  }

  // Create user
  const passwordHash = await hashPassword(password);
  await DB.prepare(
    'INSERT INTO users (email, username, password_hash, server) VALUES (?, ?, ?, ?)'
  ).bind(email.toLowerCase(), username, passwordHash, serverVal).run();

  const user = await DB.prepare('SELECT id, email, username, faction, server, language FROM users WHERE email = ?')
    .bind(email.toLowerCase()).first() as any;

  // Create session
  const token = generateToken();
  await DB.prepare(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(user.id, token, expiresAt(30)).run();

  return Response.json({
    user: { id: user.id, email: user.email, username: user.username, faction: user.faction, server: user.server, language: user.language },
    token
  });
}

import { hashPassword, generateToken, expiresAt } from '../../_lib/auth';
import { ladeEinstellung } from '../../_lib/settings';
import { ipVon, pruefeRegisterLimit, zaehleRegistrierung } from '../../_lib/login-ratelimit';

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;

  // Registrierung lässt sich in der Verwaltung schliessen — etwa wenn eine
  // Welle von Wegwerfkonten hereinkommt. Die Prüfung steht ganz vorn, damit
  // erst gar keine Daten verarbeitet werden.
  if (await ladeEinstellung(DB, 'registration_open') !== 1) {
    return Response.json(
      { error: 'Die Registrierung ist derzeit geschlossen.' },
      { status: 403 },
    );
  }

  // Mengenbremse gegen automatisiertes Anlegen von Konten. Zugleich macht sie
  // es unattraktiv, über die Meldung "E-Mail bereits registriert" auszuprobieren,
  // wer hier ein Konto hat.
  const ip = ipVon(ctx.request);
  const limit = await pruefeRegisterLimit(DB, ip);
  if (!limit.erlaubt) {
    const min = Math.ceil((limit.wartenSek ?? 3600) / 60);
    return Response.json(
      { error: `Zu viele Registrierungen von diesem Anschluss. Bitte in etwa ${min} Minute(n) erneut versuchen.` },
      { status: 429, headers: { 'Retry-After': String(limit.wartenSek ?? 3600) } },
    );
  }

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

  // Ab hier ist es ein ernsthafter Versuch — mitzählen, bevor die Datenbank
  // preisgibt, ob es diese Adresse schon gibt. Stünde der Zähler erst am Ende,
  // liessen sich beliebig viele Adressen durchprobieren, solange man nur
  // aufhört, sobald die Antwort "bereits registriert" lautet.
  await zaehleRegistrierung(DB, ip);

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

  const user = await DB.prepare(
    'SELECT id, email, username, faction, server, language, formation_power_br, formation_power_wd, formation_power_go, is_admin, COALESCE(is_moderator, 0) AS is_moderator, permissions, notification_sound, notification_volume FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first() as any;

  // Create session
  const token = generateToken();
  await DB.prepare(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(user.id, token, expiresAt(30)).run();

  return Response.json({
    user: {
      id: user.id, email: user.email, username: user.username,
      faction: user.faction, server: user.server, language: user.language,
      formation_power_br: user.formation_power_br ?? null,
      formation_power_wd: user.formation_power_wd ?? null,
      formation_power_go: user.formation_power_go ?? null,
      is_admin: user.is_admin ?? 0,
      is_moderator: user.is_moderator ?? 0,
      permissions: user.permissions ?? null,
      notification_sound: user.notification_sound ?? 1,
      notification_volume: user.notification_volume ?? 1.5,
    },
    token
  });
}

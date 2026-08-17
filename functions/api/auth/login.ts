import { verifyPassword, generateToken, expiresAt } from '../../_lib/auth';
import { ipVon, pruefeLoginLimit, zaehleFehlversuch, loginGelungen } from '../../_lib/login-ratelimit';

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

  // Zu viele Fehlversuche? Dann gar nicht erst nachschlagen. Die Prüfung steht
  // vor der Datenbankabfrage, damit ein Angriff auch keine Rechenzeit kostet.
  const ip     = ipVon(ctx.request);
  const kennung = String(email).toLowerCase();
  const limit  = await pruefeLoginLimit(DB, ip, kennung);
  if (!limit.erlaubt) {
    const min = Math.ceil((limit.wartenSek ?? 60) / 60);
    return Response.json(
      { error: `Zu viele Fehlversuche. Bitte in etwa ${min} Minute(n) erneut versuchen.` },
      { status: 429, headers: { 'Retry-After': String(limit.wartenSek ?? 60) } },
    );
  }

  const user = await DB.prepare(
    'SELECT id, email, username, password_hash, faction, server, language, formation_power_br, formation_power_wd, formation_power_go, is_admin, COALESCE(is_moderator, 0) AS is_moderator, permissions, COALESCE(email_verified, 0) AS email_verified, banned_at, ban_grund FROM users WHERE email = ?'
    // kennung statt email.toLowerCase(): Bei einem Wert, der kein String ist,
    // gibt es .toLowerCase nicht — der Aufruf endete in einem 500 statt in einer
    // sauberen 400. Zwei Zeilen darueber wird bereits String(email) benutzt.
  ).bind(kennung).first() as any;

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await zaehleFehlversuch(DB, ip, kennung);
    // Weiterhin dieselbe Meldung für "Konto gibt es nicht" und "Passwort
    // falsch" — sonst liesse sich herausfinden, wer hier ein Konto hat.
    return Response.json({ error: 'Ungültige E-Mail oder Passwort' }, { status: 401 });
  }

  // Gesperrte Konten kommen nicht herein — geprueft NACH dem Passwort, damit
  // sich ueber diese Meldung nicht herausfinden laesst, welche Konten gesperrt
  // sind, ohne das Passwort zu kennen.
  if (user.banned_at) {
    // Der Grund geht als Code hinaus, nicht als fertiger Satz: Die Oberflaeche
    // setzt ihn in der Sprache des Gesperrten zusammen. Ein deutscher Freitext
    // waere fuer die meisten der 305 Konten unlesbar.
    // Format in der Spalte: "code" oder "code|freitext".
    const roh = String(user.ban_grund ?? '');
    const trenner = roh.indexOf('|');
    return Response.json(
      {
        error: 'Dieses Konto ist gesperrt.',
        gesperrt: true,
        grund: trenner === -1 ? roh : roh.slice(0, trenner),
        grundText: trenner === -1 ? '' : roh.slice(trenner + 1),
        seit: user.banned_at,
      },
      { status: 403 },
    );
  }

  // Wer sich richtig erinnert, ist sofort wieder frei — auch nach sieben
  // Fehlversuchen davor.
  await loginGelungen(DB, ip, kennung);

  const token = generateToken();
  await DB.prepare(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(user.id, token, expiresAt(30)).run();

  // Zeitpunkt der Anmeldung festhalten. Vorher wurde er im Verwaltungsbereich
  // aus dem Sitzungsablauf zurueckgerechnet — und verschwand, sobald sich
  // jemand abmeldete und die Sitzungszeile geloescht wurde.
  // Bewusst gekapselt: Das Anmelden selbst darf nicht daran scheitern, dass ein
  // Nebeneffekt fehlschlaegt — etwa wenn ein Deploy die Migration 020 noch nicht
  // gesehen hat. Fehlt der Zeitstempel, faellt der Verwaltungsbereich auf die
  // alte Ableitung aus dem Sitzungsablauf zurueck.
  try {
    await DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?")
      .bind(user.id).run();
  } catch { /* Spalte fehlt oder Schreibfehler — Anmeldung gilt trotzdem */ }

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
      email_verified: user.email_verified ?? 0,
    },
    token
  });
}

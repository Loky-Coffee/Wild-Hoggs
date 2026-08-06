// GET /api/user/stats — Kennzahlen für die Profil-Übersicht
//
// Bisher stand auf der Profilseite fast nichts über die eigene Nutzung. Diese
// Zahlen füllen die Übersicht: seit wann dabei, wie aktiv, wie viel angelegt.

import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const id = user.user_id;

  const [konto, global, server, pmAus, pmEin, profile, staende] = await DB.batch([
    DB.prepare(`SELECT created_at, last_seen FROM users WHERE id = ?`).bind(id),
    DB.prepare(`SELECT COUNT(*) AS n FROM chat_global WHERE user_id = ?`).bind(id),
    DB.prepare(`SELECT COUNT(*) AS n FROM chat_server WHERE user_id = ?`).bind(id),
    DB.prepare(`SELECT COUNT(*) AS n FROM chat_pm WHERE sender_id = ?`).bind(id),
    DB.prepare(`SELECT COUNT(*) AS n FROM chat_pm WHERE receiver_id = ?`).bind(id),
    DB.prepare(`SELECT COUNT(*) AS n FROM game_profiles WHERE user_id = ?`).bind(id),
    DB.prepare(`SELECT COUNT(DISTINCT calc_type) AS n FROM calculator_states WHERE user_id = ?`).bind(id),
  ]);

  const zahl = (r: any) => (r.results?.[0]?.n ?? 0) as number;
  const k = konto.results?.[0] as { created_at: string; last_seen: string } | undefined;

  return Response.json({
    mitglied_seit:      k?.created_at ?? null,
    zuletzt_gesehen:    k?.last_seen ?? null,
    nachrichten_global: zahl(global),
    nachrichten_server: zahl(server),
    pm_gesendet:        zahl(pmAus),
    pm_erhalten:        zahl(pmEin),
    spielprofile:       zahl(profile),
    genutzte_rechner:   zahl(staende),
    rolle: user.is_admin === 1 ? 'admin' : (user.is_moderator === 1 ? 'moderator' : 'user'),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// GET /api/user/export — alle eigenen Daten als JSON herunterladen
//
// Auskunfts- und Übertragbarkeitsrecht (DSGVO Art. 15 und 20): Wer hier ein
// Konto hat, soll sehen können, was gespeichert ist, und es mitnehmen können.
//
// Enthalten ist alles, was einer Person zuzuordnen ist — Konto, Spielprofile,
// gespeicherte Rechnerstände, geschriebene Nachrichten. Nicht enthalten sind
// Passwort-Hash und Sitzungs-Token: Beides sind Zugangsdaten, keine Inhalte,
// und hätten in einer Datei nichts verloren, die im Downloads-Ordner landet.

import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const id = user.user_id;

  const [konto, profile, staende, global, server, pmGesendet, pmErhalten] = await DB.batch([
    DB.prepare(`SELECT id, email, username, faction, server, language,
                       formation_power_br, formation_power_wd, formation_power_go,
                       is_admin, is_moderator, notification_sound, notification_volume,
                       last_seen, created_at
                FROM users WHERE id = ?`).bind(id),
    DB.prepare(`SELECT id, name, server, faction, created_at FROM game_profiles WHERE user_id = ?`).bind(id),
    DB.prepare(`SELECT profile_id, calc_type, calc_key, state_json, updated_at
                FROM calculator_states WHERE user_id = ?`).bind(id),
    DB.prepare(`SELECT id, message, lang, created_at FROM chat_global WHERE user_id = ? ORDER BY created_at`).bind(id),
    DB.prepare(`SELECT id, server, message, lang, created_at FROM chat_server WHERE user_id = ? ORDER BY created_at`).bind(id),
    DB.prepare(`SELECT p.id, u.username AS an, p.message, p.created_at
                FROM chat_pm p LEFT JOIN users u ON p.receiver_id = u.id
                WHERE p.sender_id = ? ORDER BY p.created_at`).bind(id),
    DB.prepare(`SELECT p.id, u.username AS von, p.message, p.created_at
                FROM chat_pm p LEFT JOIN users u ON p.sender_id = u.id
                WHERE p.receiver_id = ? ORDER BY p.created_at`).bind(id),
  ]);

  const daten = {
    erstellt_am: new Date().toISOString(),
    hinweis: 'Alle zu diesem Konto gespeicherten Daten. Passwort und Sitzungen sind bewusst nicht enthalten.',
    konto:            konto.results?.[0] ?? null,
    spielprofile:     profile.results ?? [],
    rechner_staende:  (staende.results ?? []).map((r: any) => {
      // Der Zustand liegt als JSON-Text in state_json — lesbar ausgeben.
      try { return { ...r, state_json: JSON.parse(r.state_json) }; } catch { return r; }
    }),
    nachrichten: {
      global:        global.results ?? [],
      server:        server.results ?? [],
      privat_gesendet: pmGesendet.results ?? [],
      privat_erhalten: pmErhalten.results ?? [],
    },
  };

  const datum = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(daten, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="wild-hoggs-daten-${user.username}-${datum}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}

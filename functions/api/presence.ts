// GET /api/presence — heartbeat: update own last_seen, return online users (last 5 min)

import { getToken, validateSession } from '../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  // Nur schreiben, wenn der Wert wirklich veraltet ist.
  //
  // Vorher loeste jeder Aufruf einen Schreibvorgang aus, ohne jede Bremse. Ein
  // angemeldetes Konto konnte damit in einer Schleife das Tageskontingent von D1
  // leerlaufen lassen — und ist das erschoepft, scheitert bis Mitternacht UTC
  // JEDER Schreibpfad, auch das Anmelden, weil dabei eine Sitzung entsteht.
  //
  // Eine Sperre je Konto waere hier das falsche Mittel: Sie traefe irgendwann
  // auch jemanden, der einfach zwei Geraete offen hat. Die Bedingung im UPDATE
  // dagegen kostet legitime Nutzer nichts — der Herzschlag kommt alle 60 s, die
  // Schwelle liegt bei 30 s. Wer tausendmal je Sekunde aufruft, erzeugt
  // trotzdem nur alle 30 s eine geschriebene Zeile.
  await DB.prepare(
    `UPDATE users SET last_seen = datetime('now')
      WHERE id = ?
        AND (last_seen IS NULL OR last_seen < datetime('now', '-30 seconds'))`
  ).bind(user.user_id).run();

  // Return all users seen in the last 5 minutes
  const { results } = await DB.prepare(
    `SELECT username, faction, server, language,
            COALESCE(is_admin, 0)     AS is_admin,
            COALESCE(is_moderator, 0) AS is_moderator
     FROM users
     WHERE last_seen > datetime('now', '-5 minutes')
     ORDER BY username ASC`
  ).all();

  return Response.json(
    { users: results },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

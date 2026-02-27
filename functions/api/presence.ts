// GET /api/presence — heartbeat: update own last_seen, return online users (last 5 min)

import { getToken, validateSession } from '../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  // Heartbeat — update this user's last_seen timestamp
  await DB.prepare(
    `UPDATE users SET last_seen = datetime('now') WHERE id = ?`
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

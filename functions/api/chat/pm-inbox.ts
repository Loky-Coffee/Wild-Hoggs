// GET /api/chat/pm/inbox?since=...
// Returns new incoming PMs (receiver = me) since the given timestamp,
// grouped by sender. Used for unread-notification polling.

import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const url   = new URL(ctx.request.url);
  const since = url.searchParams.get('since');

  let senders: any[];

  if (since) {
    const { results } = await DB.prepare(
      `SELECT u.username AS sender_username, COUNT(*) AS count, MAX(p.created_at) AS last_created_at
       FROM chat_pm p
       JOIN users u ON p.sender_id = u.id
       WHERE p.receiver_id = ? AND p.created_at > ?
       GROUP BY p.sender_id
       ORDER BY last_created_at DESC`
    ).bind(user.user_id, since).all();
    senders = results as any[];
  } else {
    // First call: just return the current server timestamp so we can use it as baseline
    senders = [];
  }

  const now = await DB.prepare(`SELECT datetime('now') AS ts`).first() as { ts: string };

  return Response.json(
    { senders, server_time: now.ts },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// GET  /api/chat/pm/:username         — Conversation between current user and :username
// POST /api/chat/pm/:username         — Send PM to :username

import { getToken, validateSession } from '../../../_lib/auth';
import { checkRateLimit } from '../../../_lib/chat-ratelimit';

const MAX_LEN       = 500;
const DEFAULT_LIMIT = 50;

function genId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const username = ctx.params.username as string;
  const other = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first() as { id: string } | null;
  if (!other) return Response.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });

  if (user.user_id === other.id) {
    return Response.json({ error: 'Kein Self-PM möglich' }, { status: 400 });
  }

  const url   = new URL(ctx.request.url);
  const since = url.searchParams.get('since');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT)), 100);

  let messages: any[];

  if (since) {
    const { results } = await DB.prepare(
      `SELECT p.id, u.username, u.faction, u.server, p.message, p.created_at,
              COALESCE(u.is_admin, 0) AS is_admin, COALESCE(u.is_moderator, 0) AS is_moderator
       FROM chat_pm p
       JOIN users u ON p.sender_id = u.id
       WHERE ((p.sender_id = ? AND p.receiver_id = ?) OR (p.sender_id = ? AND p.receiver_id = ?))
         AND p.created_at > ?
       ORDER BY p.created_at ASC
       LIMIT ?`
    ).bind(user.user_id, other.id, other.id, user.user_id, since, limit).all();
    messages = results as any[];
  } else {
    const { results } = await DB.prepare(
      `SELECT p.id, u.username, u.faction, u.server, p.message, p.created_at,
              COALESCE(u.is_admin, 0) AS is_admin, COALESCE(u.is_moderator, 0) AS is_moderator
       FROM chat_pm p
       JOIN users u ON p.sender_id = u.id
       WHERE (p.sender_id = ? AND p.receiver_id = ?) OR (p.sender_id = ? AND p.receiver_id = ?)
       ORDER BY p.created_at DESC
       LIMIT ?`
    ).bind(user.user_id, other.id, other.id, user.user_id, limit).all();
    messages = (results as any[]).reverse();
  }

  return Response.json(
    { messages },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const username = ctx.params.username as string;
  const other = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first() as { id: string } | null;
  if (!other) return Response.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });

  if (user.user_id === other.id) {
    return Response.json({ error: 'Kein Self-PM möglich' }, { status: 400 });
  }

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return Response.json({ error: 'Nachricht darf nicht leer sein.' }, { status: 400 });
  }
  if (message.length > MAX_LEN) {
    return Response.json({ error: `Nachricht zu lang (max. ${MAX_LEN} Zeichen).` }, { status: 400 });
  }

  const rl = await checkRateLimit(DB, user.user_id);
  if (!rl.allowed) return Response.json({ error: rl.reason }, { status: 429 });

  const id = genId();
  await DB.prepare(
    `INSERT INTO chat_pm (id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)`
  ).bind(id, user.user_id, other.id, message).run();

  const created = await DB.prepare(
    `SELECT p.id, u.username, u.faction, u.server, p.message, p.created_at,
            COALESCE(u.is_admin, 0) AS is_admin, COALESCE(u.is_moderator, 0) AS is_moderator
     FROM chat_pm p
     JOIN users u ON p.sender_id = u.id
     WHERE p.id = ?`
  ).bind(id).first() as any;

  return Response.json(created, { status: 201 });
}

// GET  /api/chat/server/:serverName — Read server messages (requires auth + matching server)
// POST /api/chat/server/:serverName — Send a message (requires auth + matching server)

import { getToken, validateSession } from '../../../_lib/auth';
import { checkRateLimit } from '../../../_lib/chat-ratelimit';

const MAX_LEN       = 500;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 100;

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

  const serverName = ctx.params.serverName as string;
  if (!user.server || user.server !== serverName) {
    return Response.json({ error: 'Kein Zugriff auf diesen Server-Chat.' }, { status: 403 });
  }

  const url    = new URL(ctx.request.url);
  const since  = url.searchParams.get('since');
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT)), MAX_LIMIT);
  const offset = parseInt(url.searchParams.get('offset') ?? '0');

  let messages: any[];

  if (since) {
    const { results } = await DB.prepare(
      `SELECT id, username, faction, server, message, created_at
       FROM chat_server
       WHERE server = ? AND created_at > ?
       ORDER BY created_at ASC
       LIMIT ?`
    ).bind(serverName, since, limit).all();
    messages = results as any[];
  } else {
    const { results } = await DB.prepare(
      `SELECT id, username, faction, server, message, created_at
       FROM chat_server
       WHERE server = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(serverName, limit, offset).all();
    messages = (results as any[]).reverse();
  }

  return Response.json(
    { messages, hasMore: messages.length === limit },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const serverName = ctx.params.serverName as string;

  if (!user.server) {
    return Response.json({ error: 'Kein Server-Feld in deinem Profil. Trage es unter /profile/ ein.' }, { status: 403 });
  }
  if (user.server !== serverName) {
    return Response.json({ error: 'Kein Zugriff auf diesen Server-Chat.' }, { status: 403 });
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
    `INSERT INTO chat_server (id, server, user_id, username, faction, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, serverName, user.user_id, user.username, user.faction, message).run();

  const created = await DB.prepare(
    'SELECT id, username, faction, server, message, created_at FROM chat_server WHERE id = ?'
  ).bind(id).first() as any;

  return Response.json(created, { status: 201 });
}

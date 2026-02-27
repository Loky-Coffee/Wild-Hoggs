// GET  /api/chat/server/:name         — server channel (lang IS NULL)
// GET  /api/chat/server/:name?lang=de — language server channel (lang = 'de')
// POST /api/chat/server/:name         — send to server channel
// POST /api/chat/server/:name?lang=de — send to language server channel

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
  const lang   = url.searchParams.get('lang') ?? null;
  const since  = url.searchParams.get('since');
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT)), MAX_LIMIT);
  const offset = parseInt(url.searchParams.get('offset') ?? '0');

  const langFilter   = lang ? 'lang = ?' : 'lang IS NULL';
  const langFilterCs = lang ? 'cs.lang = ?' : 'cs.lang IS NULL';

  let messages: any[];

  if (since) {
    const { results } = await DB.prepare(
      `SELECT cs.id, cs.username, cs.faction, cs.server, cs.message, cs.created_at,
              COALESCE(u.is_admin, 0) AS is_admin, COALESCE(u.is_moderator, 0) AS is_moderator,
              cs.reply_to_id, rs.username AS reply_to_username, SUBSTR(rs.message, 1, 120) AS reply_to_text
       FROM chat_server cs
       LEFT JOIN users u ON cs.user_id = u.id
       LEFT JOIN chat_server rs ON cs.reply_to_id = rs.id
       WHERE cs.server = ? AND ${langFilterCs} AND cs.created_at > ?
       ORDER BY cs.created_at ASC
       LIMIT ?`
    ).bind(...(lang ? [serverName, lang, since, limit] : [serverName, since, limit])).all();
    messages = results as any[];
  } else {
    const { results } = await DB.prepare(
      `SELECT cs.id, cs.username, cs.faction, cs.server, cs.message, cs.created_at,
              COALESCE(u.is_admin, 0) AS is_admin, COALESCE(u.is_moderator, 0) AS is_moderator,
              cs.reply_to_id, rs.username AS reply_to_username, SUBSTR(rs.message, 1, 120) AS reply_to_text
       FROM chat_server cs
       LEFT JOIN users u ON cs.user_id = u.id
       LEFT JOIN chat_server rs ON cs.reply_to_id = rs.id
       WHERE cs.server = ? AND ${langFilterCs}
       ORDER BY cs.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...(lang ? [serverName, lang, limit, offset] : [serverName, limit, offset])).all();
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
  const url        = new URL(ctx.request.url);
  const lang       = url.searchParams.get('lang') ?? null;

  if (!user.server) {
    return Response.json({ error: 'Kein Server-Feld in deinem Profil. Trage es unter /profile/ ein.' }, { status: 403 });
  }
  if (user.server !== serverName) {
    return Response.json({ error: 'Kein Zugriff auf diesen Server-Chat.' }, { status: 403 });
  }

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const message   = typeof body?.message     === 'string' ? body.message.trim() : '';
  const replyToId = typeof body?.reply_to_id === 'string' ? body.reply_to_id   : null;

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
    `INSERT INTO chat_server (id, server, user_id, username, faction, lang, message, reply_to_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, serverName, user.user_id, user.username, user.faction, lang, message, replyToId).run();

  const created = await DB.prepare(
    `SELECT cs.id, cs.username, cs.faction, cs.server, cs.message, cs.created_at,
            cs.reply_to_id, rs.username AS reply_to_username, SUBSTR(rs.message, 1, 120) AS reply_to_text
     FROM chat_server cs
     LEFT JOIN chat_server rs ON cs.reply_to_id = rs.id
     WHERE cs.id = ?`
  ).bind(id).first() as any;

  return Response.json({ ...created, is_admin: user.is_admin, is_moderator: user.is_moderator }, { status: 201 });
}

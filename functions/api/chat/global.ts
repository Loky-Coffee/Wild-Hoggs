// GET  /api/chat/global         — global channel (lang IS NULL)
// GET  /api/chat/global?lang=de — language channel (lang = 'de')
// POST /api/chat/global         — send to global channel
// POST /api/chat/global?lang=de — send to language channel

import { getToken, validateSession } from '../../_lib/auth';
import { checkRateLimit } from '../../_lib/chat-ratelimit';

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

  const url    = new URL(ctx.request.url);
  const lang   = url.searchParams.get('lang') ?? null;   // null = global (no lang filter)
  const since  = url.searchParams.get('since');
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT)), MAX_LIMIT);
  const offset = parseInt(url.searchParams.get('offset') ?? '0');

  // lang IS NULL → global channel;  lang = ? → language channel
  const langFilter    = lang ? 'lang = ?' : 'lang IS NULL';
  const langFilterCg  = lang ? 'cg.lang = ?' : 'cg.lang IS NULL';

  let messages: any[];

  if (since) {
    const { results } = await DB.prepare(
      `SELECT cg.id, cg.username, cg.faction, cg.server, cg.message, cg.created_at,
              COALESCE(u.is_admin, 0) AS is_admin, COALESCE(u.is_moderator, 0) AS is_moderator,
              cg.reply_to_id, rg.username AS reply_to_username, SUBSTR(rg.message, 1, 120) AS reply_to_text
       FROM chat_global cg
       LEFT JOIN users u ON cg.user_id = u.id
       LEFT JOIN chat_global rg ON cg.reply_to_id = rg.id
       WHERE ${langFilterCg} AND cg.created_at > ?
       ORDER BY cg.created_at ASC
       LIMIT ?`
    ).bind(...(lang ? [lang, since, limit] : [since, limit])).all();
    messages = results as any[];
  } else {
    const { results } = await DB.prepare(
      `SELECT cg.id, cg.username, cg.faction, cg.server, cg.message, cg.created_at,
              COALESCE(u.is_admin, 0) AS is_admin, COALESCE(u.is_moderator, 0) AS is_moderator,
              cg.reply_to_id, rg.username AS reply_to_username, SUBSTR(rg.message, 1, 120) AS reply_to_text
       FROM chat_global cg
       LEFT JOIN users u ON cg.user_id = u.id
       LEFT JOIN chat_global rg ON cg.reply_to_id = rg.id
       WHERE ${langFilterCg}
       ORDER BY cg.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...(lang ? [lang, limit, offset] : [limit, offset])).all();
    messages = (results as any[]).reverse();
  }

  const serverTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return Response.json(
    { messages, hasMore: messages.length === limit, server_time: serverTime },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const url  = new URL(ctx.request.url);
  const lang = url.searchParams.get('lang') ?? null;

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const message    = typeof body?.message     === 'string' ? body.message.trim() : '';
  const replyToId  = typeof body?.reply_to_id === 'string' ? body.reply_to_id   : null;

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
    `INSERT INTO chat_global (id, user_id, username, faction, server, lang, message, reply_to_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, user.user_id, user.username, user.faction, user.server, lang, message, replyToId).run();

  const created = await DB.prepare(
    `SELECT cg.id, cg.username, cg.faction, cg.server, cg.message, cg.created_at,
            cg.reply_to_id, rg.username AS reply_to_username, SUBSTR(rg.message, 1, 120) AS reply_to_text
     FROM chat_global cg
     LEFT JOIN chat_global rg ON cg.reply_to_id = rg.id
     WHERE cg.id = ?`
  ).bind(id).first() as any;

  return Response.json({ ...created, is_admin: user.is_admin, is_moderator: user.is_moderator }, { status: 201 });
}

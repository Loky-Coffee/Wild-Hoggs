// POST /api/chat/report — Report a message (requires auth)

import { getToken, validateSession } from '../../_lib/auth';

function genId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const { chat_type, message_id, reason } = body ?? {};

  const validTypes = ['global', 'global-lang', 'server', 'server-lang', 'pm'];
  if (!chat_type || !validTypes.includes(chat_type)) {
    return Response.json({ error: 'Ungültiger chat_type.' }, { status: 400 });
  }
  if (!message_id || typeof message_id !== 'string') {
    return Response.json({ error: 'message_id fehlt.' }, { status: 400 });
  }

  const table = chat_type === 'pm' ? 'chat_pm'
    : (chat_type === 'global' || chat_type === 'global-lang') ? 'chat_global'
    : 'chat_server';
  const msg = await DB.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(message_id).first();
  if (!msg) {
    return Response.json({ error: 'Nachricht nicht gefunden.' }, { status: 404 });
  }

  // Prevent duplicate reports from the same user
  const existing = await DB.prepare(
    'SELECT id FROM chat_reports WHERE message_id = ? AND reported_by = ?'
  ).bind(message_id, user.user_id).first();
  if (existing) {
    return Response.json({ error: 'Du hast diese Nachricht bereits gemeldet.' }, { status: 409 });
  }

  const id = genId();
  await DB.prepare(
    `INSERT INTO chat_reports (id, chat_type, message_id, reported_by, reason)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, chat_type, message_id, user.user_id, reason ?? null).run();

  return Response.json({ success: true, report_id: id }, { status: 201 });
}

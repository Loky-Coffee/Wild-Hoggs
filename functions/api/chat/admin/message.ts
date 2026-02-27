import { getToken, validateSession } from '../../../_lib/auth';

const VALID_CHAT_TYPES = ['global', 'global-lang', 'server', 'server-lang'] as const;

export async function onRequestDelete(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  if (user.is_admin !== 1) {
    return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const { chat_type, message_id } = body ?? {};

  if (!chat_type || !message_id) {
    return Response.json({ error: 'chat_type und message_id erforderlich' }, { status: 400 });
  }

  if (!VALID_CHAT_TYPES.includes(chat_type)) {
    return Response.json({ error: 'Ungültiger chat_type' }, { status: 400 });
  }

  const table = (chat_type === 'global' || chat_type === 'global-lang')
    ? 'chat_global'
    : 'chat_server';

  const existing = await DB.prepare(
    `SELECT id FROM ${table} WHERE id = ?`
  ).bind(message_id).first();

  if (!existing) {
    return Response.json({ error: 'Nachricht nicht gefunden' }, { status: 404 });
  }

  await DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(message_id).run();

  await DB.prepare(
    `UPDATE chat_reports SET status='resolved' WHERE message_id = ?`
  ).bind(message_id).run();

  return Response.json({ success: true });
}

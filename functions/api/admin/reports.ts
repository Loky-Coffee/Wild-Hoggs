import { getToken, validateSession } from '../../_lib/auth';

// GET /api/admin/reports — Open reports with message content
export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  if (user.is_admin !== 1 && user.is_moderator !== 1) {
    return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const result = await DB.prepare(`
    SELECT
      r.id AS report_id, r.chat_type, r.message_id,
      r.reason,
      r.created_at AS report_date,
      ur.username AS reporter,
      COALESCE(cg.username, cs.username) AS msg_author,
      COALESCE(cg.message, cs.message)   AS msg_text,
      COALESCE(cg.created_at, cs.created_at) AS msg_date
    FROM chat_reports r
    JOIN users ur ON r.reported_by = ur.id
    LEFT JOIN chat_global cg
      ON r.message_id = cg.id AND (r.chat_type = 'global' OR r.chat_type = 'global-lang')
    LEFT JOIN chat_server cs
      ON r.message_id = cs.id AND (r.chat_type = 'server' OR r.chat_type = 'server-lang')
    WHERE r.status = 'open'
    ORDER BY r.created_at DESC LIMIT 100
  `).all();

  return Response.json({ reports: result.results ?? [] });
}

// PATCH /api/admin/reports — Dismiss a report (without deleting the message)
export async function onRequestPatch(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  if (user.is_admin !== 1 && user.is_moderator !== 1) {
    return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const { report_id } = body ?? {};
  if (!report_id || typeof report_id !== 'string') {
    return Response.json({ error: 'report_id erforderlich' }, { status: 400 });
  }

  await DB.prepare(
    `UPDATE chat_reports SET status='dismissed' WHERE id = ?`
  ).bind(report_id).run();

  return Response.json({ success: true });
}

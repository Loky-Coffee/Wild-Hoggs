import { getToken, validateSession } from '../../_lib/auth';

// GET /api/admin/users — all users
export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  if (user.is_admin !== 1) {
    return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const { results } = await DB.prepare(
    `SELECT id, username, email, server, faction, is_admin, created_at
     FROM users
     ORDER BY is_admin DESC, username ASC`
  ).all();

  return Response.json({ users: results ?? [] });
}

// PATCH /api/admin/users — toggle is_admin for a user
export async function onRequestPatch(ctx: any) {
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

  const { user_id, is_admin } = body ?? {};

  if (!user_id || typeof user_id !== 'string') {
    return Response.json({ error: 'user_id erforderlich' }, { status: 400 });
  }
  if (is_admin !== 0 && is_admin !== 1) {
    return Response.json({ error: 'is_admin muss 0 oder 1 sein' }, { status: 400 });
  }
  if (user_id === user.user_id) {
    return Response.json({ error: 'Du kannst deinen eigenen Admin-Status nicht ändern' }, { status: 400 });
  }

  await DB.prepare(
    `UPDATE users SET is_admin = ? WHERE id = ?`
  ).bind(is_admin, user_id).run();

  return Response.json({ success: true });
}

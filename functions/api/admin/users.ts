import { getToken, validateSession } from '../../_lib/auth';

// GET /api/admin/users — all users (admins see emails; moderators do not)
export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  if (user.is_admin !== 1 && user.is_moderator !== 1) {
    return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const { results } = await DB.prepare(
    `SELECT u.id, u.username, u.email, u.server, u.faction,
            u.is_admin, COALESCE(u.is_moderator, 0) AS is_moderator,
            u.created_at,
            datetime(MAX(s.expires_at), '-30 days') AS last_login
     FROM users u
     LEFT JOIN sessions s ON s.user_id = u.id
     GROUP BY u.id
     ORDER BY u.is_admin DESC, COALESCE(u.is_moderator, 0) DESC, u.username ASC`
  ).all();

  // Moderators must not see other users' emails
  const isMod = user.is_admin !== 1 && user.is_moderator === 1;
  const users = (results ?? []).map((u: any) =>
    isMod ? { ...u, email: null } : u
  );

  return Response.json({ users });
}

// PATCH /api/admin/users — set a user's role (admin only)
export async function onRequestPatch(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  // Only admins may change roles
  if (user.is_admin !== 1) {
    return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const { user_id, role } = body ?? {};

  if (!user_id || typeof user_id !== 'string') {
    return Response.json({ error: 'user_id erforderlich' }, { status: 400 });
  }
  if (!['user', 'moderator', 'admin'].includes(role)) {
    return Response.json({ error: 'role muss user, moderator oder admin sein' }, { status: 400 });
  }
  if (user_id === user.user_id) {
    return Response.json({ error: 'Eigenen Status nicht änderbar' }, { status: 400 });
  }

  const is_admin     = role === 'admin'     ? 1 : 0;
  const is_moderator = role === 'moderator' ? 1 : 0;

  await DB.prepare(
    `UPDATE users SET is_admin = ?, is_moderator = ? WHERE id = ?`
  ).bind(is_admin, is_moderator, user_id).run();

  return Response.json({ success: true });
}

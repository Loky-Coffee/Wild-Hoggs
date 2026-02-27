import { getToken, validateSession } from '../_lib/auth';

// GET /api/reward-codes — public
export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const { results } = await DB.prepare(
    `SELECT id, code, image_key, expires_at, added_at FROM reward_codes ORDER BY added_at DESC`
  ).all();

  return Response.json({ codes: results ?? [] });
}

// POST /api/reward-codes — admin only
export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  if (user.is_admin !== 1) return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const { code, image_key, expires_at } = body ?? {};

  if (!code || typeof code !== 'string' || code.trim() === '') {
    return Response.json({ error: 'code ist erforderlich' }, { status: 400 });
  }

  const result = await DB.prepare(
    `INSERT INTO reward_codes (code, image_key, expires_at, created_by)
     VALUES (?, ?, ?, ?)
     RETURNING id, code, image_key, expires_at, added_at`
  ).bind(
    code.trim(),
    image_key ?? null,
    expires_at ?? null,
    user.user_id
  ).first() as any;

  return Response.json({ code: result }, { status: 201 });
}

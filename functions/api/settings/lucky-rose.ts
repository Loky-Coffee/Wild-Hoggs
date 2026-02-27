import { getToken, validateSession } from '../../_lib/auth';

// GET /api/settings/lucky-rose — public
export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const row = await DB.prepare(
    `SELECT value FROM app_settings WHERE key = 'lucky_rose_active'`
  ).first() as { value: string } | null;

  const active = row ? parseInt(row.value, 10) : 10;
  return Response.json({ active });
}

// PUT /api/settings/lucky-rose — admin only
export async function onRequestPut(ctx: any) {
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

  const { active } = body ?? {};
  if (typeof active !== 'number' || active < 1 || active > 10 || !Number.isInteger(active)) {
    return Response.json({ error: 'active muss eine ganze Zahl zwischen 1 und 10 sein' }, { status: 400 });
  }

  await DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('lucky_rose_active', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(String(active)).run();

  return Response.json({ active });
}

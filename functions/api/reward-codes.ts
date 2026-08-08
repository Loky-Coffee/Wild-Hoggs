import { getToken, validateSession } from '../_lib/auth';

// GET /api/reward-codes — öffentlich
//
// Zeigt nur bestätigte Codes. Was der Discord-Cron gefunden hat, wartet auf
// 'pending' und erscheint erst, wenn es im Admin-Panel freigegeben wurde.
//
// ?status=pending liefert die wartenden Funde — nur für Admins.
export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const wartend = new URL(ctx.request.url).searchParams.get('status') === 'pending';

  if (wartend) {
    const token = getToken(ctx.request);
    if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    const user = await validateSession(DB, token);
    if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
    if (user.is_admin !== 1) return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });

    const { results } = await DB.prepare(
      `SELECT id, code, image_key, expires_at, added_at, source, source_ref
         FROM reward_codes WHERE status = 'pending' ORDER BY added_at DESC`
    ).all();
    return Response.json({ codes: results ?? [] });
  }

  const { results } = await DB.prepare(
    `SELECT id, code, image_key, expires_at, added_at
       FROM reward_codes WHERE status = 'approved' ORDER BY added_at DESC`
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

  // Denselben Code kann der Discord-Cron schon als 'pending' abgelegt haben.
  // Trägt ein Admin ihn dann von Hand ein, ist das eine Bestätigung — sonst
  // liefe der eindeutige Index in einen Fehler.
  const result = await DB.prepare(
    `INSERT INTO reward_codes (code, image_key, expires_at, created_by, status, source)
     VALUES (?, ?, ?, ?, 'approved', 'manual')
     ON CONFLICT(code) DO UPDATE SET
       status     = 'approved',
       image_key  = COALESCE(excluded.image_key,  reward_codes.image_key),
       expires_at = COALESCE(excluded.expires_at, reward_codes.expires_at),
       created_by = excluded.created_by
     RETURNING id, code, image_key, expires_at, added_at`
  ).bind(
    code.trim().toUpperCase(),
    image_key ?? null,
    expires_at ?? null,
    user.user_id
  ).first() as any;

  return Response.json({ code: result }, { status: 201 });
}

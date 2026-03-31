// GET  /api/state/:calcType?key=main&profile=xxx  — load single state
// PUT  /api/state/:calcType?key=main&profile=xxx  — save single state

import { getToken, validateSession } from '../../_lib/auth';

async function resolveProfileId(DB: any, userId: string, requestedId: string | null): Promise<string | null> {
  if (requestedId) {
    // Verify the profile belongs to this user
    const row = await DB.prepare(
      'SELECT id FROM game_profiles WHERE id = ? AND user_id = ?'
    ).bind(requestedId, userId).first() as { id: string } | null;
    return row ? row.id : null;
  }
  // Fallback: use the user's first (oldest) profile
  const row = await DB.prepare(
    'SELECT id FROM game_profiles WHERE user_id = ? ORDER BY created_at ASC LIMIT 1'
  ).bind(userId).first() as { id: string } | null;
  return row?.id ?? null;
}

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const url      = new URL(ctx.request.url);
  const calcType = ctx.params.calcType as string;
  const calcKey  = url.searchParams.get('key') ?? 'main';
  const profileId = await resolveProfileId(DB, user.user_id, url.searchParams.get('profile'));
  if (!profileId) return Response.json({ error: 'Profil nicht gefunden' }, { status: 404 });

  const row = await DB.prepare(
    'SELECT state_json, updated_at FROM calculator_states WHERE user_id = ? AND profile_id = ? AND calc_type = ? AND calc_key = ?'
  ).bind(user.user_id, profileId, calcType, calcKey).first() as { state_json: string; updated_at: string } | null;

  if (!row) return Response.json({ error: 'Kein State gefunden' }, { status: 404 });

  return Response.json({
    state: JSON.parse(row.state_json),
    updated_at: row.updated_at
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPut(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const url      = new URL(ctx.request.url);
  const calcType = ctx.params.calcType as string;
  const calcKey  = url.searchParams.get('key') ?? 'main';
  const profileId = await resolveProfileId(DB, user.user_id, url.searchParams.get('profile'));
  if (!profileId) return Response.json({ error: 'Profil nicht gefunden' }, { status: 404 });

  let body: any;
  try { body = await ctx.request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body?.state) return Response.json({ error: 'Kein State übermittelt' }, { status: 400 });

  const now       = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const stateJson = JSON.stringify(body.state);

  await DB.prepare(`
    INSERT INTO calculator_states (user_id, profile_id, calc_type, calc_key, state_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, profile_id, calc_type, calc_key)
    DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
  `).bind(user.user_id, profileId, calcType, calcKey, stateJson, now).run();

  return Response.json({ success: true, updated_at: now });
}

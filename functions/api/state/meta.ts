// GET /api/state/meta?profile=xxx
// Returns ONLY timestamps — ~300 bytes, used for smart cache validation.
// Called at most once every 5 minutes per device (freshness window).

import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const profileId = new URL(ctx.request.url).searchParams.get('profile');

  let query: string;
  let bindings: unknown[];
  if (profileId) {
    // Verify ownership before filtering
    const profileRow = await DB.prepare(
      'SELECT id FROM game_profiles WHERE id = ? AND user_id = ?'
    ).bind(profileId, user.user_id).first() as { id: string } | null;
    if (!profileRow) return Response.json({}, { headers: { 'Cache-Control': 'no-store' } });

    query    = 'SELECT calc_type, calc_key, updated_at FROM calculator_states WHERE user_id = ? AND profile_id = ?';
    bindings = [user.user_id, profileId];
  } else {
    // No profile specified → use first profile
    const firstProfile = await DB.prepare(
      'SELECT id FROM game_profiles WHERE user_id = ? ORDER BY created_at ASC LIMIT 1'
    ).bind(user.user_id).first() as { id: string } | null;
    if (!firstProfile) return Response.json({}, { headers: { 'Cache-Control': 'no-store' } });

    query    = 'SELECT calc_type, calc_key, updated_at FROM calculator_states WHERE user_id = ? AND profile_id = ?';
    bindings = [user.user_id, firstProfile.id];
  }

  const { results } = await DB.prepare(query).bind(...bindings).all() as {
    results: Array<{ calc_type: string; calc_key: string; updated_at: string }>
  };

  const meta: Record<string, string> = {};
  for (const row of results) {
    meta[`${row.calc_type}:${row.calc_key}`] = row.updated_at;
  }

  return Response.json(meta, { headers: { 'Cache-Control': 'no-store' } });
}

// GET /api/state/meta
// Returns ONLY timestamps — ~300 bytes, used for smart cache validation.
// Called at most once every 5 minutes per device (freshness window).

import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);

  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const { results } = await DB.prepare(
    'SELECT calc_type, calc_key, updated_at FROM calculator_states WHERE user_id = ?'
  ).bind(user.user_id).all() as { results: Array<{ calc_type: string; calc_key: string; updated_at: string }> };

  const meta: Record<string, string> = {};
  for (const row of results) {
    meta[`${row.calc_type}:${row.calc_key}`] = row.updated_at;
  }

  return Response.json(meta, {
    headers: { 'Cache-Control': 'no-store' }
  });
}

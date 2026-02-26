// GET /api/state/all
// Returns ALL calculator states for the user.
// Called only on first visit to a new device (empty localStorage).

import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);

  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const { results } = await DB.prepare(
    'SELECT calc_type, calc_key, state_json, updated_at FROM calculator_states WHERE user_id = ?'
  ).bind(user.user_id).all() as {
    results: Array<{ calc_type: string; calc_key: string; state_json: string; updated_at: string }>
  };

  const states: Record<string, { state: unknown; updated_at: string }> = {};
  for (const row of results) {
    states[`${row.calc_type}:${row.calc_key}`] = {
      state: JSON.parse(row.state_json),
      updated_at: row.updated_at
    };
  }

  return Response.json(states, {
    headers: { 'Cache-Control': 'no-store' }
  });
}

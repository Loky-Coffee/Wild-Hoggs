// GET  /api/profiles       — list all profiles for the current user
// POST /api/profiles       — create a new profile

import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const { results } = await DB.prepare(
    'SELECT id, name, server, faction, created_at FROM game_profiles WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(user.user_id).all() as {
    results: Array<{ id: string; name: string; server: string | null; faction: string | null; created_at: string }>
  };

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  let body: any;
  try { body = await ctx.request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body?.name ?? '').trim();
  if (!name) return Response.json({ error: 'Name erforderlich' }, { status: 400 });
  if (name.length > 40) return Response.json({ error: 'Name zu lang (max 40)' }, { status: 400 });

  const id = 'p_' + Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const server  = body?.server  ? String(body.server).trim().slice(0, 20)  : null;
  const faction = body?.faction ? String(body.faction).trim().slice(0, 30) : null;

  await DB.prepare(
    'INSERT INTO game_profiles (id, user_id, name, server, faction) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, user.user_id, name, server, faction).run();

  return Response.json({ id, name, server, faction }, { status: 201 });
}

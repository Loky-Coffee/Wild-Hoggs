// PATCH  /api/profiles/:id  — rename / update server+faction of a profile
// DELETE /api/profiles/:id  — delete a profile (cannot delete the last one)

import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestPatch(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const profileId = ctx.params.id as string;

  // Verify ownership
  const profile = await DB.prepare(
    'SELECT id FROM game_profiles WHERE id = ? AND user_id = ?'
  ).bind(profileId, user.user_id).first() as { id: string } | null;
  if (!profile) return Response.json({ error: 'Profil nicht gefunden' }, { status: 404 });

  let body: any;
  try { body = await ctx.request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return Response.json({ error: 'Name erforderlich' }, { status: 400 });
    if (name.length > 40) return Response.json({ error: 'Name zu lang (max 40)' }, { status: 400 });
    fields.push('name = ?'); values.push(name);
  }
  if (body?.server !== undefined) {
    fields.push('server = ?');
    values.push(body.server ? String(body.server).trim().slice(0, 20) : null);
  }
  if (body?.faction !== undefined) {
    fields.push('faction = ?');
    values.push(body.faction ? String(body.faction).trim().slice(0, 30) : null);
  }
  if (body?.formation_power_br !== undefined) {
    fields.push('formation_power_br = ?');
    values.push(body.formation_power_br != null ? Number(body.formation_power_br) || null : null);
  }
  if (body?.formation_power_wd !== undefined) {
    fields.push('formation_power_wd = ?');
    values.push(body.formation_power_wd != null ? Number(body.formation_power_wd) || null : null);
  }
  if (body?.formation_power_go !== undefined) {
    fields.push('formation_power_go = ?');
    values.push(body.formation_power_go != null ? Number(body.formation_power_go) || null : null);
  }

  if (fields.length === 0) return Response.json({ error: 'Keine Änderungen' }, { status: 400 });

  values.push(profileId, user.user_id);
  await DB.prepare(
    `UPDATE game_profiles SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run();

  return Response.json({ success: true });
}

export async function onRequestDelete(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const profileId = ctx.params.id as string;

  // Count profiles — cannot delete the last one
  const countRow = await DB.prepare(
    'SELECT COUNT(*) as cnt FROM game_profiles WHERE user_id = ?'
  ).bind(user.user_id).first() as { cnt: number } | null;
  if (!countRow || countRow.cnt <= 1) {
    return Response.json({ error: 'Das letzte Profil kann nicht gelöscht werden' }, { status: 400 });
  }

  // Verify ownership
  const profile = await DB.prepare(
    'SELECT id FROM game_profiles WHERE id = ? AND user_id = ?'
  ).bind(profileId, user.user_id).first() as { id: string } | null;
  if (!profile) return Response.json({ error: 'Profil nicht gefunden' }, { status: 404 });

  // Delete profile + its calculator states
  await DB.prepare('DELETE FROM calculator_states WHERE user_id = ? AND profile_id = ?')
    .bind(user.user_id, profileId).run();
  await DB.prepare('DELETE FROM game_profiles WHERE id = ? AND user_id = ?')
    .bind(profileId, user.user_id).run();

  return Response.json({ success: true });
}

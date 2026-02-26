// PATCH /api/user/profile — update faction or language

import { getToken, validateSession } from '../../_lib/auth';

const VALID_FACTIONS = ['blood-rose', 'wings-of-dawn', 'guard-of-order'];
const VALID_LANGUAGES = ['de', 'en', 'fr', 'ko', 'th', 'ja', 'pt', 'es', 'tr', 'id', 'zh-TW', 'zh-CN', 'it', 'ar', 'vi'];

export async function onRequestPatch(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  let body: any;
  try { body = await ctx.request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.faction !== undefined) {
    if (body.faction !== null && !VALID_FACTIONS.includes(body.faction)) {
      return Response.json({ error: 'Ungültige Faction' }, { status: 400 });
    }
    updates.push('faction = ?');
    values.push(body.faction);
  }

  if (body.language !== undefined) {
    if (!VALID_LANGUAGES.includes(body.language)) {
      return Response.json({ error: 'Ungültige Sprache' }, { status: 400 });
    }
    updates.push('language = ?');
    values.push(body.language);
  }

  if (updates.length === 0) {
    return Response.json({ error: 'Nichts zum Aktualisieren' }, { status: 400 });
  }

  updates.push('updated_at = datetime(\'now\')');
  values.push(user.user_id);

  await DB.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const updated = await DB.prepare(
    'SELECT id, email, username, faction, language FROM users WHERE id = ?'
  ).bind(user.user_id).first() as any;

  return Response.json({
    id: updated.id,
    email: updated.email,
    username: updated.username,
    faction: updated.faction,
    language: updated.language
  });
}

import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);

  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  return Response.json({
    id: user.user_id,
    email: user.email,
    username: user.username,
    faction: user.faction,
    server: user.server,
    language: user.language,
    formation_power_br: user.formation_power_br ?? null,
    formation_power_wd: user.formation_power_wd ?? null,
    formation_power_go: user.formation_power_go ?? null,
    is_admin: user.is_admin ?? 0,
    is_moderator: user.is_moderator ?? 0,
  });
}

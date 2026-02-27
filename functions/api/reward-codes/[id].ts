import { getToken, validateSession } from '../../_lib/auth';

// DELETE /api/reward-codes/:id — admin only
export async function onRequestDelete(ctx: any) {
  const { DB, FILES } = ctx.env;
  const { id } = ctx.params;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  if (user.is_admin !== 1) return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });

  const existing = await DB.prepare(
    `SELECT id, image_key FROM reward_codes WHERE id = ?`
  ).bind(id).first() as { id: string; image_key: string | null } | null;

  if (!existing) return Response.json({ error: 'Code nicht gefunden' }, { status: 404 });

  await DB.prepare(`DELETE FROM reward_codes WHERE id = ?`).bind(id).run();

  if (existing.image_key && FILES) {
    try {
      await FILES.delete(existing.image_key);
    } catch {
      // R2 deletion failure is non-fatal
    }
  }

  return Response.json({ success: true });
}

import { getToken, validateSession } from '../../_lib/auth';
import { verlangt } from '../../_lib/permissions';

// PATCH /api/reward-codes/:id — admin only
//
// Gibt einen vom Discord-Cron gefundenen Code frei oder verwirft ihn. Beim
// Freigeben lässt sich zugleich ein Ablaufdatum setzen — das steht im
// Ankündigungstext, aber zuverlässig automatisch auslesen lässt es sich nicht.
//
// Verworfene Codes bleiben mit status='rejected' stehen statt gelöscht zu
// werden: sonst legt der nächste Lauf denselben Fehltreffer wieder an.
export async function onRequestPatch(ctx: any) {
  const { DB } = ctx.env;
  const { id } = ctx.params;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  const nein = verlangt(user, 'codes.approve');
  if (nein) return nein;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const { status, expires_at } = body ?? {};
  if (status !== 'approved' && status !== 'rejected') {
    return Response.json({ error: 'status muss approved oder rejected sein' }, { status: 400 });
  }

  const result = await DB.prepare(
    `UPDATE reward_codes
        SET status     = ?,
            expires_at = COALESCE(?, expires_at),
            created_by = ?
      WHERE id = ?
      RETURNING id, code, image_key, expires_at, added_at, status`
  ).bind(status, expires_at ?? null, user.user_id, id).first() as any;

  if (!result) return Response.json({ error: 'Code nicht gefunden' }, { status: 404 });

  return Response.json({ code: result });
}

// DELETE /api/reward-codes/:id — admin only
export async function onRequestDelete(ctx: any) {
  const { DB, FILES } = ctx.env;
  const { id } = ctx.params;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  const nein = verlangt(user, 'codes.manage');
  if (nein) return nein;

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

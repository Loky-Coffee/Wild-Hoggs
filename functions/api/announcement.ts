// GET    /api/announcement — öffentlich: die aktuelle Ankündigung (oder null)
// PUT    /api/announcement — nur Admin: Ankündigung setzen
// DELETE /api/announcement — nur Admin: Ankündigung entfernen
//
// Liegt als einzelner Eintrag in app_settings. Jede Ankündigung bekommt eine
// eigene id — der Client merkt sich die zuletzt weggeklickte und zeigt dieselbe
// dadurch nicht erneut.
//
// Zustellung: auf der Community-Seite sofort über den Chat-Hub, überall sonst
// beim nächsten Abruf durch den Hinweisbalken.

import { getToken, validateSession } from '../_lib/auth';
import { broadcastAnnounce } from '../_lib/chat-hub';
import { verlangt } from '../_lib/permissions';

const KEY = 'announcement';
const MAX_LEN = 300;

export interface Announcement {
  id: string;
  text: string;
  reload: boolean;
  created_at: string;
}

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;
  const row = await DB.prepare(
    `SELECT value FROM app_settings WHERE key = ?`
  ).bind(KEY).first() as { value: string } | null;

  let announcement: Announcement | null = null;
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (parsed && typeof parsed.text === 'string' && parsed.text) announcement = parsed;
    } catch { /* kaputter Eintrag -> keine Ankündigung */ }
  }

  return Response.json(
    { announcement },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function onRequestPut(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  const nein = verlangt(user, 'content.announcement');
  if (nein) return nein;

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return Response.json({ error: 'Text darf nicht leer sein.' }, { status: 400 });
  if (text.length > MAX_LEN) {
    return Response.json({ error: `Text zu lang (max. ${MAX_LEN} Zeichen).` }, { status: 400 });
  }

  const announcement: Announcement = {
    id:         crypto.randomUUID(),
    text,
    reload:     body?.reload === true,
    created_at: new Date().toISOString(),
  };

  await DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(KEY, JSON.stringify(announcement)).run();

  // Wer gerade im Chat ist, sieht sie sofort.
  broadcastAnnounce(ctx, announcement);

  return Response.json({ announcement });
}

export async function onRequestDelete(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  const nein = verlangt(user, 'content.announcement');
  if (nein) return nein;

  await DB.prepare(`DELETE FROM app_settings WHERE key = ?`).bind(KEY).run();
  return Response.json({ success: true });
}

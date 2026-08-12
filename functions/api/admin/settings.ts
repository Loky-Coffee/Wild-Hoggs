import { getToken, validateSession } from '../../_lib/auth';
import { verlangt } from '../../_lib/permissions';
import { ladeEinstellungen, pruefeWert, EINSTELLUNGEN } from '../../_lib/settings';

// GET /api/admin/settings — aktuelle Betriebseinstellungen
export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const nein = verlangt(user, 'system.settings');
  if (nein) return nein;

  return Response.json({
    settings: await ladeEinstellungen(DB),
    // Grenzen mitschicken, damit die Oberfläche nicht raten muss, was erlaubt ist
    schema: EINSTELLUNGEN,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// PUT /api/admin/settings — eine oder mehrere Einstellungen ändern
//
// Erwartet { settings: { key: wert, … } }. Unbekannte Schlüssel werden still
// übergangen, Zahlen auf ihren erlaubten Bereich begrenzt — so kann eine
// manipulierte Anfrage keine unsinnigen Werte hinterlassen.
export async function onRequestPut(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const nein = verlangt(user, 'system.settings');
  if (nein) return nein;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const eingang = body?.settings;
  if (!eingang || typeof eingang !== 'object') {
    return Response.json({ error: 'settings-Objekt erwartet' }, { status: 400 });
  }

  const schreiben = [];
  for (const [key, roh] of Object.entries(eingang)) {
    const wert = pruefeWert(key, roh);
    if (wert === null) continue;
    schreiben.push(
      DB.prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).bind(key, String(wert))
    );
  }

  if (schreiben.length === 0) {
    return Response.json({ error: 'Keine gültige Einstellung dabei' }, { status: 400 });
  }

  await DB.batch(schreiben);

  return Response.json({ success: true, settings: await ladeEinstellungen(DB) });
}

// GET /api/chat/pm-contacts — mit wem habe ich private Nachrichten ausgetauscht?
//
// Diese Frage konnte bisher niemand beantworten. Die Gesprächsliste lag
// ausschliesslich im Browser-Speicher des jeweiligen Geräts (wh-pm-contacts),
// deshalb war eine am Telefon begonnene Unterhaltung am Rechner unsichtbar —
// obwohl die Nachrichten längst in der Datenbank standen.
//
// pm-inbox beantwortet etwas anderes: Es liefert nur EINGEHENDE Nachrichten
// seit einem Zeitpunkt, gruppiert nach Absender, und beim ersten Aufruf ohne
// diesen Zeitpunkt gar nichts. Für "womit habe ich angefangen" taugt es nicht.
//
// Hier zählen beide Richtungen: geschriebene wie empfangene Nachrichten.

import { getToken, validateSession } from '../../_lib/auth';

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  // Der Gegenüber ist mal Absender, mal Empfänger — CASE dreht das je Zeile um.
  // Sortiert nach der jüngsten Nachricht, damit die Liste dieselbe Reihenfolge
  // hat wie im Chat-Fenster.
  const { results } = await DB.prepare(
    `SELECT u.username AS username, MAX(p.created_at) AS last_at
       FROM chat_pm p
       JOIN users u
         ON u.id = CASE WHEN p.sender_id = ?1 THEN p.receiver_id ELSE p.sender_id END
      WHERE p.sender_id = ?1 OR p.receiver_id = ?1
      GROUP BY u.id
      ORDER BY last_at DESC
      LIMIT 30`
  ).bind(user.user_id).all();

  return Response.json(
    { contacts: (results ?? []).map((r: any) => r.username) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

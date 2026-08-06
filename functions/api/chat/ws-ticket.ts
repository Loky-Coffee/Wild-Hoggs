// POST /api/chat/ws-ticket   { "type": "global-lang" }
//
// Liefert ein 60 Sekunden gültiges Ticket für den WebSocket-Handshake zum
// Chat-Hub. Die Identität (Name, Server, Sprache, Rollen) wird hier
// serverseitig aus der Sitzung genommen und signiert — der Client kann sich
// also weder einen fremden Namen noch einen fremden Server erschleichen.

import { getToken, validateSession } from '../../_lib/auth';
import { createTicket, type ChatType } from '../../_lib/chat-hub';

const ALL_TYPES: ChatType[] = ['global', 'global-lang', 'server', 'server-lang'];

export async function onRequestPost(ctx: any) {
  const { DB, HUB_SECRET, HUB_URL } = ctx.env;

  // Anmeldung zuerst prüfen — der Konfigurationszustand geht Unangemeldete nichts an.
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  // Nur ein Ticket ausgeben, wenn der Hub WIRKLICH vollständig eingerichtet ist.
  // Das CHAT_HUB-Binding gehört zwingend dazu: Ohne es kann die Sendeseite nicht
  // broadcasten. Der Client würde sich sonst erfolgreich verbinden, das Polling
  // aussetzen — und nie etwas empfangen.
  if (!HUB_SECRET || !HUB_URL || !ctx.env.CHAT_HUB) {
    return Response.json({ error: 'Hub nicht konfiguriert' }, { status: 503 });
  }

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const type: ChatType = ALL_TYPES.includes(body?.type) ? body.type : 'global';

  // Der Server, den die Person gerade nutzt — aus dem Profil, nicht vom Client.
  const requested: string | null = typeof body?.server === 'string' && body.server ? body.server : null;
  let server: string | null = user.server ?? null;
  if (requested) {
    const match = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM game_profiles WHERE user_id = ? AND server = ?`
    ).bind(user.user_id, requested).first() as { cnt: number } | null;
    if ((match?.cnt ?? 0) > 0 || user.server === requested) server = requested;
  }

  const ticket = await createTicket(HUB_SECRET, {
    username:     user.username,
    server,
    language:     user.language,
    faction:      user.faction,
    is_admin:     user.is_admin,
    is_moderator: user.is_moderator,
  }, type);

  // Die Hub-Adresse kommt aus der Umgebung, nicht aus dem Client-Code — so muss
  // beim Deploy nichts im Frontend angefasst werden.
  const base = String(HUB_URL).replace(/^http/, 'ws').replace(/\/+$/, '');

  return Response.json(
    { ticket, url: `${base}/connect` },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

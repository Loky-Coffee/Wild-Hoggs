// POST /api/chat/ws-ticket   { "type": "global-lang", "server": "123" }
//
// Liefert ein 60 Sekunden gültiges Ticket für den WebSocket-Handshake zum
// Chat-Hub. Der Kanal wird hier serverseitig bestimmt — der Client kann sich
// keinen Kanal aussuchen, den er nicht betreten darf.

import { getToken, validateSession } from '../../_lib/auth';
import { channelKey, createTicket } from '../../_lib/chat-hub';

type ChatType = 'global' | 'global-lang' | 'server' | 'server-lang';
const ALL_TYPES: ChatType[] = ['global', 'global-lang', 'server', 'server-lang'];

export async function onRequestPost(ctx: any) {
  const { DB, HUB_SECRET, HUB_URL } = ctx.env;

  // Anmeldung zuerst prüfen — der Konfigurationszustand geht Unangemeldete nichts an.
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  // Ohne Secret ODER URL gibt es keinen WebSocket — der Client bleibt dann
  // einfach beim Polling. Deshalb 503: "gibt es hier nicht", kein Fehler.
  if (!HUB_SECRET || !HUB_URL) {
    return Response.json({ error: 'Hub nicht konfiguriert' }, { status: 503 });
  }

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const type: ChatType = ALL_TYPES.includes(body?.type) ? body.type : 'global';
  const server: string | null = typeof body?.server === 'string' && body.server ? body.server : null;
  const userLang = user.language?.trim() ? user.language.trim() : null;

  const isServerType = type === 'server' || type === 'server-lang';
  const isLangType   = type === 'global-lang' || type === 'server-lang';

  if (isLangType && !userLang) {
    return Response.json({ error: 'Keine Sprache gesetzt' }, { status: 400 });
  }

  // Server-Kanäle nur mit passendem Profil — gleiche Regel wie in
  // /api/chat/server/:name und /api/chat/sync.
  if (isServerType) {
    if (!server) return Response.json({ error: 'Kein Server' }, { status: 400 });
    const match = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM game_profiles WHERE user_id = ? AND server = ?`
    ).bind(user.user_id, server).first() as { cnt: number } | null;
    const allowed = (match?.cnt ?? 0) > 0 || user.server === server;
    if (!allowed) {
      return Response.json({ error: 'Kein Zugriff auf diesen Server-Chat.' }, { status: 403 });
    }
  }

  const channel = channelKey(
    isServerType ? 'server' : 'global',
    server,
    isLangType ? userLang : null,
  );

  // Die Hub-Adresse kommt aus der Umgebung, nicht aus dem Client-Code — so muss
  // beim Deploy nichts im Frontend angefasst werden.
  const base = String(HUB_URL).replace(/^http/, 'ws').replace(/\/+$/, '');

  return Response.json(
    { ticket: await createTicket(HUB_SECRET, channel), channel, url: `${base}/connect` },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

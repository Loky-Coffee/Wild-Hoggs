// Live-Verteiler für den Wild-Hoggs-Chat.
//
// EIN Durable Object hält alle offenen Verbindungen. Er weiß zu jedem Socket,
// wer dahintersteckt (Name, Server, Sprache) und welchen Tab die Person gerade
// offen hat — und kann daraus selbst entscheiden, wer was bekommt:
//
//   • neue Nachricht im offenen Tab      -> 'message'
//   • neue Nachricht in einem anderen,
//     für die Person sichtbaren Kanal    -> 'unread'
//   • private Nachricht                  -> 'pm'  (gezielt an eine Person)
//   • jemand kommt/geht                  -> 'presence' (an alle)
//
// Gespeichert wird nichts: die Nachrichten liegen in D1 und werden weiterhin
// von den Pages Functions geschrieben. Fällt dieser Worker aus, verliert
// niemand Daten — die Clients fallen auf ihren Poll zurück.
//
// Warum ein einziger DO statt einem pro Kanal: Nur so kann eine einzige
// Verbindung pro Person alles abdecken. Das Soft-Limit liegt bei 1.000
// Anfragen pro Sekunde — bei dieser Nutzerzahl um Größenordnungen entfernt.

export interface Env {
  CHAT_ROOM:  DurableObjectNamespace;
  HUB_SECRET: string;
}

export type ChatType = 'global' | 'global-lang' | 'server' | 'server-lang';
const ALL_TYPES: ChatType[] = ['global', 'global-lang', 'server', 'server-lang'];

// Was pro Verbindung gemerkt wird. Überlebt die Hibernation über
// serializeAttachment, deshalb bewusst knapp gehalten.
interface Session {
  u: string;          // username
  s: string | null;   // server
  l: string | null;   // language
  c: ChatType;        // aktuell geöffneter Tab
  a: 0 | 1;           // is_admin
  m: 0 | 1;           // is_moderator
  f: string | null;   // faction
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from((hex.match(/.{2}/g) ?? []).map(b => parseInt(b, 16)));
}

// Der Client kann beim WebSocket-Handshake keinen Authorization-Header setzen.
// Statt das Session-Token in die URL zu hängen (landet in Logs, lebt 30 Tage),
// stellt die Pages Function ein kurzlebiges, signiertes Ticket aus. Es trägt
// die Identität — der Client kann sie also nicht selbst behaupten.
async function verifyTicket(ticket: string | null, secret: string): Promise<Session | null> {
  if (!ticket) return null;
  const dot = ticket.lastIndexOf('.');
  if (dot < 1) return null;

  const body = ticket.slice(0, dot);
  const sig  = ticket.slice(dot + 1);
  if (!/^[0-9a-f]+$/.test(sig)) return null;

  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'HMAC', key, hexToBytes(sig), new TextEncoder().encode(body),
    );
    if (!ok) return null;

    const p = JSON.parse(atob(body)) as any;
    if (typeof p.exp !== 'number' || Date.now() > p.exp) return null;
    if (typeof p.u !== 'string' || !p.u) return null;

    return {
      u: p.u,
      s: typeof p.s === 'string' && p.s ? p.s : null,
      l: typeof p.l === 'string' && p.l ? p.l : null,
      c: ALL_TYPES.includes(p.c) ? p.c : 'global',
      a: p.a === 1 ? 1 : 0,
      m: p.m === 1 ? 1 : 0,
      f: typeof p.f === 'string' && p.f ? p.f : null,
    };
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Interne Aufrufe aus den Pages Functions
    if (url.pathname.startsWith('/broadcast')) {
      const secret = request.headers.get('X-Hub-Secret') ?? '';
      if (!env.HUB_SECRET || !safeEqual(secret, env.HUB_SECRET)) {
        return new Response('forbidden', { status: 403 });
      }
      return hub(env).fetch(request);
    }

    if (url.pathname === '/connect') {
      // Auth zuerst: ohne gültiges Ticket gibt es 401, egal was sonst im
      // Request steht.
      const session = await verifyTicket(url.searchParams.get('t'), env.HUB_SECRET);
      if (!session) return new Response('unauthorized', { status: 401 });

      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }
      // Die geprüfte Identität wandert im Header zum DO — der Client hat darauf
      // keinen Einfluss mehr.
      const req = new Request(request, {
        headers: new Headers([...request.headers, ['X-Session', JSON.stringify(session)]]),
      });
      return hub(env).fetch(req);
    }

    return new Response('not found', { status: 404 });
  },
};

// Alle Verbindungen landen in derselben Instanz.
function hub(env: Env) {
  return env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('hub-v1'));
}

// Klassenname bleibt ChatRoom, damit keine Durable-Object-Migration nötig ist.
export class ChatRoom {
  // Bei Hibernation läuft der Konstruktor beim Aufwachen erneut — hier deshalb
  // bewusst keine Arbeit verrichten.
  constructor(private ctx: DurableObjectState, private env: Env) {}

  // ── Wer sieht welchen Kanal? ────────────────────────────────────────────────
  // Liefert den Tab-Typ, unter dem eine Nachricht bei dieser Person erscheint —
  // oder null, wenn sie den Kanal gar nicht sehen darf.
  private tabFor(s: Session, scope: 'global' | 'server', server: string | null, lang: string | null): ChatType | null {
    if (scope === 'global') {
      if (!lang) return 'global';
      return s.l && s.l === lang ? 'global-lang' : null;
    }
    if (!server || s.s !== server) return null;
    if (!lang) return 'server';
    return s.l && s.l === lang ? 'server-lang' : null;
  }

  private sessionOf(ws: WebSocket): Session | null {
    try { return ws.deserializeAttachment() as Session; } catch { return null; }
  }

  // Online-Liste aus den offenen Verbindungen — pro Person nur einmal, auch
  // wenn sie mehrere Tabs offen hat.
  //
  // `leaving` schliesst eine Verbindung aus: Beim Schliessen steht sie noch in
  // getWebSockets(), die Person waere sonst weiterhin als online gelistet.
  private onlineUsers(leaving?: WebSocket) {
    const byName = new Map<string, any>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === leaving) continue;
      const s = this.sessionOf(ws);
      if (!s) continue;
      if (!byName.has(s.u)) {
        byName.set(s.u, {
          username: s.u, faction: s.f, server: s.s, language: s.l,
          is_admin: s.a, is_moderator: s.m,
        });
      }
    }
    return [...byName.values()].sort((a, b) => a.username.localeCompare(b.username));
  }

  private send(ws: WebSocket, payload: unknown) {
    try { ws.send(JSON.stringify(payload)); } catch { /* tote Verbindung */ }
  }

  private broadcastPresence(leaving?: WebSocket) {
    const msg = JSON.stringify({ type: 'presence', users: this.onlineUsers(leaving) });
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === leaving) continue;
      try { ws.send(msg); } catch { /* ignore */ }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ── Neue Kanal-Nachricht ────────────────────────────────────────────────
    if (url.pathname === '/broadcast/message') {
      const body = await request.json() as {
        scope: 'global' | 'server'; server: string | null; lang: string | null; message: any;
      };
      let delivered = 0, notified = 0;

      for (const ws of this.ctx.getWebSockets()) {
        const s = this.sessionOf(ws);
        if (!s) continue;
        const tab = this.tabFor(s, body.scope, body.server, body.lang);
        if (!tab) continue;                       // darf den Kanal nicht sehen

        if (tab === s.c) {
          this.send(ws, { type: 'message', message: body.message });
          delivered++;
        } else {
          // Anderer Tab -> nur ein Ungelesen-Hinweis, nicht die Nachricht selbst
          this.send(ws, { type: 'unread', channel: tab });
          notified++;
        }
      }
      return Response.json({ delivered, notified });
    }

    // ── Private Nachricht ───────────────────────────────────────────────────
    if (url.pathname === '/broadcast/pm') {
      const body = await request.json() as { to: string; from: string; message: any };
      let delivered = 0;
      for (const ws of this.ctx.getWebSockets()) {
        const s = this.sessionOf(ws);
        if (!s || s.u !== body.to) continue;
        this.send(ws, { type: 'pm', from: body.from, message: body.message });
        delivered++;
      }
      return Response.json({ delivered });
    }

    // ── Ankündigung vom Betreiber ───────────────────────────────────────────
    if (url.pathname === '/broadcast/announce') {
      const body = await request.json() as { announcement: any };
      let delivered = 0;
      for (const ws of this.ctx.getWebSockets()) {
        this.send(ws, { type: 'announce', announcement: body.announcement });
        delivered++;
      }
      return Response.json({ delivered });
    }

    // ── Gelöschte Nachricht ─────────────────────────────────────────────────
    if (url.pathname === '/broadcast/delete') {
      const body = await request.json() as { id: string };
      for (const ws of this.ctx.getWebSockets()) {
        this.send(ws, { type: 'delete', id: body.id });
      }
      return Response.json({ ok: true });
    }

    // ── Neue Verbindung ─────────────────────────────────────────────────────
    const raw = request.headers.get('X-Session');
    if (!raw) return new Response('missing session', { status: 400 });
    const session = JSON.parse(raw) as Session;

    const pair = new WebSocketPair();
    const server = pair[1];
    // acceptWebSocket statt accept: Hibernation. Solange nichts passiert,
    // fallen keine Laufzeitkosten an, die Clients bleiben verbunden.
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(session);

    // Die neue Verbindung bekommt sofort die Online-Liste, alle anderen die
    // aktualisierte.
    this.send(server, { type: 'presence', users: this.onlineUsers() });
    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // ── Nachrichten vom Client ────────────────────────────────────────────────
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return;
    if (message === 'ping') { this.send(ws, { type: 'pong' }); return; }

    try {
      const msg = JSON.parse(message) as { type?: string; c?: ChatType };
      // Tabwechsel: ab jetzt gehen Nachrichten dieses Kanals als 'message'
      // durch statt als 'unread'.
      if (msg.type === 'channel' && ALL_TYPES.includes(msg.c as ChatType)) {
        const s = this.sessionOf(ws);
        if (s) { s.c = msg.c as ChatType; ws.serializeAttachment(s); }
      }
    } catch { /* kaputte Nachricht ignorieren */ }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    // 1006 darf nicht zurückgegeben werden — Cloudflare lehnt den Code ab.
    try { ws.close(code === 1006 ? 1000 : code, 'closing'); } catch { /* ignore */ }
    this.broadcastPresence(ws);
  }

  async webSocketError(ws: WebSocket) {
    try { ws.close(1011, 'error'); } catch { /* ignore */ }
    this.broadcastPresence(ws);
  }
}

// Broadcast-Relay für den Wild-Hoggs-Chat.
//
// Der Durable Object hält nur die offenen WebSocket-Verbindungen eines Kanals
// und leitet neue Nachrichten weiter. Er speichert nichts: die Nachrichten
// liegen weiterhin in D1 und werden von den Pages Functions geschrieben.
// Fällt dieser Worker aus, verliert niemand Daten — die Clients fallen auf
// ihren Poll (/api/chat/sync) zurück.
//
// Zwei Einstiegspunkte:
//   GET  /connect?t=<ticket>       — Client-Verbindung (WebSocket-Upgrade)
//   POST /broadcast?channel=<key>  — interner Aufruf aus der Pages Function

export interface Env {
  CHAT_ROOM:  DurableObjectNamespace;
  HUB_SECRET: string;
}

const CHANNEL_RE = /^[a-z0-9-]{1,64}$/;

// Konstantzeit-Vergleich, damit sich das Secret nicht über Laufzeitunterschiede
// erraten lässt.
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
// Statt das Session-Token in die URL zu hängen (landet in Logs und lebt 30 Tage),
// stellt die Pages Function ein kurzlebiges, signiertes Ticket für genau einen
// Kanal aus. Hier wird es ohne jeden Datenbankzugriff geprüft.
async function verifyTicket(ticket: string | null, secret: string): Promise<{ c: string } | null> {
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

    const payload = JSON.parse(atob(body)) as { c: string; exp: number };
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    if (typeof payload.c !== 'string' || !CHANNEL_RE.test(payload.c)) return null;
    return { c: payload.c };
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── Interner Broadcast aus der Pages Function ────────────────────────────
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const secret = request.headers.get('X-Hub-Secret') ?? '';
      if (!env.HUB_SECRET || !safeEqual(secret, env.HUB_SECRET)) {
        return new Response('forbidden', { status: 403 });
      }
      const channel = url.searchParams.get('channel') ?? '';
      if (!CHANNEL_RE.test(channel)) {
        return new Response('bad channel', { status: 400 });
      }
      const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(channel));
      return stub.fetch(request);
    }

    // ── Client-Verbindung ────────────────────────────────────────────────────
    if (url.pathname === '/connect') {
      // Auth zuerst: ohne gültiges Ticket gibt es 401, unabhängig davon, was
      // sonst im Request steht.
      const payload = await verifyTicket(url.searchParams.get('t'), env.HUB_SECRET);
      if (!payload) return new Response('unauthorized', { status: 401 });

      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }

      const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(payload.c));
      return stub.fetch(request);
    }

    return new Response('not found', { status: 404 });
  },
};

export class ChatRoom {
  // Bei Hibernation läuft der Konstruktor beim Aufwachen erneut — deshalb hier
  // bewusst keine Arbeit verrichten.
  constructor(private ctx: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/broadcast') {
      const payload = await request.text();
      let delivered = 0;
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.send(payload); delivered++; } catch { /* tote Verbindung */ }
      }
      return Response.json({ delivered });
    }

    const pair = new WebSocketPair();
    // acceptWebSocket statt accept: aktiviert die Hibernation-API. Solange nichts
    // passiert, fallen keine Laufzeitkosten an, die Clients bleiben verbunden.
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // Der Client schickt nur Keepalive-Pings.
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === 'ping') {
      try { ws.send('pong'); } catch { /* ignore */ }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean) {
    // 1006 darf nicht zurückgegeben werden — Cloudflare lehnt den Code ab.
    try { ws.close(code === 1006 ? 1000 : code, 'closing'); } catch { /* ignore */ }
  }

  async webSocketError(ws: WebSocket) {
    try { ws.close(1011, 'error'); } catch { /* ignore */ }
  }
}

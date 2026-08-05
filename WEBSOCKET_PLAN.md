# WebSocket-Umstellung für den Chat — Umsetzungsplan

**Ziel:** Das 5-Sekunden-Polling durch eine WebSocket-Verbindung ersetzen, ohne dass
die Website dabei kaputtgehen kann.

**Warum:** Der Free-Plan von Cloudflare erlaubt 100.000 Requests/Tag (geteilt zwischen
Pages Functions und Workers; statische Seiten zählen nicht mit). Das aktuelle Polling
verbraucht ~2.760 Requests pro Nutzerstunde auf der Community-Seite — rund 36
Nutzerstunden täglich reichen, um das Limit zu sprengen. Mit WebSockets sind es
~140 Requests **pro Tag** bei 30 Nutzern.

**Kosten:** 0 €. Durable Objects mit SQLite-Backend sind im Free Plan enthalten,
eingehende WS-Nachrichten werden 20:1 abgerechnet, und mit der Hibernation-API
fallen im Leerlauf keine Laufzeitkosten an.

---

## Grundidee: der DO ist nur ein Lautsprecher

Der wichtigste Entwurfsentscheid — er hält das Risiko klein:

```
                         bleibt exakt wie heute
                    ┌──────────────────────────────┐
   Nachricht        │  POST /api/chat/global       │
   senden  ─────────┤  → Rate-Limit prüfen         │
                    │  → in D1 schreiben           │
                    │  → fertige Nachricht zurück  │
                    └──────────────┬───────────────┘
                                   │  NEU: danach zusätzlich
                                   ▼
                    ┌──────────────────────────────┐
                    │  ChatRoom (Durable Object)   │
                    │  hält die offenen Sockets    │
                    │  und schickt die Nachricht   │
                    │  an alle weiter              │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
          Client A             Client B             Client C
```

Daraus folgt:

- **Senden bleibt unverändert** — HTTP-POST, Rate-Limiting, Validierung, D1-Insert.
  Kein einziger Handgriff an der bestehenden Logik.
- **Die Historie bleibt in D1** — der DO speichert nichts. Beim Öffnen des Chats
  lädt der Client die letzten 50 Nachrichten wie bisher per GET.
- **Nur das Empfangen wechselt** vom Poll auf den Socket.
- **Der DO kann nichts kaputtmachen**, weil er keine Datenhoheit hat. Fällt er aus,
  greift der Polling-Fallback und alles läuft wie heute.

---

## Phase 1 — Chat-Hub-Worker anlegen (Risiko: keins)

Cloudflare erlaubt es nicht, Durable Objects innerhalb eines Pages-Projekts zu
definieren („You cannot create and deploy a Durable Object within a Pages project").
Der DO braucht daher ein eigenes, kleines Worker-Projekt, an das sich Pages bindet.

In dieser Phase wird der Worker nur deployt — die Website weiß noch nichts von ihm.
Es kann also nichts passieren.

### `chat-hub/wrangler.toml`

```toml
name = "wild-hoggs-chat-hub"
main = "src/index.ts"
compatibility_date = "2026-08-01"

[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

# WICHTIG: new_sqlite_classes (nicht new_classes) — nur das SQLite-Backend
# ist im Free Plan verfügbar.
[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]
```

### `chat-hub/src/index.ts`

```ts
// Broadcast-Relay für den Chat. Speichert nichts — die Nachrichten liegen in D1.

export interface Env {
  CHAT_ROOM:  DurableObjectNamespace;
  HUB_SECRET: string;
}

// ── Ticket-Prüfung ────────────────────────────────────────────────────────────
// Der Client kann beim WS-Handshake keinen Authorization-Header setzen. Statt das
// Session-Token in die URL zu hängen (landet in Logs), stellt die Pages Function
// ein kurzlebiges, signiertes Einmal-Ticket aus, das hier verifiziert wird —
// ohne D1-Zugriff.
async function verifyTicket(ticket: string | null, secret: string) {
  if (!ticket) return null;
  const [body, sig] = ticket.split('.');
  if (!body || !sig) return null;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  const sigBytes = Uint8Array.from(
    (sig.match(/.{2}/g) ?? []).map(b => parseInt(b, 16)),
  );
  const ok = await crypto.subtle.verify(
    'HMAC', key, sigBytes, new TextEncoder().encode(body),
  );
  if (!ok) return null;

  try {
    const payload = JSON.parse(atob(body)) as { c: string; exp: number };
    if (Date.now() > payload.exp) return null;   // abgelaufen
    return payload;
  } catch { return null; }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Interner Broadcast-Aufruf aus der Pages Function
    if (url.pathname === '/broadcast') {
      if (request.headers.get('X-Hub-Secret') !== env.HUB_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const channel = url.searchParams.get('channel');
      if (!channel) return new Response('missing channel', { status: 400 });

      const id = env.CHAT_ROOM.idFromName(channel);
      return env.CHAT_ROOM.get(id).fetch(request);
    }

    // Client-Verbindung
    if (url.pathname === '/connect') {
      const payload = await verifyTicket(url.searchParams.get('t'), env.HUB_SECRET);
      if (!payload) return new Response('unauthorized', { status: 401 });

      const id = env.CHAT_ROOM.idFromName(payload.c);
      return env.CHAT_ROOM.get(id).fetch(request);
    }

    return new Response('not found', { status: 404 });
  },
};

export class ChatRoom {
  // Bei Hibernation läuft der Konstruktor beim Aufwachen erneut — hier deshalb
  // bewusst nichts tun.
  constructor(private ctx: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/broadcast') {
      const payload = await request.text();
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.send(payload); } catch { /* tote Verbindung, ignorieren */ }
      }
      return new Response('ok');
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    // acceptWebSocket (statt accept) = Hibernation: keine Laufzeitkosten,
    // solange nichts passiert.
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // Der Client schickt nur Keepalive-Pings.
  async webSocketMessage(ws: WebSocket, msg: string) {
    if (msg === 'ping') ws.send('pong');
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try { ws.close(code, 'closing'); } catch { /* ignore */ }
  }

  async webSocketError(ws: WebSocket) {
    try { ws.close(1011, 'error'); } catch { /* ignore */ }
  }
}
```

### Deployen

```bash
cd chat-hub
npm install -D wrangler
npx wrangler deploy
npx wrangler secret put HUB_SECRET     # langen Zufallswert eingeben, sicher notieren
```

**Prüfen:** `curl https://wild-hoggs-chat-hub.<subdomain>.workers.dev/connect`
muss `401 unauthorized` liefern. Dann steht der Worker.

---

## Phase 2 — Pages-Seite anbinden (Risiko: sehr gering)

Ab hier weiß die Website vom Hub, aber die Clients nutzen ihn noch nicht.

### `wrangler.toml` (Hauptprojekt) ergänzen

```toml
[[durable_objects.bindings]]
name        = "CHAT_HUB"
class_name  = "ChatRoom"
script_name = "wild-hoggs-chat-hub"    # Verweis auf den externen Worker
```

Zusätzlich `HUB_SECRET` als Secret im Pages-Projekt hinterlegen (Dashboard →
Settings → Environment Variables, als *Secret*, **derselbe Wert** wie im Worker).

### Kanal-Schlüssel — an einer Stelle definieren

Neue Datei `functions/_lib/chat-channel.ts`:

```ts
// Kanal-Schlüssel für Durable-Object-Routing. Muss auf Client und Server
// identisch berechnet werden.
export function channelKey(
  scope: 'global' | 'server',
  serverName: string | null,
  lang: string | null,
): string {
  const base = scope === 'global' ? 'global' : `server-${serverName}`;
  return lang ? `${base}-${lang}` : base;
}
```

### Neu: `functions/api/chat/ws-ticket.ts`

```ts
// POST /api/chat/ws-ticket  { channel: "global-de" }
// Liefert ein 60 Sekunden gültiges, signiertes Ticket für den WS-Handshake.

import { getToken, validateSession } from '../../_lib/auth';

const TTL_MS = 60_000;

export async function onRequestPost(ctx: any) {
  const { DB, HUB_SECRET } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const channel = typeof body?.channel === 'string' ? body.channel : '';
  if (!/^[a-z0-9-]{1,64}$/.test(channel)) {
    return Response.json({ error: 'Ungültiger Kanal' }, { status: 400 });
  }

  // TODO beim Umsetzen: prüfen, dass der Nutzer diesen Kanal betreten darf
  // (Server-Kanal nur mit passendem activeProfile.server, Sprachkanal nur mit
  // passender user.language) — dieselbe Logik wie in buildUrl() im ChatWindow.

  const payload = btoa(JSON.stringify({ c: channel, exp: Date.now() + TTL_MS }));

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(HUB_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(payload),
  );
  const sig = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return Response.json(
    { ticket: `${payload}.${sig}` },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
```

### Broadcast im bestehenden POST ergänzen

In `functions/api/chat/global.ts` und `functions/api/chat/server/[serverName].ts`,
jeweils direkt vor dem `return` von `onRequestPost`:

```ts
const full = { ...created, is_admin: user.is_admin, is_moderator: user.is_moderator };

// Broadcast an alle offenen Sockets — bewusst per waitUntil, damit der Absender
// nicht darauf wartet. Schlägt es fehl, holen die Clients die Nachricht beim
// nächsten Poll (Fallback bleibt aktiv).
try {
  const key = channelKey('global', null, lang);
  const stub = ctx.env.CHAT_HUB.get(ctx.env.CHAT_HUB.idFromName(key));
  ctx.waitUntil(stub.fetch(
    `https://hub/broadcast?channel=${encodeURIComponent(key)}`,
    {
      method:  'POST',
      headers: { 'X-Hub-Secret': ctx.env.HUB_SECRET },
      body:    JSON.stringify({ type: 'message', message: full }),
    },
  ));
} catch { /* Broadcast ist Beiwerk — niemals den Sendevorgang blockieren */ }

return Response.json(full, { status: 201 });
```

Nach diesem Schritt läuft die Seite **exakt wie vorher**, es wird nur zusätzlich
in einen leeren Raum gesendet.

---

## Phase 3 — Client verbinden, Polling als Netz behalten (Risiko: gering)

Der Kern der Sicherheitsstrategie:

```
WS-Verbindung steht?  ──ja──►  Polling pausiert, Nachrichten kommen live
        │
        └──nein / abgebrochen ──►  Polling läuft weiter wie heute
```

Neue Datei `src/hooks/useChatSocket.ts`:

```ts
import { useEffect, useRef, useState } from 'preact/hooks';

const MAX_RETRIES  = 5;
const PING_MS      = 30_000;
const HUB_URL      = 'wss://wild-hoggs-chat-hub.<subdomain>.workers.dev/connect';

// Liefert `connected`. Solange false, muss der Aufrufer weiter pollen.
export function useChatSocket(
  channel:   string | null,
  token:     string | null,
  onMessage: (msg: any) => void,
) {
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!channel || !token) return;

    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    let closed  = false;    // Unmount-Flag: verhindert Reconnects nach Cleanup

    const connect = async () => {
      if (closed) return;
      try {
        const res = await fetch('/api/chat/ws-ticket', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ channel }),
        });
        if (!res.ok) return scheduleRetry();
        const { ticket } = await res.json() as { ticket: string };
        if (closed) return;

        ws = new WebSocket(`${HUB_URL}?t=${encodeURIComponent(ticket)}`);

        ws.onopen = () => {
          if (closed) { ws?.close(); return; }
          retries = 0;
          setConnected(true);
          pingTimer = setInterval(() => {
            try { ws?.send('ping'); } catch { /* ignore */ }
          }, PING_MS);
        };

        ws.onmessage = (e) => {
          if (e.data === 'pong') return;
          try {
            const data = JSON.parse(e.data as string);
            if (data.type === 'message') onMessageRef.current(data.message);
          } catch { /* ignore */ }
        };

        ws.onclose = () => { setConnected(false); cleanupTimers(); scheduleRetry(); };
        ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
      } catch {
        scheduleRetry();
      }
    };

    // Exponentielles Backoff. Nach MAX_RETRIES wird aufgegeben —
    // `connected` bleibt false und das Polling übernimmt dauerhaft.
    const scheduleRetry = () => {
      if (closed || retries >= MAX_RETRIES) return;
      const delay = Math.min(1000 * 2 ** retries, 30_000);
      retries++;
      retryTimer = setTimeout(connect, delay);
    };

    const cleanupTimers = () => {
      if (pingTimer)  { clearInterval(pingTimer); pingTimer = null; }
    };

    connect();

    return () => {
      closed = true;
      cleanupTimers();
      if (retryTimer) clearTimeout(retryTimer);
      try { ws?.close(); } catch { /* ignore */ }
      setConnected(false);
    };
  }, [channel, token]);

  return connected;
}
```

### Einbau in `ChatWindow.tsx`

```ts
const wsConnected = useChatSocket(currentChannelKey, token, (msg) => {
  setMessages(prev => {
    if (prev.some(m => m.id === msg.id)) return prev;   // Dedup wie beim Poll
    return [...prev, msg].slice(-MAX_MESSAGES);         // Cap bleibt!
  });
  lastCreatedAt.current = msg.created_at;
});
```

Und im vorhandenen Poll-Intervall eine einzige Zeile ergänzen:

```ts
pollRef.current = setInterval(() => {
  if (wsConnectedRef.current) return;                   // Socket erledigt das
  if (document.visibilityState !== 'hidden') poll();
}, POLL_MS);
```

> `wsConnectedRef` als `useRef` mitführen und im Effect aktuell halten — sonst
> müsste das Intervall bei jedem Verbindungswechsel neu aufgesetzt werden.

**Wichtig:** Der Nachrichten-Cap (`MAX_MESSAGES = 200`) und die begrenzten
Label-Animationen müssen bleiben. Sie waren die Ursache des Einfrierens — mit
WebSockets kämen die Nachrichten sonst nur schneller herein und der Tab würde
*früher* hängen.

---

## Phase 4 — Messen und nachziehen

1. Eine Woche laufen lassen, im Cloudflare-Dashboard die Request-Zahlen vergleichen.
2. In der Browser-Konsole prüfen, ob die Verbindung stabil steht (keine
   Reconnect-Schleife).
3. Erst wenn das sitzt: `POLL_MS` von 5 s auf 30 s hochsetzen. Das Polling ist
   dann reines Sicherheitsnetz für Clients, bei denen der Socket scheitert.

---

## Phase 5 — später, optional

- **Presence über den DO.** Der Raum weiß, wer verbunden ist. Damit fallen
  `/api/presence` (20-s-Poll **plus D1-Write pro Nutzer**) und der 60-s-Heartbeat
  komplett weg.
- **PMs über WS.** Braucht einen DO pro Nutzer statt pro Kanal — eigener Entwurf.
- **`GlobalChatPoller`** auf anderen Seiten: erst mal lassen. Er läuft nur alle
  20 s und ist nicht der Hauptverbraucher.

---

## Risiken und wie sie abgefangen sind

| Risiko | Absicherung |
|---|---|
| Hub nicht erreichbar | `connected` bleibt false → Polling läuft weiter |
| Reconnect-Schleife frisst CPU | Exponentielles Backoff, Abbruch nach 5 Versuchen |
| Nachricht doppelt (WS + Poll) | Dedup über `msg.id` — dieselbe Prüfung wie heute |
| Broadcast schlägt fehl | `waitUntil` + try/catch, Absender merkt nichts; Poll holt nach |
| Secret gerät in falsche Hände | Nur als Cloudflare-Secret hinterlegen, nie im Repo |
| Ticket abgefangen | 60 s gültig, nur für einen Kanal, kein Session-Token |
| DO überlastet | Soft-Limit 1.000 req/s pro Objekt — pro Kanal weit entfernt |

## Aufwandsschätzung

| Phase | Aufwand |
|---|---|
| 1 — Hub-Worker | 2–3 h |
| 2 — Ticket + Broadcast | 2–3 h |
| 3 — Client + Fallback | 3–4 h |
| 4 — Messen, Feinschliff | 1–2 h |
| **Summe** | **~1,5 Arbeitstage** |

## Vorher klären

1. **Wie viele Spielserver-Kanäle** gibt es realistisch? (Beeinflusst nichts an den
   Kosten — DOs sind unbegrenzt und hibernieren — aber gut zu wissen.)
2. **Eigene Domain für den Hub?** `wss://wild-hoggs-chat-hub.<sub>.workers.dev` geht
   sofort; ein Custom-Domain-Route wäre hübscher, ist aber optional.
3. **Reihenfolge:** direkt WebSockets, oder vorher die vier Poll-Requests zu einem
   zusammenlegen? Letzteres ist ein Tag Arbeit, bringt sofort 75 % weniger Last und
   ist völlig risikofrei — verschafft Luft, um Phase 1–3 in Ruhe zu bauen.

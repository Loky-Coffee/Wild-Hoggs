import { useEffect, useRef, useState } from 'preact/hooks';

// Live-Verbindung zum Chat-Hub.
//
// Eine Verbindung pro Person deckt alles ab: Nachrichten des offenen Tabs,
// Ungelesen-Hinweise der anderen Tabs, private Nachrichten, gelöschte
// Nachrichten und die Online-Liste. Welcher Tab offen ist, wird über die
// bestehende Verbindung gemeldet — dafür wird NICHT neu verbunden.
//
// Rückgabewert `connected` steuert den Fallback: solange er false ist, muss der
// Aufrufer pollen. Damit kann hier nichts kaputtgehen — im schlimmsten Fall
// verhält sich der Chat wie vor der Umstellung.

const MAX_RETRIES = 5;
const PING_MS     = 30_000;
const MAX_BACKOFF = 30_000;
// Der Hub schickt direkt nach dem Verbinden die Online-Liste. Bleibt sie aus,
// ist am anderen Ende etwas, mit dem wir nicht reden können (z.B. während eines
// Deployments eine ältere Fassung) — dann lieber trennen und weiter pollen,
// statt still nichts mehr zu empfangen.
const HELLO_TIMEOUT_MS = 8_000;

export type ChatSocketEvent =
  | { type: 'message';  message: any }
  | { type: 'unread';   channel: string; ts?: string }
  | { type: 'pm';       from: string; message: any }
  | { type: 'delete';   id: string }
  | { type: 'presence'; users: any[] }
  | { type: 'announce'; announcement: any };

export function useChatSocket(
  chatType: string | null,
  server:   string | null,
  token:    string | null,
  onEvent:  (e: ChatSocketEvent) => void,
): boolean {
  const [connected, setConnected] = useState(false);

  // Über Refs, damit ein neuer Handler nicht die Verbindung neu aufbaut.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const wsRef = useRef<WebSocket | null>(null);
  const chatTypeRef = useRef(chatType);
  chatTypeRef.current = chatType;

  // ── Verbindung ────────────────────────────────────────────────────────────
  // Hängt bewusst NICHT am Tab: der wird über die offene Verbindung gemeldet.
  useEffect(() => {
    if (!token) return;

    let pingTimer:  ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout>  | null = null;
    let helloTimer: ReturnType<typeof setTimeout>  | null = null;
    let retries = 0;
    let closed  = false;   // Unmount-Flag — verhindert Reconnects nach dem Cleanup

    const clearPing = () => {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    };
    const clearHello = () => {
      if (helloTimer) { clearTimeout(helloTimer); helloTimer = null; }
    };

    // Exponentielles Backoff. Nach MAX_RETRIES wird aufgegeben: `connected`
    // bleibt false und das Polling übernimmt dauerhaft.
    const scheduleRetry = () => {
      if (closed || retries >= MAX_RETRIES) return;
      const delay = Math.min(1000 * 2 ** retries, MAX_BACKOFF);
      retries++;
      retryTimer = setTimeout(connect, delay);
    };

    async function connect() {
      if (closed) return;
      try {
        const res = await fetch('/api/chat/ws-ticket', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ type: chatTypeRef.current ?? 'global', server }),
        });

        // 503 = Hub nicht eingerichtet, 403 = kein Zugriff. Beides ist dauerhaft
        // — nicht erneut versuchen, Polling reicht.
        if (res.status === 503 || res.status === 403) return;
        if (!res.ok) return scheduleRetry();

        const data = await res.json() as { ticket: string; url: string };
        if (closed || !data.ticket || !data.url) return;

        const ws = new WebSocket(`${data.url}?t=${encodeURIComponent(data.ticket)}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (closed) { try { ws.close(); } catch { /* ignore */ } return; }
          pingTimer = setInterval(() => {
            try { ws.send('ping'); } catch { /* ignore */ }
          }, PING_MS);
          // Noch NICHT als verbunden melden: erst wenn das Gegenüber sich
          // erwartungsgemäß meldet. Bis dahin läuft das Polling weiter.
          helloTimer = setTimeout(() => {
            try { ws.close(); } catch { /* ignore */ }
          }, HELLO_TIMEOUT_MS);
        };

        ws.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data as string);
            if (!payload?.type || payload.type === 'pong') return;

            // Erstes verwertbares Ereignis = Handschlag geglückt.
            if (helloTimer) {
              clearHello();
              retries = 0;
              setConnected(true);
            }
            onEventRef.current(payload as ChatSocketEvent);
          } catch { /* kaputte Nachricht ignorieren */ }
        };

        ws.onclose = () => {
          if (wsRef.current === ws) wsRef.current = null;
          setConnected(false);
          clearPing();
          clearHello();
          scheduleRetry();
        };

        ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
      } catch {
        scheduleRetry();
      }
    }

    connect();

    return () => {
      closed = true;
      clearPing();
      clearHello();
      if (retryTimer) clearTimeout(retryTimer);
      try { wsRef.current?.close(); } catch { /* ignore */ }
      wsRef.current = null;
      setConnected(false);
    };
  }, [token, server]);

  // ── Tabwechsel melden ─────────────────────────────────────────────────────
  // Ab dann kommen Nachrichten dieses Kanals als 'message' statt als 'unread'.
  useEffect(() => {
    if (!connected || !chatType) return;
    try {
      wsRef.current?.send(JSON.stringify({ type: 'channel', c: chatType }));
    } catch { /* ignore */ }
  }, [chatType, connected]);

  return connected;
}

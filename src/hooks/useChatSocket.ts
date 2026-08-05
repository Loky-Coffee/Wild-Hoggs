import { useEffect, useRef, useState } from 'preact/hooks';

// WebSocket-Anbindung an den Chat-Hub.
//
// Rückgabewert `connected` steuert den Fallback: solange er false ist, muss der
// Aufrufer weiter pollen. Damit kann hier nichts kaputtgehen — im schlimmsten
// Fall verhält sich der Chat exakt wie vorher.
//
// Ist der Hub nicht konfiguriert (kein HUB_URL/HUB_SECRET in der Umgebung),
// antwortet /api/chat/ws-ticket mit 503 und wir versuchen es gar nicht erst
// weiter.

const MAX_RETRIES = 5;
const PING_MS     = 30_000;
const MAX_BACKOFF = 30_000;

export interface ChatSocketTarget {
  type:   string;         // ChatType — der Server bestimmt daraus den Kanal
  server: string | null;
}

export function useChatSocket(
  target:    ChatSocketTarget | null,
  token:     string | null,
  onMessage: (msg: any) => void,
): boolean {
  const [connected, setConnected] = useState(false);

  // Callback über eine Ref, damit ein neuer Handler nicht die Verbindung neu aufbaut.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const type   = target?.type   ?? null;
  const server = target?.server ?? null;

  useEffect(() => {
    if (!type || !token) return;

    let ws: WebSocket | null = null;
    let pingTimer:  ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout>  | null = null;
    let retries = 0;
    let closed  = false;   // Unmount-Flag — verhindert Reconnects nach dem Cleanup

    const clearPing = () => {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
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
          body:    JSON.stringify({ type, server }),
        });

        // 503 = Hub nicht eingerichtet, 403 = kein Zugriff auf den Kanal.
        // Beides ist dauerhaft — nicht erneut versuchen, Polling reicht.
        if (res.status === 503 || res.status === 403) return;
        if (!res.ok) return scheduleRetry();

        const data = await res.json() as { ticket: string; url: string };
        if (closed || !data.ticket || !data.url) return;

        ws = new WebSocket(`${data.url}?t=${encodeURIComponent(data.ticket)}`);

        ws.onopen = () => {
          if (closed) { try { ws?.close(); } catch { /* ignore */ } return; }
          retries = 0;
          setConnected(true);
          pingTimer = setInterval(() => {
            try { ws?.send('ping'); } catch { /* ignore */ }
          }, PING_MS);
        };

        ws.onmessage = (e) => {
          if (e.data === 'pong') return;
          try {
            const payload = JSON.parse(e.data as string);
            if (payload?.type === 'message' && payload.message) {
              onMessageRef.current(payload.message);
            }
          } catch { /* kaputte Nachricht ignorieren */ }
        };

        ws.onclose = () => {
          setConnected(false);
          clearPing();
          scheduleRetry();
        };

        ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
      } catch {
        scheduleRetry();
      }
    }

    connect();

    return () => {
      closed = true;
      clearPing();
      if (retryTimer) clearTimeout(retryTimer);
      try { ws?.close(); } catch { /* ignore */ }
      setConnected(false);
    };
  }, [type, server, token]);

  return connected;
}

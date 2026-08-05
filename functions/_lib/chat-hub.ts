// Anbindung an den Chat-Hub (Durable-Object-Worker, Verzeichnis chat-hub/).
//
// Der Hub ist reines Beiwerk: Er verteilt neue Nachrichten sofort an die
// verbundenen Clients. Fällt er aus, merkt niemand etwas — die Nachrichten
// stehen in D1 und die Clients holen sie über /api/chat/sync nach.
// Deshalb darf hier NIE ein Fehler nach oben durchschlagen.

const TICKET_TTL_MS = 60_000;

// Kanal-Schlüssel für das Durable-Object-Routing.
// Muss auf Client und Server identisch berechnet werden.
export function channelKey(
  scope: 'global' | 'server',
  serverName: string | null,
  lang: string | null,
): string {
  const base = scope === 'global' ? 'global' : `server-${serverName}`;
  const key  = lang ? `${base}-${lang}` : base;
  // Kleinbuchstaben + nur erlaubte Zeichen — der Hub weist alles andere ab.
  return key.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64);
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Kurzlebiges, signiertes Ticket für den WebSocket-Handshake.
// Bewusst NICHT das Session-Token: das lebt 30 Tage und hätte in einer URL
// nichts verloren.
export async function createTicket(secret: string, channel: string): Promise<string> {
  const body = btoa(JSON.stringify({ c: channel, exp: Date.now() + TICKET_TTL_MS }));
  return `${body}.${await hmacHex(secret, body)}`;
}

// Feuert den Broadcast ab. Immer über ctx.waitUntil aufrufen, damit der
// Absender nicht darauf wartet.
export function broadcast(ctx: any, channel: string, message: unknown): void {
  const { CHAT_HUB, HUB_SECRET } = ctx.env;
  if (!CHAT_HUB || !HUB_SECRET) return;   // Hub nicht konfiguriert — dann eben nicht

  try {
    const stub = CHAT_HUB.get(CHAT_HUB.idFromName(channel));
    ctx.waitUntil(
      stub.fetch(`https://chat-hub/broadcast?channel=${encodeURIComponent(channel)}`, {
        method:  'POST',
        headers: { 'X-Hub-Secret': HUB_SECRET, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'message', message }),
      }).catch(() => { /* Hub weg — Clients holen es per Poll nach */ }),
    );
  } catch { /* niemals den Sendevorgang stören */ }
}

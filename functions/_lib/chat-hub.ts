// Anbindung an den Chat-Hub (Durable-Object-Worker, Verzeichnis chat-hub/).
//
// Der Hub ist reines Beiwerk: Er verteilt Ereignisse sofort an die verbundenen
// Clients. Fällt er aus, merkt niemand etwas — die Daten stehen in D1 und die
// Clients holen sie über /api/chat/sync nach. Deshalb darf hier NIE ein Fehler
// nach oben durchschlagen.

const TICKET_TTL_MS = 60_000;

export type ChatType = 'global' | 'global-lang' | 'server' | 'server-lang';

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Kurzlebiges, signiertes Ticket für den WebSocket-Handshake.
 *
 * Es trägt die Identität mit (Name, Server, Sprache, Rollen) — der Hub muss
 * dafür nicht in die Datenbank, und der Client kann nichts davon selbst
 * behaupten, weil die Signatur sonst nicht passt.
 *
 * Bewusst NICHT das Session-Token: das lebt 30 Tage und hätte in einer URL
 * nichts verloren.
 */
export async function createTicket(
  secret: string,
  user: { username: string; server: string | null; language: string | null;
          faction: string | null; is_admin: number; is_moderator: number },
  channel: ChatType,
): Promise<string> {
  const body = btoa(JSON.stringify({
    u: user.username,
    s: user.server,
    l: user.language?.trim() ? user.language.trim() : null,
    c: channel,
    a: user.is_admin ? 1 : 0,
    m: user.is_moderator ? 1 : 0,
    f: user.faction,
    exp: Date.now() + TICKET_TTL_MS,
  }));
  return `${body}.${await hmacHex(secret, body)}`;
}

function post(ctx: any, path: string, payload: unknown): void {
  const { CHAT_HUB, HUB_SECRET } = ctx.env;
  if (!CHAT_HUB || !HUB_SECRET) return;   // Hub nicht eingerichtet — dann eben nicht

  try {
    const stub = CHAT_HUB.get(CHAT_HUB.idFromName('hub-v1'));
    ctx.waitUntil(
      stub.fetch(`https://chat-hub${path}`, {
        method:  'POST',
        headers: { 'X-Hub-Secret': HUB_SECRET, 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }).catch(() => { /* Hub weg — Clients holen es per Poll nach */ }),
    );
  } catch { /* niemals den eigentlichen Vorgang stören */ }
}

/** Neue Kanal-Nachricht. Der Hub entscheidet selbst, wer sie sieht. */
export function broadcastMessage(
  ctx: any, scope: 'global' | 'server', server: string | null, lang: string | null, message: unknown,
): void {
  post(ctx, '/broadcast/message', { scope, server, lang, message });
}

/** Private Nachricht — geht gezielt an eine Person. */
export function broadcastPM(ctx: any, to: string, from: string, message: unknown): void {
  post(ctx, '/broadcast/pm', { to, from, message });
}

/** Von einem Moderator gelöschte Nachricht aus allen offenen Fenstern entfernen. */
export function broadcastDelete(ctx: any, id: string): void {
  post(ctx, '/broadcast/delete', { id });
}

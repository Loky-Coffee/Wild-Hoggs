// Auth utilities — runs in Cloudflare Workers runtime (WebCrypto API)

const ITERATIONS = 100_000;
const KEY_BYTES  = 32; // 256 bit

export async function hashPassword(password: string): Promise<string> {
  const enc  = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key, KEY_BYTES * 8
  );

  const toHex = (u8: Uint8Array) =>
    Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map(b => parseInt(b, 16)));
  const enc  = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key, KEY_BYTES * 8
  );

  const computed = Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return computed === hashHex;
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function validateSession(db: any, token: string) {
  return db.prepare(`
    SELECT s.user_id, u.email, u.username, u.faction, u.server, u.language,
           u.formation_power_br, u.formation_power_wd, u.formation_power_go,
           u.is_admin, COALESCE(u.is_moderator, 0) AS is_moderator
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).bind(token).first() as Promise<{
    user_id: string;
    email: string;
    username: string;
    faction: string | null;
    server: string | null;
    language: string;
    formation_power_br: number | null;
    formation_power_wd: number | null;
    formation_power_go: number | null;
    is_admin: number;
    is_moderator: number;
  } | null>;
}

export function expiresAt(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

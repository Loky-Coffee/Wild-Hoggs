// Rate limit rules:
//   - Max 1 message per 10 seconds (cooldown)
//   - Max 10 messages per 5 minutes (sliding window)

const COOLDOWN_MS    = 10_000;      // 10 seconds between messages
const WINDOW_MS      = 5 * 60_000; // 5-minute rolling window
const MAX_PER_WINDOW = 10;

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

export async function checkRateLimit(db: any, userId: string): Promise<RateLimitResult> {
  const now = Date.now();

  const row = await db.prepare(
    'SELECT last_msg, window_start, msg_count FROM chat_rate_limits WHERE user_id = ?'
  ).bind(userId).first() as { last_msg: string; window_start: string; msg_count: number } | null;

  if (!row) {
    // First message ever — create row and allow
    await db.prepare(
      `INSERT INTO chat_rate_limits (user_id, last_msg, window_start, msg_count)
       VALUES (?, datetime('now'), datetime('now'), 1)`
    ).bind(userId).run();
    return { allowed: true };
  }

  // SQLite datetime() returns UTC without 'Z' — append it for correct parsing
  const lastMsgMs     = new Date(row.last_msg.includes('T') ? row.last_msg : row.last_msg.replace(' ', 'T') + 'Z').getTime();
  const windowStartMs = new Date(row.window_start.includes('T') ? row.window_start : row.window_start.replace(' ', 'T') + 'Z').getTime();

  // 1. Cooldown check: must wait 10 seconds between messages
  if (now - lastMsgMs < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (now - lastMsgMs)) / 1000);
    return { allowed: false, reason: `Bitte warte noch ${waitSec} Sekunde(n).` };
  }

  // 2. Window check: max 10 messages per 5 minutes
  const windowExpired = now - windowStartMs > WINDOW_MS;
  const newCount      = windowExpired ? 1 : row.msg_count + 1;
  const newWindowStart = windowExpired
    ? new Date().toISOString().replace('T', ' ').slice(0, 19)
    : row.window_start;

  if (!windowExpired && row.msg_count >= MAX_PER_WINDOW) {
    const waitMin = Math.ceil((WINDOW_MS - (now - windowStartMs)) / 60_000);
    return { allowed: false, reason: `Limit erreicht. Bitte warte noch ~${waitMin} Minute(n).` };
  }

  // Update rate limit record
  await db.prepare(
    `UPDATE chat_rate_limits
     SET last_msg = datetime('now'), window_start = ?, msg_count = ?
     WHERE user_id = ?`
  ).bind(newWindowStart, newCount, userId).run();

  return { allowed: true };
}

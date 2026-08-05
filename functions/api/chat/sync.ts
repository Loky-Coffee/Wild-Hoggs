// POST /api/chat/sync — ein Request statt vier.
//
// Ersetzt auf der Community-Seite die bisher getrennten Poller:
//   • Nachrichten des aktiven Kanals   (war: GET /api/chat/global bzw. /server/:name)
//   • Ungelesen-Zähler der anderen Tabs (war: bis zu 3x derselbe GET)
//   • PM-Inbox                          (war: GET /api/chat/pm-inbox)
//   • Online-Liste + Heartbeat          (war: GET /api/presence)
//
// Die alten Endpoints bleiben bestehen — sie werden weiterhin für den
// Initial-Load, das PM-Panel und den GlobalChatPoller gebraucht.

import { getToken, validateSession } from '../../_lib/auth';

type ChatType = 'global' | 'global-lang' | 'server' | 'server-lang';

const ALL_TYPES: ChatType[] = ['global', 'global-lang', 'server', 'server-lang'];
const MAX_LIMIT = 100;

const isServerType = (t: ChatType) => t === 'server' || t === 'server-lang';
const isLangType   = (t: ChatType) => t === 'global-lang' || t === 'server-lang';

// Volle Nachrichten — nur für den aktiven Kanal.
function messagesStmt(DB: any, type: ChatType, server: string | null, lang: string | null, since: string, limit: number) {
  if (isServerType(type)) {
    const langFilter = lang ? 'cs.lang = ?' : 'cs.lang IS NULL';
    return DB.prepare(
      `SELECT cs.id, cs.username, cs.faction, cs.server, cs.message, cs.created_at,
              COALESCE(u.is_admin, 0) AS is_admin, COALESCE(u.is_moderator, 0) AS is_moderator,
              cs.reply_to_id, rs.username AS reply_to_username, SUBSTR(rs.message, 1, 120) AS reply_to_text
       FROM chat_server cs
       LEFT JOIN users u ON cs.user_id = u.id
       LEFT JOIN chat_server rs ON cs.reply_to_id = rs.id
       WHERE cs.server = ? AND ${langFilter} AND cs.created_at > ?
       ORDER BY cs.created_at ASC
       LIMIT ?`
    ).bind(...(lang ? [server, lang, since, limit] : [server, since, limit]));
  }

  const langFilter = lang ? 'cg.lang = ?' : 'cg.lang IS NULL';
  return DB.prepare(
    `SELECT cg.id, cg.username, cg.faction, cg.server, cg.message, cg.created_at,
            COALESCE(u.is_admin, 0) AS is_admin, COALESCE(u.is_moderator, 0) AS is_moderator,
            cg.reply_to_id, rg.username AS reply_to_username, SUBSTR(rg.message, 1, 120) AS reply_to_text
     FROM chat_global cg
     LEFT JOIN users u ON cg.user_id = u.id
     LEFT JOIN chat_global rg ON cg.reply_to_id = rg.id
     WHERE ${langFilter} AND cg.created_at > ?
     ORDER BY cg.created_at ASC
     LIMIT ?`
  ).bind(...(lang ? [lang, since, limit] : [since, limit]));
}

// Für inaktive Tabs reicht die Anzahl. Vorher wurden dafür bis zu 50 komplette
// Nachrichten übertragen, nur um sie zu zählen.
function countStmt(DB: any, type: ChatType, server: string | null, lang: string | null, since: string) {
  if (isServerType(type)) {
    const langFilter = lang ? 'lang = ?' : 'lang IS NULL';
    return DB.prepare(
      `SELECT COUNT(*) AS cnt, MAX(created_at) AS last_ts
       FROM chat_server
       WHERE server = ? AND ${langFilter} AND created_at > ?`
    ).bind(...(lang ? [server, lang, since] : [server, since]));
  }

  const langFilter = lang ? 'lang = ?' : 'lang IS NULL';
  return DB.prepare(
    `SELECT COUNT(*) AS cnt, MAX(created_at) AS last_ts
     FROM chat_global
     WHERE ${langFilter} AND created_at > ?`
  ).bind(...(lang ? [lang, since] : [since]));
}

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  let body: any;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const activeType: ChatType = ALL_TYPES.includes(body?.active?.type) ? body.active.type : 'global';
  const activeSince: string | null = typeof body?.active?.since === 'string' ? body.active.since : null;
  const server: string | null      = typeof body?.server === 'string' && body.server ? body.server : null;
  const userLang: string | null    = user.language?.trim() ? user.language.trim() : null;
  const tabs: Record<string, string> = (body?.tabs && typeof body.tabs === 'object') ? body.tabs : {};
  const pmSince: string | null     = typeof body?.pm_since === 'string' ? body.pm_since : null;
  // Presence läuft in größerem Takt als der Nachrichten-Poll — der Client
  // setzt das Flag nur bei jedem n-ten Aufruf, damit der last_seen-Write
  // nicht alle 5 Sekunden anfällt.
  const wantPresence = body?.presence === true;
  const limit = Math.min(parseInt(String(body?.limit ?? 50)), MAX_LIMIT);

  // Zugriff auf den Server-Chat prüfen (gleiche Regel wie in /api/chat/server/:name)
  let serverAllowed = false;
  if (server) {
    const match = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM game_profiles WHERE user_id = ? AND server = ?`
    ).bind(user.user_id, server).first() as { cnt: number } | null;
    serverAllowed = (match?.cnt ?? 0) > 0 || user.server === server;
  }

  const canUse = (t: ChatType) => {
    if (isLangType(t) && !userLang) return false;
    if (isServerType(t) && (!server || !serverAllowed)) return false;
    return true;
  };

  const langFor = (t: ChatType) => (isLangType(t) ? userLang : null);

  // ── Alle Abfragen in einem einzigen D1-Batch ────────────────────────────────
  const stmts: any[] = [];
  const slots: { kind: 'messages' | 'count' | 'pm' | 'online' | 'now' | 'skip'; type?: ChatType }[] = [];

  stmts.push(DB.prepare(`SELECT datetime('now') AS ts`));
  slots.push({ kind: 'now' });

  if (activeSince && canUse(activeType)) {
    stmts.push(messagesStmt(DB, activeType, server, langFor(activeType), activeSince, limit));
    slots.push({ kind: 'messages' });
  }

  for (const t of ALL_TYPES) {
    if (t === activeType || !canUse(t)) continue;
    const since = tabs[t];
    if (typeof since !== 'string' || !since) continue;
    stmts.push(countStmt(DB, t, server, langFor(t), since));
    slots.push({ kind: 'count', type: t });
  }

  if (pmSince) {
    stmts.push(DB.prepare(
      `SELECT u.username AS sender_username, COUNT(*) AS count, MAX(p.created_at) AS last_created_at
       FROM chat_pm p
       JOIN users u ON p.sender_id = u.id
       WHERE p.receiver_id = ? AND p.created_at > ?
       GROUP BY p.sender_id
       ORDER BY last_created_at DESC`
    ).bind(user.user_id, pmSince));
    slots.push({ kind: 'pm' });
  }

  if (wantPresence) {
    stmts.push(DB.prepare(
      `UPDATE users SET last_seen = datetime('now') WHERE id = ?`
    ).bind(user.user_id));
    slots.push({ kind: 'skip' }); // UPDATE liefert keine Zeilen

    stmts.push(DB.prepare(
      `SELECT username, faction, server, language,
              COALESCE(is_admin, 0)     AS is_admin,
              COALESCE(is_moderator, 0) AS is_moderator
       FROM users
       WHERE last_seen > datetime('now', '-5 minutes')
       ORDER BY username ASC`
    ));
    slots.push({ kind: 'online' });
  }

  const batch = await DB.batch(stmts);

  // ── Ergebnisse den Slots zuordnen ───────────────────────────────────────────
  let serverTime = '';
  let messages: any[] = [];
  const unread: Record<string, { count: number; last_ts: string | null }> = {};
  let pmSenders: any[] = [];
  let online: any[] | null = null;

  batch.forEach((res: any, i: number) => {
    const slot = slots[i];
    switch (slot.kind) {
      case 'skip':
        break;
      case 'now':
        serverTime = res.results?.[0]?.ts ?? serverTime;
        break;
      case 'messages':
        messages = res.results ?? [];
        break;
      case 'count': {
        const row = res.results?.[0] ?? { cnt: 0, last_ts: null };
        if ((row.cnt ?? 0) > 0) {
          unread[slot.type as string] = { count: row.cnt, last_ts: row.last_ts };
        }
        break;
      }
      case 'pm':
        pmSenders = res.results ?? [];
        break;
      case 'online':
        online = res.results ?? [];
        break;
    }
  });

  return Response.json(
    {
      messages,
      unread,
      pm: { senders: pmSenders },
      online,               // null, wenn in diesem Durchlauf nicht angefragt
      server_time: serverTime,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

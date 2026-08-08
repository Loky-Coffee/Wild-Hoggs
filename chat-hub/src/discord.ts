// Liest den Discord-Kanal mit, in dem die offiziellen Gift-Code-Ankündigungen
// landen, und legt gefundene Codes zur Prüfung in die Datenbank.
//
// Kein Gateway, keine dauerhafte Verbindung: Ein Cron ruft alle zehn Minuten
// die REST-API auf und fragt nach allem, was seit dem letzten Lauf dazukam.
// Das passt zu einem Worker, der zwischendurch schläft.
//
// Veröffentlicht wird nichts von allein — jeder Fund landet als 'pending' und
// wartet auf eine Bestätigung im Admin-Panel. Deshalb darf die Erkennung eher
// zu viel finden als zu wenig: ein Fehltreffer kostet einen Klick, ein
// übersehener Code kostet allen Spielern eine Belohnung.

const API = 'https://discord.com/api/v10';

// Wo der Zeiger steht, bis zu dem schon gelesen wurde.
const CURSOR_KEY = 'discord_last_message_id';

export interface DiscordEnv {
  DB: D1Database;
  DISCORD_TOKEN?: string;
  DISCORD_CHANNEL_ID?: string;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  fields?: { name?: string; value?: string }[];
  footer?: { text?: string };
  author?: { name?: string };
}

interface DiscordMessage {
  id: string;
  content?: string;
  embeds?: DiscordEmbed[];
}

// ── Code-Erkennung ──────────────────────────────────────────────────────────

// Wörter, die dem Code-Muster entsprechen, aber keine Codes sind. In
// Ankündigungen kommen sie ständig vor.
const KEINE_CODES = new Set([
  'SURVIVAL', 'SHOOTER', 'UPDATE', 'UPDATES', 'EVENT', 'EVENTS', 'REWARD',
  'REWARDS', 'PLAYER', 'PLAYERS', 'SERVER', 'SERVERS', 'ALLIANCE', 'SEASON',
  'WARNING', 'NOTICE', 'ATTENTION', 'IMPORTANT', 'MAINTENANCE', 'COMPENSATION',
  'ANNOUNCEMENT', 'COMMUNITY', 'DISCORD', 'FACEBOOK', 'YOUTUBE', 'TWITTER',
  'GIFTCODE', 'GIFTCODES', 'REDEEM', 'EXPIRED', 'EXPIRES', 'ACTIVE', 'CENTER',
  'CENTRE', 'OFFICIAL', 'WELCOME', 'THANKS', 'THANKYOU', 'CONGRATULATIONS',
  'DIAMONDS', 'RESOURCES', 'SPEEDUP', 'SPEEDUPS', 'COMMANDER', 'COMMANDERS',
  'ANDROID', 'IPHONE', 'MOBILE', 'GOOGLE', 'APPLE', 'STORE', 'HTTPS', 'HTTP',
  'CLICK', 'HERE', 'ENJOY', 'NEW', 'FREE', 'LIMITED', 'GLOBAL', 'ONLY',
]);

// Ein Code besteht aus Großbuchstaben und Ziffern, mindestens sechs Zeichen.
// Der Wortanfang muss ein Buchstabe sein — reine Zahlenkolonnen sind Daten,
// keine Codes.
const CODE_MUSTER = /\b[A-Z][A-Z0-9]{5,19}\b/g;

// Was zwischen Backticks oder in einem Codeblock steht, ist in solchen Posts
// fast immer der Code selbst.
const HERVORGEHOBEN = /`{1,3}([^`\n]{4,40})`{1,3}/g;

// Links fliegen vor der Suche raus. In Ankündigungen stehen fast immer welche,
// und ein Pfadsegment wie /GIFTCENTER sieht sonst aus wie ein Code. Die
// Stoppwortliste dafür zu erweitern wäre ein Wettlauf ohne Ziel.
const LINK = /https?:\/\/\S+|www\.\S+/gi;

function kandidatOk(wort: string): boolean {
  if (KEINE_CODES.has(wort)) return false;
  // Ein Wort ohne einzige Ziffer und ohne Länge ist meist normale Sprache.
  // Ab neun Zeichen lassen wir es trotzdem durch — Codes wie GOLDBARMALL
  // bestehen nur aus Buchstaben.
  if (!/\d/.test(wort) && wort.length < 9) return false;
  return true;
}

/**
 * Sammelt alle Code-Kandidaten aus einer Nachricht.
 *
 * Ankündigungen, denen man per "Folgen" abonniert ist, kommen meist als Embed
 * an — Titel, Beschreibung und Felder müssen deshalb genauso durchsucht werden
 * wie der eigentliche Nachrichtentext.
 */
export function findeCodes(msg: DiscordMessage): string[] {
  const teile: string[] = [];
  if (msg.content) teile.push(msg.content);

  for (const e of msg.embeds ?? []) {
    if (e.title) teile.push(e.title);
    if (e.description) teile.push(e.description);
    if (e.author?.name) teile.push(e.author.name);
    if (e.footer?.text) teile.push(e.footer.text);
    for (const f of e.fields ?? []) {
      if (f.name) teile.push(f.name);
      if (f.value) teile.push(f.value);
    }
  }

  const text = teile.join('\n').replace(LINK, ' ');
  if (!text.trim()) return [];

  const gefunden = new Set<string>();

  // Zuerst das, was ausdrücklich hervorgehoben wurde — dort ist die Trefferquote
  // am höchsten, und Stoppwörter spielen keine Rolle: wer WELCOME in Backticks
  // setzt, meint den Code.
  for (const m of text.matchAll(HERVORGEHOBEN)) {
    const inhalt = m[1].trim().toUpperCase();
    if (/^[A-Z][A-Z0-9]{5,19}$/.test(inhalt)) gefunden.add(inhalt);
  }

  // Danach der Fließtext, hier mit Stoppwortfilter.
  for (const m of text.toUpperCase().matchAll(CODE_MUSTER)) {
    const wort = m[0];
    if (kandidatOk(wort)) gefunden.add(wort);
  }

  return [...gefunden];
}

// ── Abruf ───────────────────────────────────────────────────────────────────

async function holeZeiger(db: D1Database): Promise<string | null> {
  const row = await db.prepare(`SELECT value FROM app_settings WHERE key = ?`)
    .bind(CURSOR_KEY).first<{ value: string }>();
  return row?.value ?? null;
}

async function setzeZeiger(db: D1Database, id: string): Promise<void> {
  await db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(CURSOR_KEY, id).run();
}

// Discord-IDs sind Snowflakes: numerisch aufsteigend, aber zu groß für Number.
function groesser(a: string, b: string): boolean {
  return a.length !== b.length ? a.length > b.length : a > b;
}

export interface LaufErgebnis {
  gelesen:   number;
  neu:       string[];
  bekannt:   number;
  fehler?:   string;
}

/**
 * Ein Durchlauf: neue Nachrichten holen, Codes herauslesen, unbekannte zur
 * Prüfung ablegen.
 *
 * Wirft nicht — ein Ausfall bei Discord darf den Cron nicht in einen
 * Fehlerzustand bringen, beim nächsten Lauf in zehn Minuten geht es weiter.
 */
export async function sammleCodes(env: DiscordEnv): Promise<LaufErgebnis> {
  const leer: LaufErgebnis = { gelesen: 0, neu: [], bekannt: 0 };

  if (!env.DISCORD_TOKEN || !env.DISCORD_CHANNEL_ID) {
    return { ...leer, fehler: 'DISCORD_TOKEN oder DISCORD_CHANNEL_ID fehlt' };
  }

  const zeiger = await holeZeiger(env.DB);

  // Ohne Zeiger ist es der erste Lauf: ein kleiner Rückblick, damit sofort
  // etwas zu sehen ist, aber nicht die ganze Kanalgeschichte.
  const query = zeiger ? `after=${zeiger}&limit=100` : 'limit=25';

  let nachrichten: DiscordMessage[];
  try {
    const res = await fetch(`${API}/channels/${env.DISCORD_CHANNEL_ID}/messages?${query}`, {
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
        'User-Agent': 'WildHoggsBot (https://wild-hoggs.com, 1.0)',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ...leer, fehler: `Discord antwortete ${res.status}: ${text.slice(0, 200)}` };
    }
    nachrichten = await res.json();
  } catch (e: any) {
    return { ...leer, fehler: `Discord nicht erreichbar: ${e?.message ?? e}` };
  }

  if (!Array.isArray(nachrichten) || nachrichten.length === 0) return leer;

  // Zeiger auf die höchste gesehene ID — unabhängig davon, ob Codes drin waren.
  let hoechste = zeiger ?? '';
  const neu: string[] = [];
  let bekannt = 0;

  for (const msg of nachrichten) {
    if (!hoechste || groesser(msg.id, hoechste)) hoechste = msg.id;

    for (const code of findeCodes(msg)) {
      // Der eindeutige Index auf code fängt Wiederholungen ab. DO NOTHING
      // statt Fehler: derselbe Code taucht in Ankündigungen mehrfach auf.
      const res = await env.DB.prepare(
        `INSERT INTO reward_codes (code, status, source, source_ref)
         VALUES (?, 'pending', 'discord', ?)
         ON CONFLICT(code) DO NOTHING`
      ).bind(code, msg.id).run();

      if (res.meta?.changes) neu.push(code); else bekannt++;
    }
  }

  if (hoechste && hoechste !== zeiger) await setzeZeiger(env.DB, hoechste);

  return { gelesen: nachrichten.length, neu, bekannt };
}

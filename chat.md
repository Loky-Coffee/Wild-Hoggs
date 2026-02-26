# chat.md — Community Chat System
## Wild Hoggs — Cloudflare Pages

**Datum:** 2026-02-27
**Analyst:** Claude Code (Sonnet 4.6)
**Stack:** Cloudflare D1 + Pages Functions + Preact Islands
**Status:** Planungsphase — noch nicht implementiert

---

## 1. ZIEL

Ein Community-Chat-System für Wild Hoggs mit zwei Chat-Bereichen:

1. **Global Chat** — Alle eingeloggten User sehen und schreiben alle Nachrichten weltweit
2. **Server Chat** — User sehen nur Nachrichten von Usern mit demselben `server`-Feld (z.B. "S42")

Die Community-Seite ist **nur für eingeloggte User** sichtbar. Nicht eingeloggte User sehen einen Login-Hinweis.

---

## 2. TECHNISCHE ENTSCHEIDUNG: POLLING + D1

### Warum Polling und nicht WebSockets?

WebSockets auf Cloudflare erfordern **Durable Objects** — ein separates Produkt das extra konfiguriert werden muss und auf dem Free Tier stark limitiert ist.

**Polling** nutzt die bereits vorhandene Infrastruktur:
- Cloudflare D1 (Datenbank) ✅ bereits aktiv
- Cloudflare Pages Functions ✅ bereits aktiv
- Bestehende Auth (Bearer Token) ✅ bereits aktiv

### Wie Polling funktioniert

Der Browser fragt alle **5 Sekunden** den Server nach neuen Nachrichten:

```
Browser → GET /api/chat/global?since={lastMessageId}
Server  → { messages: [...neu], hasMore: false }
Browser → zeigt neue Nachrichten an
Browser → wartet 5 Sekunden
Browser → wiederholt...
```

Nur **neue** Nachrichten werden übertragen (via `since` Parameter) — nicht die komplette History bei jedem Poll.

### Latenz

- Maximale Verzögerung: 5 Sekunden (akzeptabel für Community-Chat)
- Später aufrüstbar auf WebSockets via Durable Objects ohne Frontend-Umbau

---

## 3. DATENBANKSCHEMA — NEUE TABELLEN

Migration-Datei: `functions/migrations/002_add_chat_tables.sql`

### 3.1 Globaler Chat

```sql
CREATE TABLE IF NOT EXISTS chat_global (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT NOT NULL,
  faction    TEXT,
  server     TEXT,
  message    TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_global_created ON chat_global(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_global_user    ON chat_global(user_id);
```

**Felder erklärt:**
- `user_id` → nullable (wenn User gelöscht wird, bleibt Nachricht erhalten)
- `username` / `faction` / `server` → denormalisiert gespeichert (Snapshot zum Zeitpunkt der Nachricht)
- Index auf `created_at DESC` → Polling-Query ist schnell

### 3.2 Server-spezifischer Chat

```sql
CREATE TABLE IF NOT EXISTS chat_server (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  server     TEXT NOT NULL,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT NOT NULL,
  faction    TEXT,
  message    TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_server_server  ON chat_server(server, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_server_user    ON chat_server(user_id);
```

**Wichtig:** `server` ist der zusammengesetzte Index — Queries filtern immer nach Server zuerst.

### 3.3 Meldungen (Moderation)

```sql
CREATE TABLE IF NOT EXISTS chat_reports (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  chat_type  TEXT NOT NULL,     -- 'global' oder 'server'
  message_id TEXT NOT NULL,
  reported_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     TEXT,
  status     TEXT DEFAULT 'open',   -- 'open', 'reviewed', 'resolved'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_reports_status ON chat_reports(status);
```

### 3.4 Rate Limit Tracking

```sql
CREATE TABLE IF NOT EXISTS chat_rate_limits (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_msg   TEXT DEFAULT (datetime('now')),
  msg_count  INTEGER DEFAULT 0
);
```

Verhindert Spam: Max. 1 Nachricht pro 10 Sekunden, max. 10 pro 5 Minuten.

---

## 4. API ENDPOINTS

Alle Endpoints folgen dem bestehenden Pattern: `functions/api/chat/...`
Auth immer via `Authorization: Bearer {token}` Header.

### 4.1 Globaler Chat

#### `GET /api/chat/global`
Nachrichten abrufen (mit Polling).

```
Query Parameter:
  limit   = 50      (max: 100, default: 50)
  since   = {id}    (nur Nachrichten NACH dieser ID — für Polling)
  offset  = 0       (für initiales Laden der History)

Response (200):
{
  messages: [
    {
      id: "abc123",
      username: "WildPlayer",
      faction: "blood-rose",
      server: "S42",
      message: "Hello World!",
      created_at: "2026-02-27T10:00:00"
    }
  ],
  hasMore: false
}

Auth: NICHT erforderlich (öffentlich lesbar)
Fehler:
  400 — Ungültige Parameter
```

#### `POST /api/chat/global`
Nachricht senden.

```
Body: { message: "Text" }

Auth: Bearer Token ERFORDERLICH

Validierung:
  - message: 1–500 Zeichen
  - Rate Limit: max 1 Nachricht / 10 Sekunden
  - Rate Limit: max 10 Nachrichten / 5 Minuten

Response (201):
{
  id: "abc123",
  username: "WildPlayer",
  faction: "blood-rose",
  server: "S42",
  message: "Text",
  created_at: "2026-02-27T10:00:00"
}

Fehler:
  401 — Nicht eingeloggt
  429 — Rate Limit überschritten
  400 — Nachricht zu kurz/lang
```

### 4.2 Server Chat

#### `GET /api/chat/server/[serverName]`
Nachrichten eines Servers abrufen.

```
URL Param: serverName (z.B. "S42")
Query: same wie Global Chat

Auth: Bearer Token ERFORDERLICH
Bedingung: user.server muss mit serverName übereinstimmen

Response: same wie Global Chat

Fehler:
  401 — Nicht eingeloggt
  403 — User gehört nicht zu diesem Server
  404 — Server existiert nicht (kein User mit diesem Server)
```

#### `POST /api/chat/server/[serverName]`
Nachricht im Server-Chat senden.

```
URL Param: serverName
Body: { message: "Text" }

Auth: Bearer Token ERFORDERLICH
Bedingung: user.server muss mit serverName übereinstimmen

Response + Fehler: same wie Global POST
```

### 4.3 Meldungen

#### `POST /api/chat/report`
Nachricht melden.

```
Body: {
  chat_type: "global" | "server",
  message_id: "abc123",
  reason: "Spam / Beleidigung / ..."
}

Auth: Bearer Token ERFORDERLICH

Response (201): { success: true, report_id: "xyz" }
Fehler: 400, 401, 404 (Message nicht gefunden)
```

---

## 5. FRONTEND KOMPONENTEN

### Dateistruktur (neu):

```
src/components/chat/
├── ChatWindow.tsx        ← Haupt-Komponente (Preact Island)
├── ChatWindow.css        ← Styling
├── MessageList.tsx       ← Scrollbare Nachrichtenliste
├── MessageItem.tsx       ← Einzelne Nachricht + Melde-Button
├── MessageInput.tsx      ← Eingabefeld + Senden
└── ServerBadge.tsx       ← Kleines Badge für Server/Faction
```

### 5.1 ChatWindow.tsx — Kern-Logik

**State:**
```typescript
type ChatType = 'global' | 'server';

interface Message {
  id: string;
  username: string;
  faction: string | null;
  server: string | null;
  message: string;
  created_at: string;
}
```

**Polling-Logik:**
```
1. Beim Laden: letzte 50 Nachrichten laden (offset=0)
2. setInterval(3000): GET ?since={lastMessageId}
3. Neue Nachrichten ans Ende der Liste anhängen
4. Auto-Scroll nach unten (nur wenn User bereits unten war)
5. Bei Tab-Wechsel: Polling pausieren (visibilitychange event)
```

**Chat-Typ-Umschaltung:**
```
Global  → immer verfügbar (alle eingeloggten User)
Server  → nur wenn user.server gesetzt ist
         → wenn nicht gesetzt: Hinweis "Kein Server-Feld in deinem Profil"
```

### 5.2 MessageItem.tsx

Jede Nachricht zeigt:
- **Faction-Farbe** (links als farbiger Streifen oder Icon)
  - `blood-rose` → Rot
  - `wings-of-dawn` → Blau
  - `guard-of-order` → Grün
  - kein Faction → Grau
- **Username** (fett)
- **Server-Badge** (klein, rechts neben Username, z.B. "S42")
- **Nachrichtentext**
- **Zeitstempel** (relativ: "vor 2 Min.")
- **Melde-Button** (⚑ Symbol, nur für andere User, nicht eigene Nachrichten)

### 5.3 MessageInput.tsx

- Textarea (mehrzeilig, Enter = Senden, Shift+Enter = Zeilenumbruch)
- Zeichenzähler (z.B. "142 / 500")
- Senden-Button (disabled bei leerem Input oder Loading)
- Fehlermeldung bei Rate Limit ("Bitte warte 10 Sekunden")
- Fehlermeldung wenn nicht eingeloggt ("Bitte einloggen um zu schreiben")

### 5.4 Chat-Tab-Switcher

```
[🌍 Global]  [🏠 Server S42]

→ Aktiver Tab: unterstrichen / highlighted (Orange)
→ Server-Tab grayed out wenn user.server null
```

---

## 6. NEUE SEITE: community.astro

**Pfad:** `src/pages/[...lang]/community.astro`

```
URL (Englisch):    /community/
URL (Deutsch):     /de/community/
URL (alle 15):     /{lang}/community/
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ Navigation (bestehendes Layout)         │
├─────────────────────────────────────────┤
│ H1: Community Chat                      │
│ Subtitle: Wild Hoggs Community          │
├─────────────────────────────────────────┤
│ [🌍 Global] [🏠 Server S42]            │  ← Tab-Switcher
├─────────────────────────────────────────┤
│                                         │
│ MessageList (scrollbar)                 │
│  WildPlayer  [S42] [blood-rose]         │
│  "Wer hat schon Level 240?"  vor 1 Min  │
│  ─────────────────────────────────────  │
│  HogMaster  [S12] [guard-of-order]      │
│  "Ich bald :D"               vor 3 Min  │
│                                         │
├─────────────────────────────────────────┤
│ [Schreibe eine Nachricht...] [Senden]   │  ← Input
└─────────────────────────────────────────┘
```

**Wenn NICHT eingeloggt:**
```
┌─────────────────────────────────────────┐
│ 🔒 Melde dich an um am Chat            │
│    teilzunehmen.                        │
│    [Einloggen / Registrieren]           │
└─────────────────────────────────────────┘
```

---

## 7. NAVIGATION INTEGRATION

In `src/components/Navigation.astro` wird ein neuer Route hinzugefügt:

```typescript
const routes = [
  { key: 'nav.home',      path: getPath('home') },
  { key: 'nav.members',   path: getPath('members') },
  { key: 'nav.tools',     path: getPath('tools') },
  { key: 'nav.events',    path: getPath('events') },
  { key: 'nav.codes',     path: getPath('codes') },
  { key: 'nav.roses',     path: getPath('roses') },
  { key: 'nav.heroes',    path: getPath('heroes') },
  { key: 'nav.guides',    path: getPath('guides') },
  { key: 'nav.community', path: getPath('community') },   // ← NEU
  { key: 'nav.about',     path: getPath('about') },
];
```

---

## 8. i18n KEYS (alle 15 Sprachen)

Folgende Schlüssel werden in allen 15 Locale-Dateien hinzugefügt:

```typescript
// Navigation
'nav.community': 'Community',

// SEO
'seo.community.title': 'Community Chat — Wild Hoggs',
'seo.community.description': 'Chatte mit der Wild Hoggs Community...',

// Chat UI
'chat.global':              'Global',
'chat.server':              'Server',
'chat.no_server':           'Kein Server-Profil',
'chat.no_server_hint':      'Trage deine Server-Nummer im Profil ein um den Server-Chat zu nutzen.',
'chat.login_required':      'Melde dich an um am Chat teilzunehmen.',
'chat.login_button':        'Einloggen / Registrieren',
'chat.input_placeholder':   'Schreibe eine Nachricht...',
'chat.send':                'Senden',
'chat.chars_left':          'Zeichen übrig',
'chat.rate_limit':          'Bitte warte kurz...',
'chat.report':              'Melden',
'chat.report_sent':         'Gemeldet',
'chat.report_reason':       'Grund (optional)',
'chat.loading':             'Lade Nachrichten...',
'chat.no_messages':         'Noch keine Nachrichten. Sei der Erste!',
'chat.error_send':          'Nachricht konnte nicht gesendet werden.',
'chat.error_load':          'Nachrichten konnten nicht geladen werden.',
'chat.ago_seconds':         'gerade eben',
'chat.ago_minutes':         'vor {n} Min.',
'chat.ago_hours':           'vor {n} Std.',
'chat.ago_days':            'vor {n} Tagen',
```

---

## 9. SICHERHEIT

### Authentifizierung
- Schreiben: immer Bearer Token nötig
- Lesen (Global): optional öffentlich (entscheidung offen)
- Lesen (Server): Bearer Token + Server-Übereinstimmung

### Rate Limiting
- **Nachrichtenabstand:** min. 10 Sekunden zwischen Nachrichten
- **Nachrichtenvolumen:** max. 10 Nachrichten / 5 Minuten
- **Implementierung:** `chat_rate_limits` Tabelle (kein Redis nötig)

### Input-Validierung
- Max. 500 Zeichen
- Whitespace-Trimming
- Leere Nachrichten → 400
- XSS: Nachrichten werden als Text gerendert (kein `innerHTML`)

### Moderation
- Jede Nachricht kann gemeldet werden (Report-Button)
- Reports landen in `chat_reports` Tabelle
- Admin-Ansicht: geplant für Phase 2

---

## 10. FREE TIER LIMITS (Cloudflare)

| Ressource | Free Limit | Verbrauch bei Chat |
|-----------|------------|-------------------|
| D1 Reads | 5M / Monat | ~1.7M (30 User, 5s Polling, 8h/Tag) |
| D1 Writes | 100K / Monat | ~45K (30 User, 50 Msgs/Tag) |
| Pages Function Req. | 100K / Tag | ~52K (30 User, 5s Polling, 8h) |
| D1 Storage | 10 GB | ~1 MB / Monat Chat-Daten |

**Fazit:** Free Tier reicht für bis zu **~30 aktive gleichzeitige User**.
Bei mehr Usern → Cloudflare Pro ($5/Mo): 50M Reads, 1M Writes.

---

## 11. STUFENPLAN (PHASEN)

### Phase A — Datenbank & Backend ✅ ABGESCHLOSSEN (2026-02-27)

**Ziel:** API-Endpoints funktionieren, kein Frontend nötig

- [x] `functions/migrations/002_add_chat_tables.sql` schreiben
- [x] Migration remote deployen: `wrangler d1 execute wild-hoggs-db --remote --file=./functions/migrations/002_add_chat_tables.sql`
- [x] `functions/api/chat/global.ts` — GET (lesen) + POST (senden)
- [x] `functions/api/chat/server/[serverName].ts` — GET + POST
- [x] `functions/api/chat/report.ts` — POST (Nachricht melden)
- [x] Rate Limit Logik in `functions/_lib/chat-ratelimit.ts`
- [x] Build erfolgreich (361 Seiten, 0 Fehler)

### Phase B — Frontend Komponenten ✅ TODO

**Ziel:** ChatWindow auf Community-Seite läuft mit Polling

- [ ] `src/components/chat/ChatWindow.tsx` — Haupt-Komponente
- [ ] `src/components/chat/MessageList.tsx` — Nachrichtenliste
- [ ] `src/components/chat/MessageItem.tsx` — Einzelnachricht + Melde-Button
- [ ] `src/components/chat/MessageInput.tsx` — Eingabe + Senden
- [ ] `src/components/chat/ServerBadge.tsx` — Faction/Server-Badge
- [ ] `src/components/chat/ChatWindow.css` — Styling (Dark Theme, Orange Akzent)
- [ ] Polling alle 3 Sekunden (setInterval + clearInterval bei Unmount)
- [ ] Auto-Scroll nach unten (neue Nachrichten)
- [ ] Pause bei Tab-Wechsel (visibilitychange)
- [ ] Build erfolgreich

### Phase C — Seite & Navigation ✅ TODO

**Ziel:** `/community/` erreichbar in allen 15 Sprachen, Nav-Link vorhanden

- [ ] `src/pages/[...lang]/community.astro` erstellen
- [ ] `getStaticPaths()` für alle 15 Sprachen
- [ ] `ChatWindow client:load` einbinden
- [ ] `nav.community` i18n Key in alle 15 Locale-Dateien
- [ ] SEO Keys (`seo.community.title`, `seo.community.description`) in alle 15 Locale-Dateien
- [ ] Alle `chat.*` Keys in alle 15 Locale-Dateien (korrekte Übersetzungen)
- [ ] `Navigation.astro` — Community-Route hinzufügen
- [ ] Build erfolgreich (346+ Seiten)

### Phase D — Test & Deploy ✅ TODO

**Ziel:** Alles live auf Cloudflare Pages

- [ ] Manuell testen: Global Chat (senden + empfangen)
- [ ] Manuell testen: Server Chat (zwei verschiedene Server → Trennung)
- [ ] Manuell testen: Rate Limit (schnell tippen → 429)
- [ ] Manuell testen: Nicht eingeloggt → Login-Hinweis
- [ ] Manuell testen: Mobile Layout
- [ ] `git push` → Cloudflare Pages deployt automatisch
- [ ] Live-Test auf Produktiv-URL

---

## 12. DATEIEN-ÜBERSICHT (NACH IMPLEMENTIERUNG)

### Neue Dateien:

```
functions/
  migrations/
    002_add_chat_tables.sql          ← 4 neue Tabellen + Indizes
  api/
    chat/
      global.ts                      ← GET/POST globaler Chat
      server/
        [serverName].ts              ← GET/POST server-spezifischer Chat
      report.ts                      ← POST Nachricht melden
  _lib/
    chat-ratelimit.ts                ← Rate Limit Hilfsfunktionen

src/
  components/
    chat/
      ChatWindow.tsx                 ← Haupt-Komponente (Preact Island)
      ChatWindow.css                 ← Styling
      MessageList.tsx                ← Scrollbare Liste
      MessageItem.tsx                ← Einzelnachricht
      MessageInput.tsx               ← Eingabe + Senden
      ServerBadge.tsx                ← Faction/Server-Badge
  pages/
    [...lang]/
      community.astro                ← Community-Seite (15 Sprachen)
```

### Geänderte Dateien:

```
functions/schema.sql                 ← Kommentar + Verweis auf Migration 002
src/components/Navigation.astro      ← Community-Route
src/i18n/locales/de.ts              ← nav.community, seo.community.*, chat.*
src/i18n/locales/en.ts              ← (same)
src/i18n/locales/fr.ts              ← (same)
... (alle 15 Locales)
```

---

## 13. OFFENE FRAGEN (vor Implementierung klären)

1. **Global Chat lesbar ohne Login?**
   - Option A: Ja, alle können lesen, nur schreiben erfordert Login
   - Option B: Nein, komplett hinter Login (sicherer gegen Scraping)
   - → **Empfehlung: Option B** (wir haben sensible Community-Daten)

2. **Message Archivierung?**
   - Nachrichten für immer behalten oder nach X Tagen löschen?
   - → **Empfehlung: 90 Tage** (automatisches Cleanup via Cron oder manuell)

3. **Alte Nachrichten beim ersten Laden?**
   - Wie viele historische Nachrichten laden beim Öffnen des Chats?
   - → **Empfehlung: letzte 50**

4. **Server-Name Format?**
   - `user.server` ist aktuell alphanumerisch (z.B. "S42", "42", "Server42")
   - Soll der Tab-Label exakt der `server`-Wert sein oder formatiert?
   - → **Empfehlung: exakter Wert** aus dem Profil

---

## 14. ZUKUNFT (Phase 2, nicht im Scope)

- **Admin-Moderations-Panel** — Gemeldete Nachrichten einsehen + löschen
- **Mute/Block System** — User können andere User stummschalten
- **Message Delete** — Autor kann eigene Nachricht löschen (Soft Delete)
- **WebSockets** — Upgrade auf Durable Objects für Echtzeit (<1s Latenz)
- **Online-Indikator** — "X User online"
- **Reaktionen** — Emoji-Reaktionen auf Nachrichten
- **DM System** — Private Nachrichten zwischen Usern

---

*chat.md — Wild Hoggs Community Chat Roadmap*
*Erstellt: 2026-02-27 | Stack: Cloudflare D1 + Pages Functions + Preact*
*Status: Planung — Phase A/B/C/D noch nicht begonnen*

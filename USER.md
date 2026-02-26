# USER.md — Auth & Persistence Audit
## Wild Hoggs — Cloudflare Pages

**Datum:** 2026-02-26
**Analyst:** Claude Code (Sonnet 4.6)
**Stack:** Cloudflare D1 + Pages Functions + Cloudflare Email Service
**Status:** Implementierungsplan, vollständig auf Cloudflare-Infrastruktur

---

## 1. AUSGANGSLAGE (IST-ZUSTAND)

### Was die Site heute ist
- **100% Static Site** — Astro 5 SSG, kein Server, kein Backend
- **Hosting:** Cloudflare Pages (CDN-Edge, weltweit verteilt)
- **6 Calculatoren:** Tank, Building, Caravan, Hero-Exp, Research (9 Kategorien)
- **15 Sprachen**, kein User-Account-System
- **State:** Wird bei jedem Page-Reload vollständig zurückgesetzt

### Das Problem
Jedes Mal wenn ein User die Seite neu lädt oder die Sprache wechselt, verliert er seinen gesamten Calculator-Fortschritt:
- Tank-Fortschritt (welche Mods freigeschaltet, Sub-Levels) → **weg**
- Research-Baum (welche Technologien auf welchem Level) → **weg**
- Building-Auswahl + Levels → **weg**
- Caravan-Power + Faction → **weg**

### Was wir wollen (SOLL-ZUSTAND)
1. **Register/Login** — User erstellt Account, meldet sich an
2. **State-Persistence** — Calculator-Zustände werden automatisch gespeichert
3. **Geräteübergreifend** — Gleicher Stand auf Handy und PC
4. **Optional: Guild-Features** — Member sehen gegenseitige Fortschritte

---

## 2. GEWÄHLTE ARCHITEKTUR: 100% CLOUDFLARE

```
Browser
  ↓ (API-Calls, JSON)
Cloudflare Pages Functions    ← Server-Code in /functions/api/
  ↓ (SQL-Queries)             ← Gleiche Edge-Location wie Site
Cloudflare D1 (SQLite)        ← Datenbank, Edge-verteilt
  ↑
Cloudflare Email Service      ← E-Mail-Versand (Passwort-Reset etc.)
```

**Warum alles Cloudflare?**
- Deine Site läuft bereits auf Cloudflare Pages — ein Ökosystem, ein Dashboard
- Keine externen API-Keys, keine Drittanbieter-Abhängigkeiten
- D1 läuft am gleichen Edge-Node wie die Site → < 5ms DB-Latenz
- DSGVO-konform konfigurierbar (EU-Region wählbar)
- **Kostenlos** für diese Größe (Free Tier reicht problemlos)

---

## 3. CLOUDFLARE D1 — DATENBANK

### Was ist D1?
Cloudflare D1 ist eine **Edge-SQLite-Datenbank** — keine separate Server-Instanz, kein VPS. Die SQLite-Datei läuft direkt auf Cloudflares Edge-Nodes, genau dort wo auch deine Seite ausgeliefert wird.

### Free Tier Limits (Stand 2026)
| Metrik | Free Limit |
|--------|-----------|
| Lese-Operationen | 5 Mio. / Tag |
| Schreib-Operationen | 100.000 / Tag |
| Storage | 5 GB |
| Datenbanken | 10 |

**Realistische Nutzung für Wild Hoggs:**
- 100 aktive User × 20 Calculator-Saves/Tag = 2.000 Schreibvorgänge
- Weit unter dem Limit → **gratis für immer** in dieser Größenordnung

### D1 einrichten
```bash
# Wrangler CLI installieren (einmalig)
npm install -g wrangler

# Bei Cloudflare einloggen
wrangler login

# D1 Datenbank erstellen
wrangler d1 create wild-hoggs-db
# → Gibt zurück: database_id = "xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**wrangler.toml** (neu erstellen im Root):
```toml
name = "wild-hoggs"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "wild-hoggs-db"
database_id = "DEINE-DATABASE-ID-HIER"

# Für E-Mail-Versand (sobald Email Service verfügbar):
[[send_email]]
name = "EMAIL"
```

---

## 4. DATENBANKSCHEMA

```sql
-- /functions/schema.sql
-- Schema für Wild Hoggs Auth + Calculator States

-- Benutzer-Tabelle
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT UNIQUE NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,           -- PBKDF2 Hash
  faction       TEXT,                    -- blood-rose | wings-of-dawn | guard-of-order
  language      TEXT DEFAULT 'en',       -- Benutzer-Sprachpräferenz
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- Sessions-Tabelle
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,      -- 256 Bit zufälliger Token
  expires_at  TEXT NOT NULL,            -- 30 Tage ab Erstellung
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Calculator States pro User
CREATE TABLE IF NOT EXISTS calculator_states (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calc_type   TEXT NOT NULL,             -- 'tank' | 'building' | 'research' | 'caravan' | 'hero-exp'
  calc_key    TEXT NOT NULL,             -- z.B. 'main' oder 'research:unit_special_training'
  state_json  TEXT NOT NULL,             -- JSON mit dem Calculator-State
  updated_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, calc_type, calc_key)
);

-- Passwort-Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,      -- 256 Bit, einmalig nutzbar
  expires_at  TEXT NOT NULL,            -- 1 Stunde gültig
  used        INTEGER DEFAULT 0,        -- 0 = unbenutzt, 1 = verwendet
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Indizes für schnelle Lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token      ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user       ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_calc_states_user    ON calculator_states(user_id);
CREATE INDEX IF NOT EXISTS idx_calc_states_lookup  ON calculator_states(user_id, calc_type, calc_key);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token  ON password_reset_tokens(token);
```

**Schema deployen:**
```bash
wrangler d1 execute wild-hoggs-db --file=./functions/schema.sql
```

---

## 5. WAS WIRD PRO CALCULATOR GESPEICHERT?

### Tank Modification Calculator
```json
{
  "calc_type": "tank",
  "calc_key": "main",
  "state": {
    "unlockedLevels": [0, 1, 2, 5, 10, 15],
    "subLevels": { "0": 5, "1": 3, "2": 2 },
    "targetLevel": 45
  }
}
```

### Building Calculator
```json
{
  "calc_type": "building",
  "calc_key": "main",
  "state": {
    "selectedBuilding": "headquarters",
    "currentLevel": 20,
    "targetLevel": 35
  }
}
```

### Research Calculator (eine Instanz pro Kategorie — 9 separate Einträge)
```json
{
  "calc_type": "research",
  "calc_key": "unit_special_training",
  "state": {
    "selectedTechnologies": {
      "unit_training_i": 10,
      "unit_training_ii": 5
    },
    "targetTechId": "unit_training_iii"
  }
}
```

### Caravan Calculator
```json
{
  "calc_type": "caravan",
  "calc_key": "main",
  "state": {
    "basePower": 1200000,
    "yourFaction": "blood-rose",
    "matchingCount": 5,
    "weeklyActive": true
  }
}
```

### Hero Exp Calculator
```json
{
  "calc_type": "hero-exp",
  "calc_key": "main",
  "state": {
    "currentLevel": 85,
    "targetLevel": 120
  }
}
```

---

## 6. API ENDPOINTS (Cloudflare Pages Functions)

**Verzeichnisstruktur:**
```
/functions/
  lib/
    auth.ts         — Hashing, Token-Generation
    db.ts           — D1 Helper, Query-Wrapper
    cors.ts         — CORS Headers
  api/
    auth/
      register.ts   POST /api/auth/register
      login.ts      POST /api/auth/login
      logout.ts     POST /api/auth/logout
      me.ts         GET  /api/auth/me
      reset.ts      POST /api/auth/reset-request
      reset/
        [token].ts  POST /api/auth/reset/:token
    state/
      [calcType].ts GET/PUT /api/state/:calcType
      sync.ts       POST /api/state/sync
    user/
      profile.ts    GET/PATCH /api/user/profile
```

### Endpoint-Übersicht

| Endpoint | Methode | Zweck | Häufigkeit |
|----------|---------|-------|-----------|
| `/api/auth/register` | POST | Neuen Account erstellen | Einmalig |
| `/api/auth/login` | POST | Einloggen, Token erhalten | Pro Login |
| `/api/auth/logout` | POST | Session ungültig machen | Pro Logout |
| `/api/auth/me` | GET | Eigenes Profil abrufen | Nach Reload |
| `/api/auth/reset-request` | POST | Passwort-Reset anfordern | Selten |
| `/api/auth/reset/:token` | POST | Neues Passwort setzen | Selten |
| `/api/state/meta` | GET | **Nur Timestamps** aller States | Alle 5 Min. |
| `/api/state/all` | GET | **Alle States** (erster Besuch) | Einmalig pro Gerät |
| `/api/state/:calcType` | GET | Einzelnen State laden (wenn stale) | Bei Bedarf |
| `/api/state/:calcType` | PUT | State speichern (debounced 1.5s) | Pro Änderung |
| `/api/user/profile` | PATCH | Faction/Sprache ändern | Selten |

**`/api/state/meta` ist der Schlüssel zur Effizienz:**
Statt alle States zu laden, werden nur ~300 Bytes Timestamps verglichen.
In 90% der Fälle (gleiches Gerät, < 5 Min.) wird dieser Endpoint gar nicht aufgerufen.

### Beispiel-Responses

**POST /api/auth/register**
```
Body:  { email, username, password }
200:   { user: { id, email, username }, token }
400:   { error: "Email bereits vergeben" }
400:   { error: "Passwort zu kurz (min 8 Zeichen)" }
```

**POST /api/auth/login**
```
Body:  { email, password }
200:   { user: { id, email, username, faction, language }, token }
401:   { error: "Ungültige Anmeldedaten" }
```

**PUT /api/state/:calcType?key=main**
```
Header: Authorization: Bearer <token>
Body:   { state: { ...calculator state } }
200:    { success: true, updated_at: "..." }
```

**POST /api/state/sync (Bulk beim Login)**
```
Header: Authorization: Bearer <token>
Body:   { states: [{ calc_type, calc_key, state, updated_at }] }
200:    { merged: [...states] }
— Merge-Logik: Neuester Timestamp gewinnt
```

---

## 7. AUTH-IMPLEMENTIERUNG

### Passwort-Hashing (PBKDF2 — nativ in Cloudflare Workers)

Keine externe Library nötig — Workers haben die WebCrypto API eingebaut:

```typescript
// /functions/lib/auth.ts

const ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Token validieren via DB-Lookup (simpler als JWT)
export async function validateToken(db: D1Database, token: string) {
  return db.prepare(
    `SELECT s.user_id, u.email, u.username, u.faction, u.language
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first();
}
```

### Session-Strategie
- Token: 64 Hex-Zeichen (256 Bit) zufällig via `crypto.getRandomValues`
- Gespeichert in D1 `sessions`-Tabelle (kein JWT-Signing nötig)
- Expiry: 30 Tage, verlängerbar bei jedem Request
- Im Browser: `localStorage` (für Gaming-Site akzeptabel)

---

## 8. E-MAIL-VERSAND — CLOUDFLARE EMAIL SERVICE

### Wichtige Analyse: Kann Cloudflare selbst E-Mails senden?

**Ja — aber es gibt Einschränkungen. Hier ist der aktuelle Stand (2026):**

---

### 8.1 Cloudflare Email Routing (NICHT für Versand geeignet)

Cloudflare Email Routing kann E-Mails **nur EMPFANGEN und WEITERLEITEN**, nicht versenden. Es ist für Transaktions-E-Mails wie Passwort-Reset komplett ungeeignet.

---

### 8.2 Cloudflare Email Service — send_email Binding ⭐

Cloudflare hat im **September 2025** den nativen E-Mail-Versand aus Workers als **Private Beta** gestartet.

**Konfiguration in wrangler.toml:**
```toml
# Nur an eine feste Zieladresse (z.B. für Notifications)
[[send_email]]
name = "EMAIL"
destination_address = "admin@wild-hoggs.com"

# ODER: Freier Versand an alle verifizierten Adressen
[[send_email]]
name = "EMAIL"
```

**Worker-Code:**
```typescript
// Passwort-Reset E-Mail senden
await env.EMAIL.send({
  to: userEmail,
  from: "noreply@wild-hoggs.com",
  subject: "Passwort zurücksetzen",
  text: `Klick hier zum Zurücksetzen: https://wild-hoggs.com/reset?token=${token}`,
  html: `<p>Klick <a href="https://wild-hoggs.com/reset?token=${token}">hier</a></p>`
});
```

**Vorteile:**
- ✅ Native Cloudflare — kein Drittanbieter, kein externer API-Key
- ✅ Automatische SPF/DKIM/DMARC-Konfiguration
- ✅ Gleiche Infrastruktur wie die Rest-API
- ✅ Ein Ökosystem, ein Dashboard
- ✅ Kostenlos während Beta

**Aktuelle Einschränkungen (Stand Feb. 2026):**
- ⚠️ Noch in **Private Beta** — nicht für alle Accounts automatisch verfügbar
- ⚠️ Erfordert **Paid Workers Plan** (nach Beta-Ende)
- ⚠️ Sender-Domain muss Cloudflare Email Routing aktiviert haben
- ⚠️ Genaue Preise nach Beta noch nicht finalisiert

**Early Access beantragen:**
→ `https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/`

---

### 8.3 MailChannels — Fallback-Lösung

MailChannels hatte bis August 2024 eine kostenlose Integration mit Cloudflare Workers. Diese wurde eingestellt. Heute bietet MailChannels noch **100 E-Mails/Tag kostenlos** als API an.

**Nur als temporärer Fallback empfohlen, falls Email Service noch nicht verfügbar.**

---

### 8.4 Strategie für Wild Hoggs

```
Phase 2a (Jetzt, ohne E-Mail):
  → Passwort-Reset OHNE E-Mail implementieren
  → User-Support manuell (Admin kann Passwort manuell zurücksetzen per Wrangler)
  → Registrierung ohne E-Mail-Bestätigung

Phase 2b (Sobald Email Service GA oder Early Access):
  → send_email Binding einrichten
  → Passwort-Reset per E-Mail automatisch
  → Optionale Registrierungsbestätigung

Fallback (falls Phase 2b zu lange dauert):
  → MailChannels API (100/Tag gratis, reicht für Gaming-Community)
```

**Empfehlung:** Starte Phase 2 ohne E-Mail-Funktion. Der einfachste Weg für jetzt ist, dass User beim Passwort vergessen den Admin kontaktieren (Discord-Server der Guild). Sobald Cloudflare Email Service allgemein verfügbar ist (voraussichtlich 2026), integrieren wir es nativ. Das ist sauber und ohne Drittanbieter.

---

### 8.5 E-Mail-Status-Übersicht

| Lösung | Verfügbar | Kostenlos | Native CF | Empfehlung |
|--------|-----------|-----------|-----------|------------|
| **CF Email Service** | Private Beta | In Beta | ✅ Ja | Abwarten / Early Access |
| **CF Email Routing** | ✅ Sofort | ✅ Ja | ✅ Ja | Nur für Empfangen |
| **MailChannels** | ✅ Sofort | 100/Tag | ❌ Nein | Fallback wenn nötig |

---

## 9. SICHERHEITSASPEKTE

### Passwort-Sicherheit
- PBKDF2-SHA256 mit 100.000 Iterationen (WebCrypto, nativ in Workers)
- Minimum 8 Zeichen
- Kein Plaintext-Logging möglich (nur Hash in D1)

### SQL-Injection
Alle D1-Queries mit Prepared Statements:
```typescript
// Sicher — immer .bind() verwenden
db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first()

// NIEMALS String-Concatenation:
db.exec(`SELECT * FROM users WHERE email = '${email}'`) // ❌ VERBOTEN
```

### Rate Limiting (Cloudflare Dashboard)
```
/api/auth/login     → max 10 Requests/Minute per IP
/api/auth/register  → max 5 Requests/Minute per IP
/api/auth/reset-*   → max 3 Requests/Minute per IP
```

### CSP (Content Security Policy)
Die bestehende `public/_headers` CSP muss **nicht angepasst werden** — alle API-Calls gehen an die eigene Domain (bereits durch `'self'` abgedeckt).

---

## 10. FRONTEND-KOMPONENTEN

### Neue Preact-Komponenten
```
src/components/
  auth/
    AuthModal.tsx       — Login/Register Modal (Tabs: Login | Registrieren)
    UserMenu.tsx        — Avatar + Dropdown in der Navigation
    AuthProvider.tsx    — Preact Context für Auth-State
  state/
    useCalculatorState.ts  — Hook: Auto-Save mit localStorage + Server-Sync
```

### AuthModal Layout
```
┌─────────────────────────────────────┐
│  Wild Hoggs                    [X]  │
├──────────────┬──────────────────────┤
│  [Anmelden]  │  [Registrieren]      │
├──────────────┴──────────────────────┤
│                                     │
│  E-Mail:   [________________]       │
│  Passwort: [________________]       │
│                                     │
│            [Anmelden]               │
│                                     │
│  Noch kein Account? Registrieren →  │
└─────────────────────────────────────┘
```

### Navigation (vorher/nachher)
```
VORHER:  [Navigation Links]
NACHHER: [Navigation Links]  [🔑 Anmelden]
                             oder
                             [⚔️ Username ▼] → [Profil | Ausloggen]
```

---

## 11. SMART CACHE STRATEGIE — "Cache-First mit Background-Validation"

Dies ist das Herzstück der Lösung. Ziel: **Der User wartet nie auf die Datenbank**, und trotzdem ist der Stand immer aktuell — egal ob Reload, Gerätewechsel oder Offline.

### 11.1 Das Grundprinzip

```
IMMER zuerst localStorage zeigen (kein Warten, kein Flicker)
DANN im Hintergrund prüfen: Ist der Server neuer?
  Ja → State still im Hintergrund aktualisieren
  Nein → Nichts tun
```

### 11.2 Der vollständige Entscheidungsbaum (Page Load)

```
PAGE LOAD
    │
    ├─[Kein localStorage]──────→ Erster Besuch / Cache gelöscht
    │                               ↓
    │                         Skeleton anzeigen
    │                               ↓
    │                         GET /api/state/all   ← 1 Request, alle States auf einmal
    │                               ↓
    │                         localStorage befüllen (mit lastSyncedAt = jetzt)
    │                               ↓
    │                         Calculator rendern ✅
    │
    └─[localStorage vorhanden]────→ Sofort rendern aus localStorage ✅ (kein Warten!)
                                          │
                                    [Background-Check]
                                          │
                                    Nicht eingeloggt?
                                       → Done ✅ (0 Requests)
                                          │
                                    Eingeloggt:
                                    Wann war letzter Meta-Check?
                                          │
                                    < 5 Minuten her?
                                       → Done ✅ (0 Requests)  ← normaler Reload
                                          │
                                    > 5 Minuten her?
                                       → GET /api/state/meta   ← 1 ultraleichter Request
                                              │
                                       Server-Timestamps == localStorage-Timestamps?
                                          Ja → Done ✅ (nur 1 leichter Request)
                                          │
                                          Nein → Nur geänderte States nachladen
                                                       ↓
                                                 localStorage aktualisieren
                                                       ↓
                                                 UI still updaten ✅
```

### 11.3 Die 5-Minuten-Freshness-Grenze

| Situation | Requests | Erklärung |
|-----------|----------|-----------|
| Reload auf gleichem Gerät (< 5 Min) | **0** | Freshness-Fenster — kein Request |
| Reload auf gleichem Gerät (> 5 Min) | **1 leicht** | Meta-Check ~300 Bytes |
| Anderes Gerät, selber Stand | **1 leicht** | Meta-Check → Timestamps gleich → fertig |
| Anderes Gerät, neuer Stand | **1 leicht + N** | Meta-Check → N geänderte States nachladen |
| Erster Besuch / leerer Cache | **1 voll** | Alle States in einem Request |

**5 Minuten** ist konfigurierbar — für eine Gaming-Site ein guter Default.

### 11.4 localStorage Datenstruktur

Jeder Calculator-State wird als ein Objekt gespeichert:

```typescript
interface CacheEntry<T> {
  state: T;              // Der eigentliche Calculator-State
  lastModifiedAt: string; // Wann der User zuletzt lokal editiert hat
  lastSyncedAt: string;   // Wann dieser Stand zuletzt mit Server bestätigt wurde
  version: number;        // Schema-Version (für Breaking Changes)
}
```

**localStorage Keys:**
```
wh-cache-v1-tank-main                        → CacheEntry<TankState>
wh-cache-v1-building-main                    → CacheEntry<BuildingState>
wh-cache-v1-caravan-main                     → CacheEntry<CaravanState>
wh-cache-v1-hero-exp-main                    → CacheEntry<HeroExpState>
wh-cache-v1-research-unit_special_training   → CacheEntry<ResearchState>
wh-cache-v1-research-army-building           → CacheEntry<ResearchState>
... (9 Research-Keys)

wh-meta-checked-at                           → ISO-Timestamp des letzten Meta-Checks
wh-auth-token                                → Session-Token
wh-auth-user                                 → { id, username, faction, language }
wh-lang-redirected                           → (bereits vorhanden — unverändert)
```

**`version`-Feld Zweck:** Wenn wir das State-Schema eines Calculators ändern (z.B. neues Feld), bumpen wir `v1` → `v2`. Alter `v1`-Cache wird ignoriert → frisch vom Server laden. Kein Crash durch inkompatible alte Daten.

### 11.5 "Dirty State" — Offline-Edits erkennen

```
lastModifiedAt > lastSyncedAt  →  "DIRTY" = lokale Änderungen noch nicht auf Server
lastModifiedAt = lastSyncedAt  →  "CLEAN" = State ist synchron mit Server
```

**Was passiert bei Dirty State:**

```
User editiert Tank-State auf PC um 10:00
  → localStorage: lastModifiedAt=10:00, lastSyncedAt=09:30 (DIRTY)
  → Server-Sync läuft im Hintergrund (Debounce 1.5s)
  → Server antwortet → lastSyncedAt=10:00 (CLEAN) ✅

User editiert auf PC, Internet weg (Offline):
  → localStorage: lastModifiedAt=10:05, lastSyncedAt=09:30 (DIRTY, Sync fehlgeschlagen)
  → Nächster Page Load auf PC:
     → localStorage hat 10:05 State → sofort anzeigen ✅
     → Meta-Check schlägt fehl (offline) → ignorieren
  → Internet kommt zurück:
     → Dirty-Detection: lastModifiedAt > lastSyncedAt → Push zum Server
     → Server aktualisiert → CLEAN ✅

User öffnet Handy während PC offline war:
  → Handy localStorage: leer (oder alt vom letzten Besuch)
  → Server hat State von 09:30 (PC-Offline-Edits noch nicht da)
  → Handy zeigt 09:30-State → korrekt! (PC hat noch nicht gesync't)
  → Wenn PC wieder online: PC pushed 10:05 → Handy sieht das beim nächsten Meta-Check
```

### 11.6 Meta-Endpoint (Server-Seite)

```typescript
// /functions/api/state/meta.ts
// GET /api/state/meta
// Gibt NUR Timestamps zurück — kein State-Inhalt
// Extrem leichtgewichtig: ~300 Bytes Antwort für alle Calculatoren

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await validateToken(ctx.env.DB, getToken(ctx.request));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { results } = await ctx.env.DB
    .prepare(`SELECT calc_type, calc_key, updated_at
              FROM calculator_states
              WHERE user_id = ?`)
    .bind(user.user_id)
    .all();

  // Kompaktes Format: "tank:main" → "2026-02-25T14:30:00Z"
  const meta: Record<string, string> = {};
  for (const row of results) {
    meta[`${row.calc_type}:${row.calc_key}`] = row.updated_at as string;
  }

  // Cache-Header: nicht cachen (immer aktuell)
  return Response.json(meta, {
    headers: { 'Cache-Control': 'no-store' }
  });
};

// Beispiel-Response (~200 Bytes):
// {
//   "tank:main": "2026-02-25T14:30:00Z",
//   "building:main": "2026-02-20T08:00:00Z",
//   "research:unit_special_training": "2026-02-24T21:15:00Z",
//   "caravan:main": "2026-02-25T10:45:00Z"
// }
```

**1 D1-Query** für alle States — kein N+1 Problem.

### 11.7 "Get All States" Endpoint (beim ersten Besuch)

```typescript
// /functions/api/state/all.ts
// GET /api/state/all
// Gibt ALLE States des Users zurück — nur beim ersten Besuch / leerem Cache

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await validateToken(ctx.env.DB, getToken(ctx.request));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { results } = await ctx.env.DB
    .prepare(`SELECT calc_type, calc_key, state_json, updated_at
              FROM calculator_states
              WHERE user_id = ?`)
    .bind(user.user_id)
    .all();

  const states: Record<string, { state: unknown; updated_at: string }> = {};
  for (const row of results) {
    states[`${row.calc_type}:${row.calc_key}`] = {
      state: JSON.parse(row.state_json as string),
      updated_at: row.updated_at as string
    };
  }

  return Response.json(states);
};
```

### 11.8 Der useCalculatorState Hook (vollständige Implementierung)

```typescript
// src/hooks/useCalculatorState.ts

const CACHE_VERSION = 1;
const FRESHNESS_WINDOW_MS = 5 * 60 * 1000; // 5 Minuten

interface CacheEntry<T> {
  state: T;
  lastModifiedAt: string;
  lastSyncedAt: string;
  version: number;
}

function getCacheKey(calcType: string, calcKey: string) {
  return `wh-cache-v${CACHE_VERSION}-${calcType}-${calcKey}`;
}

function readCache<T>(calcType: string, calcKey: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(getCacheKey(calcType, calcKey));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    // Inkompatible Schema-Version → ignorieren
    if (entry.version !== CACHE_VERSION) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache<T>(calcType: string, calcKey: string, state: T, opts: {
  touch?: boolean;  // true = lastModifiedAt aktualisieren (User hat editiert)
  sync?: string;    // ISO-String = lastSyncedAt aktualisieren (Server hat bestätigt)
}) {
  const existing = readCache<T>(calcType, calcKey);
  const now = new Date().toISOString();
  const entry: CacheEntry<T> = {
    state,
    lastModifiedAt: opts.touch ? now : (existing?.lastModifiedAt ?? now),
    lastSyncedAt:   opts.sync  ?? (existing?.lastSyncedAt ?? now),
    version: CACHE_VERSION
  };
  localStorage.setItem(getCacheKey(calcType, calcKey), JSON.stringify(entry));
  return entry;
}

// ─── Debounce-Registry (pro calcType+calcKey einen Timer) ────────────────
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debouncedServerSync(
  calcType: string, calcKey: string, state: unknown, token: string
) {
  const key = `${calcType}:${calcKey}`;
  clearTimeout(syncTimers.get(key));
  syncTimers.set(key, setTimeout(async () => {
    try {
      const res = await fetch(`/api/state/${calcType}?key=${calcKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ state })
      });
      if (res.ok) {
        const { updated_at } = await res.json();
        // lastSyncedAt aktualisieren — State ist jetzt CLEAN
        writeCache(calcType, calcKey, state, { sync: updated_at });
      }
    } catch {
      // Offline oder Fehler → DIRTY bleibt, wird beim nächsten Load wieder versucht
    }
  }, 1500));
}

// ─── Background Meta-Check ───────────────────────────────────────────────
async function backgroundValidation(token: string, updateFn: (key: string, state: unknown) => void) {
  const lastCheck = localStorage.getItem('wh-meta-checked-at');
  const now = Date.now();

  // Freshness-Fenster: < 5 Minuten → überspringen
  if (lastCheck && now - new Date(lastCheck).getTime() < FRESHNESS_WINDOW_MS) {
    return;
  }

  try {
    const metaRes = await fetch('/api/state/meta', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!metaRes.ok) return;

    const serverMeta: Record<string, string> = await metaRes.json();
    localStorage.setItem('wh-meta-checked-at', new Date().toISOString());

    // Prüfe welche Keys neuer sind als unser Cache
    const staleKeys: string[] = [];
    for (const [key, serverTimestamp] of Object.entries(serverMeta)) {
      const [calcType, calcKey] = key.split(':');
      const cached = readCache(calcType, calcKey);

      if (!cached) {
        staleKeys.push(key);
        continue;
      }

      // Server neuer als unser letzter Sync → nachladen
      if (serverTimestamp > cached.lastSyncedAt) {
        // ABER: lokale ungesyncte Änderungen nicht überschreiben
        if (cached.lastModifiedAt <= cached.lastSyncedAt) {
          staleKeys.push(key);
        }
        // else: dirty local state → Server-Update ignorieren, local wins
      }
    }

    // Nur veraltete States nachladen
    for (const key of staleKeys) {
      const [calcType, calcKey] = key.split(':');
      const res = await fetch(`/api/state/${calcType}?key=${calcKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) continue;
      const { state, updated_at } = await res.json();
      writeCache(calcType, calcKey, state, { sync: updated_at });
      updateFn(key, state); // UI still updaten
    }
  } catch {
    // Netzwerkfehler → ignorieren, nächster Check in 5 Minuten
  }
}

// ─── Der eigentliche Hook ────────────────────────────────────────────────
export function useCalculatorState<T>(
  calcType: string,
  calcKey: string,
  defaultState: T
): [T, (updater: T | ((prev: T) => T)) => void] {
  const { token } = useAuth();

  // 1. Sofort aus Cache laden — kein Warten, kein Flicker
  const [state, setStateRaw] = useState<T>(() => {
    const cached = readCache<T>(calcType, calcKey);
    return cached?.state ?? defaultState;
  });

  // 2. State updaten
  const setState = useCallback((updater: T | ((prev: T) => T)) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      // In Cache schreiben (touch = User hat editiert)
      writeCache(calcType, calcKey, next, { touch: true });
      // Server-Sync debounced (1.5s)
      if (token) debouncedServerSync(calcType, calcKey, next, token);
      return next;
    });
  }, [token, calcType, calcKey]);

  // 3. Background-Validation beim Mount (wenn eingeloggt)
  useEffect(() => {
    if (!token) return;

    // Dirty-Sync: ungesyncte lokale Änderungen sofort pushen
    const cached = readCache<T>(calcType, calcKey);
    if (cached && cached.lastModifiedAt > cached.lastSyncedAt) {
      debouncedServerSync(calcType, calcKey, cached.state, token);
    }

    // Background Meta-Check (einmal pro Mount, max. alle 5 Minuten)
    backgroundValidation(token, (key, serverState) => {
      const [ct, ck] = key.split(':');
      if (ct === calcType && ck === calcKey) {
        setStateRaw(serverState as T);
      }
    });
  }, [token]);

  return [state, setState];
}
```

### 11.9 Erster Login / leerer Cache

```typescript
// src/hooks/useAuthSync.ts
// Wird einmalig nach dem Login aufgerufen

export async function syncOnLogin(token: string) {
  // Gibt es überhaupt lokalen Cache?
  const hasAnyCache = Object.keys(localStorage)
    .some(k => k.startsWith(`wh-cache-v${CACHE_VERSION}-`));

  if (!hasAnyCache) {
    // Erster Besuch auf diesem Gerät → alle States vom Server laden
    const res = await fetch('/api/state/all', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const allStates: Record<string, { state: unknown; updated_at: string }> = await res.json();

    for (const [key, { state, updated_at }] of Object.entries(allStates)) {
      const [calcType, calcKey] = key.split(':');
      writeCache(calcType, calcKey, state, { sync: updated_at });
    }
    localStorage.setItem('wh-meta-checked-at', new Date().toISOString());
    return;
  }

  // Cache vorhanden: Dirty-Checks + Meta-Validation
  // (backgroundValidation übernimmt das beim nächsten Mount)
  localStorage.removeItem('wh-meta-checked-at'); // Sofortiger Check erzwingen
}
```

### 11.10 Wann belastet das System die Datenbank?

Das ist der Kern der ganzen Strategie — so wenig DB-Requests wie absolut nötig:

**DB-Schreibvorgänge (nur wenn User etwas ändert):**
```
User ändert Tank-State → 1.5s warten (debounce) → 1 PUT an Server
User ändert nichts → 0 Schreibvorgänge → DB unberührt
```

**DB-Lesevorgänge (nur wenn Daten wirklich alt sind):**
```
Server-Seite: Der updated_at Timestamp in der DB ändert sich NUR wenn
              der User tatsächlich neue Daten gespeichert hat.

Wenn von keinem Gerät Änderungen gemacht wurden:
  → Server-Timestamp bleibt unverändert
  → localStorage-Timestamp = Server-Timestamp
  → "Timestamps gleich" = kein einziger Lesevorgang nötig

Wann passiert also WIRKLICH ein DB-Read?
  1. Erster Besuch auf neuem Gerät → alle States laden (1 Query)
  2. User war gestern auf Handy, änderte dort den Tank → PC fragt heute nach
     → 1 Meta-Query (Timestamps) + 1 State-Query (nur geänderter State)
  3. Nach 5-Minuten-Fenster + tatsächliche Änderung auf anderem Gerät
     → 1 Meta-Query + n State-Queries (nur für geänderte States)

Was NICHT passiert:
  → Kein DB-Read bei jedem Page-Reload auf gleichem Gerät ✅
  → Kein DB-Read wenn niemand etwas geändert hat ✅
  → Kein DB-Read wenn Timestamps übereinstimmen ✅
```

**Visualisierung der Timestamp-Logik:**
```
Server DB:       updated_at = "2026-02-25 14:30:00"
                        ↓ (ändert sich NUR bei PUT-Request)
localStorage:  lastSyncedAt = "2026-02-25 14:30:00"

Vergleich beim Meta-Check:
  Server == localStorage  →  "IDENTISCH" → kein weiterer Request ✅
  Server  > localStorage  →  "SERVER NEUER" → State nachladen
  Server  < localStorage  →  "LOCAL NEUER" → dirtyState pushen
```

### 11.11 Pending-Sync Indikator (UX)

Optional: Kleiner visueller Hinweis wenn lokale Änderungen noch nicht gespeichert wurden:

```
┌────────────────────────────────────────────┐
│  Tank Calculator                 💾 Gespeichert  │
│  (oder: ⏳ Wird gespeichert...  wenn DIRTY)   │
└────────────────────────────────────────────┘
```

```typescript
// In Calculator-Komponenten
const [isDirty, setIsDirty] = useState(false);

// Im setState-Wrapper: setIsDirty(true) bei Änderung
// Nach Server-Sync-Erfolg: setIsDirty(false)
```

---

## 12. MIGRATION DER BESTEHENDEN CALCULATOREN

### Vorher (aktuell in TankCalculator.tsx):
```typescript
const [unlockedLevels, setUnlockedLevels] = useState<Set<number>>(new Set());
const [subLevels, setSubLevels] = useState<Map<number, number>>(new Map());
```

### Nachher (mit Persistence):
```typescript
const [tankState, setTankState] = useCalculatorState('tank', 'main', {
  unlockedLevels: [],  // Set → Array für JSON-Serialisierung
  subLevels: {},       // Map → Object für JSON-Serialisierung
  targetLevel: null
});

// Set/Map intern rekonstruieren
const unlockedLevels = new Set(tankState.unlockedLevels);
const subLevels = new Map(Object.entries(tankState.subLevels));
```

**Hinweis:** `Set` und `Map` können nicht direkt in JSON serialisiert werden → immer als `Array` bzw. `Object` speichern.

---

## 13. STUFENPLAN (PRIORISIERT)

### Phase 1 — localStorage-Persistence ✅ ABGESCHLOSSEN (2026-02-26)
**Ziel:** Calculator-States überleben Page-Reload — sofortiger Nutzen

- [x] `usePersistedState` Hook schreiben (`src/hooks/usePersistedState.ts`)
- [x] TankCalculator auf Hook umstellen (Set/Map → Array/Record für JSON)
- [x] BuildingCalculator auf Hook umstellen
- [x] CaravanCalculator auf Hook umstellen
- [x] HeroExpCalculator auf Hook umstellen
- [x] ResearchCategoryCalculator auf Hook umstellen (je Kategorie eigener Key)
- [x] Build erfolgreich (346 Seiten, 0 Fehler)

**localStorage Keys nach Phase 1:**
```
wh-calc-tank           → { unlockedLevels, subLevels, viewMode, targetLevel }
wh-calc-building       → { selectedBuilding, currentLevel, targetLevel, calculated }
wh-calc-caravan        → { powerInput, yourFaction, matchingCount, weeklyActive, calculated }
wh-calc-hero-exp       → { currentLevel, targetLevel, calculated }
wh-calc-research-{id}  → { selectedTechnologies, targetTechId, layoutDirection }
                           (9 separate Keys, einer pro Research-Kategorie)
```

**Ergebnis:** User kann Seite neu laden — State ist noch da. Kein Login nötig.
Wenn User die Sprache wechselt (z.B. /de → /en) bleibt der State ebenfalls erhalten.

---

### Phase 2 — Auth + D1 + Smart Cache ✅ ABGESCHLOSSEN (2026-02-26)
**Ziel:** Echte Accounts, geräteübergreifend, kein Passwortverlust, minimale DB-Requests

- [x] `wrangler.toml` erstellen (D1 ID: 1c0e2139-6bec-43b7-9a18-b6ba0b6c97d7)
- [x] `functions/schema.sql` erstellen (users, sessions, calculator_states, reset_tokens)
- [x] `functions/_lib/auth.ts` (PBKDF2 Hashing, Token-Generation, Session-Validierung)
- [x] Auth-Endpoints: register, login, logout, me
- [x] `/api/state/meta` — nur Timestamps, ~300 Bytes
- [x] `/api/state/all` — alle States auf einmal (erster Gerätebesuch)
- [x] `/api/state/[calcType]` — GET/PUT einzelner State
- [x] `/api/user/profile` — PATCH Faction/Sprache
- [x] `src/hooks/useAuth.ts` — Auth-State via localStorage + CustomEvents
- [x] `src/hooks/useCalculatorState.ts` — Smart Cache Hook (Phase 1 Data migriert)
- [x] `src/components/auth/AuthModal.tsx` — Login/Register Modal
- [x] `src/components/auth/UserMenu.tsx` — Nav-Integration
- [x] Navigation.astro — UserMenu eingebunden
- [x] Alle 5 Calculatoren auf `useCalculatorState` migriert
- [x] Build erfolgreich (346 Seiten, 0 Fehler)

**⚠️ NOCH OFFEN (manuelle Schritte durch User):**
- [ ] Schema in D1 deployen: `wrangler d1 execute wild-hoggs-db --remote --file=./functions/schema.sql`
- [ ] Code deployen: `git push` → Cloudflare Pages baut automatisch
- [ ] Rate Limiting im Cloudflare Dashboard (optional, aber empfohlen)

**Passwort vergessen (Interim-Lösung ohne E-Mail):**
```sql
-- Admin setzt Passwort zurück (neues Hash manuell generieren nicht möglich via SQL)
-- Einfachste Lösung: User löschen, neu registrieren lassen
wrangler d1 execute wild-hoggs-db --remote --command="DELETE FROM users WHERE email='user@example.com';"
```

---

### Phase 3 — E-Mail-Versand (sobald CF Email Service GA)
**Ziel:** Automatischer Passwort-Reset per E-Mail, native Cloudflare

- [ ] Early Access für Cloudflare Email Service beantragen
- [ ] `[[send_email]]` Binding in `wrangler.toml` ergänzen
- [ ] `/functions/api/auth/reset-request.ts` implementieren
- [ ] `/functions/api/auth/reset/[token].ts` implementieren
- [ ] Passwort-Reset UI im AuthModal ergänzen
- [ ] `password_reset_tokens` Tabelle nutzen (bereits im Schema)

---

### Phase 4 — Optional (nach Phase 3)
- [ ] Discord OAuth Login (sehr passend für Gaming-Community)
- [ ] Guild-Features: Member-Stats vergleichen
- [ ] Leaderboard: Höchster Tank-Level, meiste Research-Badges
- [ ] Profil-Seite: Eigene Stats zusammengefasst

---

## 14. NEUE DATEIEN / GEÄNDERTE DATEIEN

### Neue Dateien:
```
wrangler.toml
functions/
  schema.sql
  lib/
    auth.ts
    db.ts
    cors.ts
  api/
    auth/
      register.ts
      login.ts
      logout.ts
      me.ts
      reset-request.ts         ← Phase 3
      reset/[token].ts         ← Phase 3
    state/
      [calcType].ts
      sync.ts
    user/
      profile.ts

src/
  components/
    auth/
      AuthModal.tsx
      UserMenu.tsx
      AuthProvider.tsx
  hooks/
    useCalculatorState.ts
    useLocalCalculatorState.ts
```

### Geänderte Dateien:
```
src/layouts/Layout.astro           — UserMenu einbinden
src/components/calculators/TankCalculator.tsx
src/components/calculators/BuildingCalculator.tsx
src/components/calculators/CaravanCalculator.tsx
src/components/calculators/HeroExpCalculator.tsx
src/components/calculators/ResearchCategoryCalculator.tsx
src/i18n/locales/*.ts              — Auth-Strings für alle 15 Sprachen
```

---

## 15. KOSTEN-ÜBERSICHT

| Service | Free Tier | Bezahlt ab |
|---------|-----------|------------|
| Cloudflare Pages | Unbegrenzt | — |
| Cloudflare Pages Functions | 100.000 Req/Tag | $5/Mo ab 10M Req |
| Cloudflare D1 | 5M reads, 100k writes/Tag | $0,001/1M reads |
| Cloudflare Email Service | Kostenlos in Beta | Preise nach Beta offen |

**Für die aktuelle Größe der Site: 100% kostenlos**

---

## 16. ZUSAMMENFASSUNG

| Frage | Antwort |
|-------|---------|
| **Wo liegt die Datenbank?** | Cloudflare D1 — SQLite am Edge, neben der Site |
| **Was kostet es?** | Kostenlos (Free Tier reicht für diese Größe) |
| **Braucht es einen neuen Server?** | Nein — Cloudflare Pages Functions (kein VPS) |
| **Kann Cloudflare selbst E-Mails senden?** | Ja — aber Email Service ist noch Private Beta (Feb. 2026) |
| **Was tun bis Email Service GA ist?** | Admin-gestütztes Passwort-Reset per Discord |
| **Ist es DSGVO-konform?** | Ja — D1 in EU-Region konfigurierbar, kein Drittanbieter |
| **Geräteübergreifend?** | Ja — nach Phase 2 |
| **Wird die Site langsamer?** | Nein — localStorage sofort, DB nur bei echten Änderungen |
| **Wann wird die DB gelesen?** | Nur wenn Server-Timestamp ≠ localStorage-Timestamp |
| **Wann wird die DB geschrieben?** | Nur wenn User tatsächlich Daten ändert |
| **Reload auf gleichem Gerät?** | 0 DB-Requests (Freshness-Fenster 5 Min.) |
| **Gerät nach 1 Tag?** | 1 leichter Meta-Request (~300 Bytes) → ggf. Nachladen |
| **Empfohlene Reihenfolge?** | Phase 1 (localStorage) → Phase 2 (Auth + Smart Cache) → Phase 3 (E-Mail) |

### Das Grundprinzip in einem Satz

> **Der Server-Timestamp ändert sich nur wenn Daten gespeichert wurden. Stimmt der localStorage-Timestamp damit überein, ist kein einziger DB-Read nötig.**

---

*USER.md — Wild Hoggs Auth & Persistence Audit*
*Erstellt: 2026-02-26 | Stack: 100% Cloudflare (D1 + Pages Functions + Email Service)*

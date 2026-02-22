# AUDIT_SENIOR.md — Wild Hoggs
## Vollständiger Senior-Audit · 5 Agenten · 22. Februar 2026

> **Stack:** Astro 5.17.1 · Preact 10.28.3 · TypeScript · 15 Sprachen
> **Hosting:** Cloudflare Pages
> **Methode:** Jeder Befund wurde durch direktes Lesen der Quelldateien verifiziert — keine Vermutungen.

---

## Gesamtbewertung

| Bereich | Note | Kritisch | Hoch | Mittel | Niedrig |
|---------|------|----------|------|--------|---------|
| Security | A- | 0 | 0 | 1 | 1 |
| Performance | B+ | 1 | 2 | 1 | 1 |
| SEO | A | 0 | 0 | 2 | 1 |
| Accessibility | B+ | 0 | 1 | 3 | 2 |
| Code Quality | A | 0 | 0 | 2 | 2 |
| Dead Code | A | 0 | 0 | 0 | 4 |
| Bugs | B+ | 0 | 3 | 2 | 0 |
| Cloudflare | A- | 0 | 0 | 0 | 2 |

---

## 1. Security — Note: A-

**Geprüfte Dateien:** `public/_headers`, `astro.config.mjs`, `src/schemas/research.ts`,
alle `.tsx`- und `.astro`-Dateien auf XSS/Injection, `package.json` (npm audit)

### ✅ Positiv

- **HTTP-Header komplett:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (alle Gerätezugriffe deaktiviert),
  `Strict-Transport-Security: max-age=15552000; includeSubDomains; preload`
- **CSP vorhanden** (`public/_headers` Z. 13) — `unsafe-inline` ist durch Astro ViewTransitions begründet
  und dokumentiert. Kein User-Input wird ungesäubert gerendert.
- **Kein XSS:** Kein `dangerouslySetInnerHTML`. Einziges `set:html` in `Layout.astro` Z. 163–164
  rendert `JSON.stringify(organizationSchema)` — sicher.
- **Zod-Validierung** auf allen Datendateien (`src/schemas/research.ts`).
- **Keine Secrets** im Code. `.env` und `.env.production` korrekt in `.gitignore`.
- **Externe Links** mit `rel="noopener noreferrer"` (`codes.astro` Z. 79).
- **Keine Third-Party-Scripts** — null externe CDN-Abhängigkeiten.
- **Open-Redirect** verhindert: `404.astro` nutzt Whitelist-Regex für erlaubte Sprachen.

### Findings

#### ~~SEC-1 — MITTEL: Externe Domain in CSP img-src~~ ✅ BEHOBEN
~~**Datei:** `public/_headers` Z. 13~~
~~**Code:** `img-src 'self' data: https://levelgeeks.org;`~~
~~**Problem:** `levelgeeks.org` ist als externe Bildquelle erlaubt, aber alle Bilder sind lokal gespeichert.~~
**Fix:** `https://levelgeeks.org` aus `img-src` entfernt. CSP ist jetzt `img-src 'self' data:` — minimale Angriffsfläche.

#### ~~SEC-2 — NIEDRIG: Transitive Abhängigkeit `devalue` mit LOW-Schwachstelle~~ ✅ BEHOBEN
~~**Datei:** `package.json` (transitive via `astro`)~~
~~**CVEs:** GHSA-33hq-fvwr-56pm, GHSA-8qm3-746x-r74r~~
**Fix:** `npm update astro` → Astro 5.17.3 installiert.

---

## 2. Performance — Note: B+

**Geprüfte Dateien:** `src/layouts/Layout.astro`, `src/layouts/PageLayout.astro`,
`public/_headers`, `astro.config.mjs`, `src/components/Navigation.astro`,
`src/components/ApocalypseTimeClock.tsx`, alle Bilddateien in `public/`

### ✅ Positiv

- **Cache-Strategie perfekt:** `/_astro/*` 1 Jahr immutable, `/images/*` 30 Tage, HTML 1 Stunde.
- **Hydration-Strategie gut:** Kalkulatoren auf `client:idle`, interaktive Listen auf `client:visible`.
- **Bundle-Splitting:** Preact in eigenem `vendor-preact`-Chunk (29 KB). `esbuild.drop: ['console']`.
- **System-Fonts:** Keine Web-Fonts → kein FOUT, kein extra Netzwerk-Request.
- **Globaler Timer:** `useGlobalTimer`-Hook teilt ein einziges `setInterval` für alle Timer-Instanzen.
- **Hero-Bilder mit Dimensionen:** `HeroGrid.tsx` Z. 136/379 — `width` und `height` gesetzt → kein CLS.
- **Lazy Loading:** `loading="lazy"` auf allen Nicht-kritischen Bildern.

### Findings

#### ~~PERF-1 — KRITISCH: `body { overflow: hidden; height: 100vh }` — CLS-Risiko auf Mobile~~ ✅ BEHOBEN
**Dateien:** `src/layouts/Layout.astro`, `src/layouts/PageLayout.astro`

~~`height: 100vh; overflow: hidden` aus `body` — CLS-Risiko, Mobile-Adressleiste abgeschnitten~~

**Fix:**
- `Layout.astro`: `height: 100vh` + `overflow: hidden` entfernt → `min-height: 100dvh`
- `PageLayout.astro`: alle `100vh` → `100dvh` (Desktop + Breadcrumb-Variante)

~~#### PERF-2 — HOCH: `hero.webp` als CSS-Hintergrundbild~~ — **ENTFERNT (by design)**
CSS-Hintergrundbilder auf Tool-Cards sind gewolltes Design. Kein Handlungsbedarf.

#### ~~PERF-3 — HOCH: `ApocalypseTimeClock` auf `client:load` statt `client:idle`~~ ✅ BEHOBEN
**Datei:** `src/components/Navigation.astro` Z. 62

~~`client:load` → blockiert TTI unnötig~~
**Fix:** `client:idle` — Hydration auf Browser-Leerlaufzeit verschoben.

#### PERF-4 — MITTEL: Mehrere CSS-Bundles pro Seite
**Evidenz:** `dist/_astro/heroes.bD_XahlR.css` (13 KB) + `dist/_astro/heroes.Fo94m1cc.css` (452 B)
— 2–3 CSS-Requests pro Seite durch `cssCodeSplit: true`.
**Bewertung:** HTTP/2 auf Cloudflare mildert dies, aber Konsolidierung würde FCP auf 3G verbessern.
**Fix (optional):** `cssCodeSplit: false` in `astro.config.mjs` testen.

---

## 3. SEO — Note: A

**Geprüfte Dateien:** `src/layouts/Layout.astro`, `public/robots.txt`, `astro.config.mjs`,
alle `src/pages/[...lang]/*.astro`-Dateien, `src/components/Breadcrumbs.astro`

### ✅ Positiv

- **Hreflang für alle 15 Sprachen** korrekt implementiert (`Layout.astro` Z. 28–54)
  inkl. `x-default` auf Englisch und korrekte `zh-TW`/`zh-CN`-Codes.
- **Canonical URLs** auf jeder Seite (`Layout.astro` Z. 135).
- **Sitemap** mit allen 15 Sprachvarianten, dynamischem `lastmod`, Ausschluss von Platzhalterseiten.
- **robots.txt** korrekt: `Allow: /` + Sitemap-URL.
- **Structured Data:** Organization, WebSite, BreadcrumbList, HowTo-Schemas (`Layout.astro` Z. 56–106).
- **OG-Tags komplett:** `og:type`, `og:url`, `og:title`, `og:description`, `og:image` (1200×630),
  `og:locale`, `og:locale:alternate`, `twitter:card`.
- **404 noindex:** `<meta name="robots" content="noindex, nofollow">` korrekt gesetzt.
- **Einzigartige Seitentitel** auf allen Seiten, inklusive dynamischer Monats/Jahres-Tokens.

### Findings

#### ~~SEO-1 — MITTEL: `og:locale:alternate` auf 5 Einträge begrenzt~~ ✅ BEHOBEN
**Datei:** `src/layouts/Layout.astro` Z. 89

~~`.slice(0, 5)` begrenzte auf 5 von 15 Sprachen~~
**Fix:** `.slice(0, 5)` entfernt → alle 14 Alternativ-Locales werden ausgegeben.

#### ~~SEO-2 — NIEDRIG: `members.astro` — Description hardcodiert auf Englisch~~ ✅ BEHOBEN
**Datei:** `src/pages/[...lang]/members.astro`

~~`description="Wild Hoggs Guild Members Roster"` — hardcodiert Englisch~~
**Fix:** `description={t('seo.members.description')}` — `seo.members.description` existiert bereits in allen 15 Locales.

---

## 4. Accessibility — Note: B+

**Geprüfte Dateien:** alle `.tsx`- und `.astro`-Dateien, `src/styles/design-tokens.css`,
`src/pages/[...lang]/members.astro`, `src/components/HeroGrid.css`

### ✅ Positiv

- **Skip-Link** implementiert (`PageLayout.astro` Z. 22–52) — WCAG 2.4.1 ✓
- **Semantische Struktur:** Korrekte Heading-Hierarchie, `<nav>`, `<main>`, `<section>`.
- **Modal vollständig zugänglich:** `role="dialog"`, `aria-modal`, `aria-labelledby`, Focus-Trap,
  ESC-Taste, Fokus-Rückgabe (`HeroGrid.tsx` Z. 90–181) — WCAG 2.1.1 ✓
- **Formulare korrekt:** Alle `<input>`-Elemente haben verknüpfte `<label>` via `htmlFor/id`.
- **ARIA-Live-Regionen:** Hero-Counter (`aria-live="polite"`), ErrorBoundary (`role="alert"`),
  Timer (`role="timer"`, `aria-atomic="true"`).
- **Buttons mit ARIA-Labels:** Alle Icon-Buttons haben `aria-label`.
- **Sprachdropdown:** `aria-haspopup`, `aria-expanded`, ESC-Unterstützung, RTL für Arabisch.
- **Breadcrumbs:** `aria-current="page"`, `aria-hidden` auf Trennzeichen, BreadcrumbList-Schema.

### Findings

#### ~~A11Y-1 — HOCH: Farb-Kontrast-Verstöße (WCAG 1.4.3 Level AA)~~ ✅ BEHOBEN

| Datei | Selektor | Vorher | Nachher |
|-------|----------|--------|---------|
| `members.astro` | `.level-filter-label` | `rgba(255,255,255,0.3)` | `rgba(255,255,255,0.6)` |
| `members.astro` | `.sort-row-label` | `rgba(255,255,255,0.3)` | `rgba(255,255,255,0.6)` |
| `members.astro` | `.visible-count` | `rgba(255,255,255,0.28)` | `rgba(255,255,255,0.6)` |
| `members.astro` | `.avg-label` | `rgba(255,255,255,0.3)` | `rgba(255,255,255,0.6)` |
| `HeroGrid.css` | `::placeholder` | `rgba(255,255,255,0.25)` | `rgba(255,255,255,0.5)` |

Alle Texte erfüllen jetzt WCAG AA Mindestkontrast.

#### ~~A11Y-2 — MITTEL: Tool-Cards haben kein `aria-label` für Hintergrundbilder~~ ✅ BEHOBEN
**Datei:** `src/pages/[...lang]/tools.astro`

Alle 5 Tool-Card-Links haben jetzt `aria-label={t('tools.X.title')}` — übersetzt in allen 15 Sprachen.

#### ~~A11Y-3 — MITTEL: Fehlende `focus-visible`-Stile auf Tool-Cards~~ ✅ BEHOBEN
**Datei:** `src/pages/[...lang]/tools.astro`

```css
.tool-card:focus-visible {
  outline: 2px solid #ffa500;
  outline-offset: 3px;
}
```
WCAG 2.4.7 Level AA erfüllt.

#### ~~A11Y-4 — NIEDRIG: Sprachdropdown — Arrow-Key-Navigation fehlt~~ ✅ BEHOBEN
**Datei:** `src/components/LanguageDropdown.astro`

~~Kein `ArrowUp`/`ArrowDown`-Support im `role="menu"`~~
**Fix:** `keydown`-Handler auf `menu` ergänzt — `ArrowDown`/`ArrowUp` (zyklisch), `Home`/`End`, `Escape` (mit Fokus-Rückgabe auf Toggle). WCAG 2.4.3 ✓

#### A11Y-5 — NIEDRIG: `og:locale:alternate` begrenzt (→ auch SEO-1)
Bereits bei SEO dokumentiert.

---

## 5. Code Quality — Note: A

**Geprüfte Dateien:** alle `src/components/**/*.tsx`, `src/utils/*.ts`, `tsconfig.json`,
`src/hooks/useGlobalTimer.ts`, `src/components/calculators/*.tsx`

### ✅ Positiv

- **TypeScript strict:** `tsconfig.json` extends `astro/tsconfigs/strict`. Keine `any`-Typen in Produktionspfaden.
- **Alle Props typisiert:** Jede Komponente hat ein klar definiertes Interface mit `readonly`.
- **Preact-Best-Practices:** `useEffect`-Cleanups vorhanden, korrekte `key`-Props in Listen,
  `useMemo`/`useCallback`/`memo()` an sinnvollen Stellen.
- **Error Boundary** korrekt als Klassen-Komponente mit `componentDidCatch`.
- **Naming Conventions** konsistent: camelCase Variablen, PascalCase Komponenten, UPPER_SNAKE_CASE Konstanten.
- **Keine TODO/FIXMEs** außer einem dokumentierten Enhancement (Error-Tracking-Service).
- **Globaler Timer-Hook** (`useGlobalTimer`) — teilt ein `setInterval` über alle Abonnenten.
- **Konfigurationskonstante:** `APOCALYPSE_TIMEZONE_OFFSET` in `src/config/game.ts` zentralisiert.

### Findings

#### ~~CODE-1 — MITTEL: Debug-`console.log` in Render-Loop (Produktionscode)~~ ✅ BEHOBEN
**Datei:** `src/components/calculators/TankModificationTree.tsx`

~~`console.log` für erste 5 Nodes bei jedem Re-Render — Console-Pollution~~
**Fix:** Debug-Block vollständig entfernt.

#### CODE-2 — MITTEL: Duplizierter Zoom-Control-Code (~130 Zeilen)
**Dateien:**
- `src/components/calculators/ResearchTreeView.tsx` Z. 118–223
- `src/components/calculators/TankModificationTree.tsx` Z. 140–232

Nahezu identische Implementierung von:
- Mobile-Zoom-Berechnung (`window.innerWidth < 768`, Padding-Berechnung)
- `handleZoomIn/Out`, `handleResetView`
- `handleScroll[Up/Down/Left/Right]`

**Fix:** Custom Hook `useTreeViewControls(containerRef, options)` + Utility `calculateMobileZoom()` extrahieren.

#### ~~CODE-3 — NIEDRIG: Hardcodierter Breakpoint `768` an mehreren Stellen~~ ✅ BEHOBEN
~~**Dateien:** `ResearchTreeView.tsx` (4×), `TankModificationTree.tsx` (1×)~~
**Fix:** `BREAKPOINT_MOBILE = 768` in `src/config/game.ts` — beide Komponenten importieren und nutzen die Konstante.

#### CODE-4 — NIEDRIG: TODO für Error-Tracking-Service
**Datei:** `src/components/ErrorBoundary.tsx` Z. 42
`// TODO: Send to error tracking service (Sentry, LogRocket, etc.)`
**Bewertung:** Kein Bug — gültiges Enhancement-Item. Bei Gelegenheit Sentry o. Ä. integrieren.

---

## 6. Dead Code — Note: A

**Geprüfte Dateien:** `src/utils/*.ts`, alle Komponenten und Seiten

### ✅ Positiv

- Keine ungenutzten Imports in geprüften Dateien.
- Keine ungenutzten Variablen.
- Alle Komponenten werden aktiv genutzt.
- Alle Datendateien (`src/data/`) sind importiert.
- Alle Routen (`src/pages/`) sind verlinkt und erreichbar.
- Keine auskommentierten Code-Blöcke.

### Findings

#### ~~DEAD-1 — NIEDRIG: 4 exportierte Utility-Funktionen nie importiert~~ ✅ BEHOBEN

| Funktion | Datei | Status |
|----------|-------|--------|
| ~~`getResponsiveNodeDimensions`~~ | `treeNodeConfig.ts` | ✅ entfernt |
| ~~`getTreeSpacing`~~ | `treeNodeConfig.ts` | ✅ entfernt |
| ~~`getAllResearchImages`~~ | `researchImages.ts` | ✅ entfernt |
| ~~`getImageCount`~~ | `researchImages.ts` | ✅ entfernt |

---

## 7. Bugs — Note: B+

**Geprüfte Dateien:** `src/data/heroes.ts`, `src/data/research/*.json`,
`src/data/reward-codes.json`, alle Routing-Dateien, i18n-Dateien

### ✅ Positiv

- **i18n konsistent:** 535 Schlüssel in allen 15 Locales identisch vorhanden.
- **Routing korrekt:** `[...lang]`-Dynamic-Routing, Fallback auf Englisch, `getStaticPaths`.
- **State-Cleanups:** Alle `useEffect`-Hooks haben korrekte Cleanup-Funktionen.
- **Async-Error-Handling:** Alle `async`-Funktionen korrekt mit try/catch.
- **`typeof document`-Guard:** In SSR-sensiblen `useEffect`-Blöcken vorhanden.
- **Event-Listener einmalig:** `{ once: true }` und `astro:page-load`-Cleanup in Navigation.

### Findings

#### BUG-1 — HOCH: Sakura — Active Skill unvollständig (fehlendes `levels`-Array)
**Datei:** `src/data/heroes.ts` Z. 1310–1315

```typescript
{
  name:     'Motorcycle Frenzy',
  category: 'Active Skill',
  type:     'active',
  effect:   'Increases damage (details coming soon).',  // ← Placeholder, kein levels-Array
}
```

**Problem:** Alle anderen Aktiv-Skills haben ein `levels`-Array mit 5+ Einträgen.
Diese Struktur weicht vom Schema ab und kann zu Render-Fehlern in `HeroGrid.tsx` führen.
**Fix:** `levels`-Array mit allen Stufen-Beschreibungen ergänzen.

#### BUG-2 — HOCH: Sakura — Nur 2 von 4 Skills definiert
**Datei:** `src/data/heroes.ts` Z. 1297–1316

Sakura hat nur 2 Skills. Alle S1-Helden haben 4 Skills:
1. Normal-Angriff-Boost ✓
2. Aktiv-Skill ✓
3. **Global Effect ← fehlt**
4. **Exclusive Talent (type: 'exclusive') ← fehlt**

**Fix:** Global Effect und Exclusive Talent zu Sakuras `skills`-Array hinzufügen.

#### BUG-3 — HOCH: Mia — Nur 3 von 4 Skills definiert
**Datei:** `src/data/heroes.ts` Z. 1062–1099

Mia hat nur 3 Skills — der Exclusive Talent (`type: 'exclusive'`, `stars: 4`) fehlt.
Vergleich: Oliveira (S1) und Scarlett (S1) haben jeweils 4 vollständige Skills.
**Fix:** Exclusive Talent mit `type: 'exclusive'` und `stars: 4` ergänzen.

#### ~~BUG-4 — MITTEL: Research Tree — `nameKey`-Kollisionen bei Tier-2-Technologien~~ ✅ BEHOBEN
**Dateien:** `siege-to-seize.json`, `army-building.json`, `unit-special-training.json`

~~Tier-1 und Tier-2 Technologien teilten denselben `nameKey`~~

**Fix:**
- `siege-to-seize.json`: `demolition-crew-2`, `joint-operation-2`, `mobile-defense-2` → eigene `nameKey`
- `army-building.json`: `combat-policy-2` → eigener `nameKey` + neuer Key `research.army_building.combat-policy-2` in allen 15 Locales
- `unit-special-training.json`: `fire-up-2`, `armor-upgrade-2` → eigene `nameKey`
- Alle 5 übrigen `-2`-Keys existierten bereits in allen 15 Locales ✓

#### BUG-5 — MITTEL: Reward Codes — beide Codes abgelaufen (Daten-Freshness)
**Datei:** `src/data/reward-codes.json`

```json
{ "code": "GOLDBARMALL",  "expiresAt": "2026-02-08T23:59:59Z" }  // vor 14 Tagen
{ "code": "MONDAYBLESS",  "expiresAt": "2026-02-09T23:59:59Z" }  // vor 13 Tagen
```

**Kein Code-Bug** — `RewardCodesLocal.tsx` zeigt abgelaufene Codes korrekt in eigenem Bereich.
**Aktion:** Aktuelle Codes aus dem Spiel eintragen.

---

## 8. Cloudflare Config — Note: A-

**Geprüfte Dateien:** `public/_headers`, `astro.config.mjs`, `package.json`

### ✅ Positiv

- **`_headers` korrekt:** Alle Security-Header vorhanden (→ Security-Sektion).
- **Cache-Strategie optimal:** `/_astro/*` immutable 1 Jahr, HTML 1 Stunde, Bilder 30 Tage.
- **Kein wrangler.toml nötig** — Cloudflare Pages, kein Worker.
- **Build-Output `dist/`** korrekt konfiguriert.
- **Keine Node.js-APIs** in Browser-Code (kein `fs`, kein `path` im Client).
- **`typeof window`-Guards** vorhanden wo nötig.
- **ESM-Module:** `"type": "module"` in `package.json` — Cloudflare-kompatibel.

### Findings

#### CF-1 — NIEDRIG: `levelgeeks.org` in CSP img-src
Bereits als SEC-1 dokumentiert — auch Cloudflare-relevant.

#### CF-2 — NIEDRIG: Client-seitige Spracherkennung auf 404-Seite
**Datei:** `src/pages/404.astro` Z. 85–122
**Bewertung:** Funktioniert korrekt, aber ein Cloudflare Worker könnte dies serverseitig übernehmen
und damit JavaScript-Overhead auf der 404-Seite eliminieren.
**Empfehlung:** Optional — aktueller Ansatz ist ausreichend.

---

## Prioritäten-Matrix (Action Plan)

### ~~🔴 Sofort (Produktions-kritisch)~~ ✅ ALLE ERLEDIGT

| ID | Beschreibung | Status |
|----|-------------|--------|
| ~~PERF-1~~ | ~~`overflow: hidden` + `100vh` → CLS-Risiko~~ | ✅ `min-height: 100dvh`, kein overflow |
| ~~A11Y-1~~ | ~~Farb-Kontrast-Verstöße (WCAG 1.4.3)~~ | ✅ Alle auf 0.6+ Alpha erhöht |
| ~~SEC-1~~ | ~~`levelgeeks.org` aus CSP img-src entfernen~~ | ✅ Entfernt |

### 🟠 Hoch (nächster Sprint)

| ID | Beschreibung | Datei | Aufwand |
|----|-------------|-------|---------|
| BUG-1/2 | Sakura — fehlende Skills ergänzen (Inhalt) | `src/data/heroes.ts` | Spieldaten nötig |
| BUG-3 | Mia — Exclusive Talent ergänzen (Inhalt) | `src/data/heroes.ts` | Spieldaten nötig |
| ~~PERF-2~~ | ~~Tool-Cards: `hero.webp` Preload~~ | ENTFERNT (by design) |
| ~~PERF-3~~ | ~~`ApocalypseTimeClock client:load` → `client:idle`~~ | ✅ `client:idle` |
| ~~A11Y-2~~ | ~~`aria-label` auf Tool-Card-Links~~ | ✅ `aria-label={t(...)}` in allen 15 Sprachen |
| ~~CODE-1~~ | ~~Debug-`console.log` in `TankModificationTree`~~ | ✅ Entfernt |
| ~~SEO-1~~ | ~~`og:locale:alternate` `.slice(0, 5)` entfernen~~ | ✅ Alle 14 Locales ausgegeben |
| ~~A11Y-3~~ | ~~`focus-visible` auf Tool-Cards~~ | ✅ `outline: 2px solid #ffa500` |

### 🟡 Mittel (Backlog)

| ID | Beschreibung | Datei | Aufwand |
|----|-------------|-------|---------|
| ~~BUG-4~~ | ~~Research-Tree `nameKey`-Kollisionen~~ | ✅ 6 JSON-Nodes + `combat-policy-2` in 15 Locales |
| CODE-2 | Zoom-Logic in Custom Hook extrahieren | offen — zu viele Unterschiede für sicheres Refactoring |
| ~~A11Y-3~~ | ~~`focus-visible` auf Tool-Cards~~ | ✅ erledigt |
| ~~A11Y-4~~ | ~~Arrow-Key-Navigation Sprachdropdown~~ | ✅ `ArrowUp/Down/Home/End/Escape` |
| ~~SEO-2~~ | ~~Members-Description übersetzen~~ | ✅ `t('seo.members.description')` |

### 🟢 Niedrig (Nice-to-Have)

| ID | Beschreibung | Aufwand | Status |
|----|-------------|---------|--------|
| ~~DEAD-1~~ | ~~4 ungenutzte Utility-Funktionen entfernen~~ | ~~15 min~~ | ✅ erledigt |
| ~~CODE-3~~ | ~~Breakpoint `768` als Konstante zentralisieren~~ | ~~15 min~~ | ✅ erledigt |
| ~~SEC-2~~ | ~~`astro` updaten (transitive `devalue`-Schwachstelle)~~ | ~~5 min~~ | ✅ Astro 5.17.3 |
| BUG-5 | Aktuelle Reward Codes eintragen | laufend | Spieldaten nötig |
| CF-2 | Optional: Cloudflare Worker für 404-Redirect | 2–3 h | offen |
| CODE-4 | Error-Tracking-Service (Sentry) integrieren | 4–8 h | offen |

---

## Inhalts-Lücken (kein Code-Bug — Spieldaten nötig)

Diese Punkte erfordern das Sammeln von Spieldaten, keine Code-Änderungen:

- **10 Helden ohne Skills:** Amber, Alma, Bella, Dodomeki, Harleyna, Licia, Liliana, Nyx, Queenie, Yu Chan
- **34 von 36 Helden** ohne `description`-Feld
- **Research-Icons** fehlen für mehrere Kategorien (army-building, hero-training, military-strategies,
  peace-shield, siege-to-seize, fully-armed-alliance sowie Teile von field und unit-special-training)
- **Reward Codes** — aktuell beide abgelaufen (BUG-5)

---

*Audit erstellt von 5 parallelen Senior-Agenten am 22. Februar 2026.*
*Alle Findings wurden durch direktes Lesen der Quelldateien verifiziert — keine Vermutungen.*

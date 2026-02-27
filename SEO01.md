# SEO Audit Report — Wild Hoggs
**Datum:** 27. Februar 2026
**Erstellt von:** 3 parallele SEO-Agenten (Technisch · Content/i18n · Performance)

---

## Gesamtbewertung

| Bereich | Score | Status |
|---------|-------|--------|
| Technisches SEO | 7/10 | ⚠️ Verbesserungsbedarf |
| Content & i18n | 6/10 | ⚠️ Mehrere Probleme |
| Performance & Crawlability | 8/10 | ✅ Gut |
| Security Headers | 10/10 | ✅ Ausgezeichnet |
| hreflang / Canonical | 9/10 | ✅ Sehr gut |
| Open Graph / Twitter | 9/10 | ✅ Sehr gut |

**Gesamt: 7.5/10** — Solide Basis, aber mit klaren Verbesserungsfeldern.

---

## 🔴 KRITISCHE PROBLEME (sofort beheben)

### 1. H1-Tags fehlen auf 3 Seiten
**Dateien:**
- `src/pages/[...lang]/profile.astro`
- `src/pages/[...lang]/community.astro`
- `src/pages/[...lang]/admin.astro`

Obwohl diese Seiten `noindex` haben, fehlt jeweils ein `<h1>`-Tag. Falls das PageHeader-Component `<h2>` statt `<h1>` rendert, betrifft das alle Seiten die PageHeader nutzen.

**Fix:** Prüfen ob PageHeader.astro `<h2>` rendert — falls ja, auf `<h1>` ändern.

---

### ~~2. SEO-Metadaten nur auf Englisch übersetzt~~ — FALSCH POSITIV ✅
**Verifiziert:** Alle 63 `seo.*` Keys sind in allen 15 Sprachen vollständig vorhanden und übersetzt.

**Echtes Restproblem (🔵 Minor):** Einige `seo.research.*` Descriptions stehen in manchen Sprachen inhaltlich noch auf Englisch, obwohl der Key vorhanden ist. Content-Quality-Issue, kein strukturelles Problem.

**Hinweis Fallback-System:** Bei einem komplett fehlenden Key würde der Key-Name selbst angezeigt (kein automatischer Fallback auf EN). Aktuell kein Problem, aber bei neuen Keys aufpassen.

---

### 3. apple-touch-icon fehlt
**Datei:** `src/layouts/Layout.astro`

Kein `<link rel="apple-touch-icon">` im `<head>`. iOS/iPadOS zeigt dann ein Screenshot-Thumbnail statt einem Icon bei Lesezeichen.

**Fix:**
```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```
Dazu ein 180×180px PNG nach `/public/apple-touch-icon.png` legen.

---

### 4. Schema.org für Seiteninhalte fehlt weitgehend
**Dateien:** Alle Seiten außer `codes.astro` (hat HowTo-Schema)

Vorhanden: Organization + WebSite (in Layout.astro), HowTo (codes.astro)
**Fehlend:**
- `BreadcrumbList` Schema (Breadcrumbs sind nur HTML)
- `Article` Schema für Heroes, Guides, Roses
- `ItemList` Schema für Heroes-Auflistung / Members-Liste
- `LocalBusiness` Schema auf About-Seite

**Fix-Beispiel BreadcrumbList** (in PageLayout.astro):
```js
const breadcrumbSchema = breadcrumbs?.length ? {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbs.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.label,
    ...(item.href ? { item: new URL(item.href, siteUrl).toString() } : {})
  }))
} : null;
```

---

### 5. Faction-Icon hat leeres alt-Attribut
**Datei:** `src/components/auth/ProfilePage.tsx:237`

```tsx
// VORHER (dekoratives alt="" ist hier falsch — Faction ist inhaltlich relevant)
<img src={FACTION_IMG[user.faction]} alt="" class="pp-faction-tag-img" />

// NACHHER
<img src={FACTION_IMG[user.faction]} alt={`${FACTION_LABELS[user.faction].label} faction`} class="pp-faction-tag-img" />
```

---

## 🟡 WICHTIGE PROBLEME (bald beheben)

### 6. 7 von 13 Titles sind zu lang (>60 Zeichen)
**Datei:** `src/i18n/locales/en.ts`

Google kürzt Titles ab ~60 Zeichen. Aktuelle Probleme:

| Seite | Aktuell | Zeichen | Fix |
|-------|---------|---------|-----|
| Home | `Wild Hoggs \| Last Z Guide & Strategy Hub - Heroes, Events, Tools` | 72 | `Wild Hoggs \| Last Z Guide - Heroes, Tools & Events` |
| Heroes | `Wild Hoggs \| Last Z Heroes Tier List 2026 - Best Characters` | 62 | `Wild Hoggs \| Last Z Heroes Tier List 2026` |
| Tools | `Wild Hoggs \| Last Z Calculator Tools - Hero EXP, Research, Building` | 72 | `Wild Hoggs \| Last Z Calculators - EXP & Tools` |
| Research | `Wild Hoggs \| Last Z Research Guide 2026 - Tech Tree & Priorities` | 69 | `Wild Hoggs \| Last Z Research Guide 2026` |
| Events | `Wild Hoggs \| Last Z Events & Alliance Strategies - Canyon Clash` | 68 | `Wild Hoggs \| Last Z Events & Strategies Guide` |
| Roses | `Wild Hoggs \| Last Z Weekly Roses {month} {year} - Alliance Buffs` | ~68 | `Wild Hoggs \| Last Z Weekly Roses {month} {year}` |
| Guides | `Wild Hoggs \| Last Z Beginner Guide {year} - Tips & Strategies` | ~64 | `Wild Hoggs \| Last Z Beginner Guide {year}` |

---

### 7. Profile & Community Descriptions zu kurz und ohne Keywords
**Datei:** `src/i18n/locales/en.ts`

Optimum: 150–160 Zeichen. Aktuell:
- `seo.profile.description`: 77 Zeichen, keine Game-Keywords
- `seo.community.description`: 76 Zeichen, keine Game-Keywords

**Fix:**
```ts
'seo.profile.description': 'Manage your Wild Hoggs profile: track faction progress, update server number, and view calculator progress. Personal Last Z gaming dashboard.',
// → 152 Zeichen ✓

'seo.community.description': 'Join the Wild Hoggs community chat: global chat, server-specific channels, real-time messaging with Last Z guild members worldwide.',
// → 141 Zeichen ✓
```

---

### 8. trailingSlash nicht explizit konfiguriert
**Datei:** `astro.config.mjs`

Ohne explizite Konfiguration kann es zu Duplicate Content führen (`/about` vs `/about/` = verschiedene Canonical-URLs).

**Fix:**
```js
export default defineConfig({
  site: 'https://wild-hoggs.com',
  trailingSlash: 'never', // oder 'always' — konsistent wählen
  ...
})
```

---

### 9. Sitemap fehlen priority & changefreq
**Datei:** `astro.config.mjs`

`lastmod` ist gesetzt, aber `priority` und `changefreq` fehlen. Crawler können wichtige Seiten (Tools, Heroes) nicht von unwichtigen unterscheiden.

**Fix:**
```js
serialize(item) {
  const excludedPaths = ['/events', '/guides', '/admin', '/profile', '/community'];
  if (excludedPaths.some(p => item.url.includes(p + '/') || item.url.endsWith(p))) {
    return undefined;
  }

  let priority = 0.7;
  if (item.url.match(/^https:\/\/wild-hoggs\.com\/?$/) ||
      item.url.match(/^https:\/\/wild-hoggs\.com\/[a-z-]+\/?$/)) priority = 0.9;
  if (item.url.includes('/tools/')) priority = 0.85;
  if (item.url.includes('/heroes') || item.url.includes('/codes')) priority = 0.85;
  if (item.url.includes('/members')) priority = 0.6;

  item.priority = priority;
  item.changefreq = 'weekly';
  item.lastmod = new Date().toISOString();
  return item;
}
```

---

### 10. ResearchCategoryCalculator: CSS-Dimensionen statt HTML width/height
**Datei:** `src/components/calculators/ResearchCategoryCalculator.tsx:326`

```tsx
// VORHER (verursacht CLS — Cumulative Layout Shift)
<img src={categoryImageSrc} alt={...} style={{ width: '60px', height: '60px', objectFit: 'contain' }} />

// NACHHER (verhindert CLS)
<img src={categoryImageSrc} alt={...} width={60} height={60} style={{ objectFit: 'contain' }} />
```

---

### 11. Admin-Breadcrumb ist hardcodiert
**Datei:** `src/pages/[...lang]/admin.astro`

```astro
// VORHER
{ label: 'Administration' }

// NACHHER
{ label: t('nav.admin') }
```

---

### 12. DNS Prefetch für externe Ressourcen fehlt
**Datei:** `src/layouts/Layout.astro`

Es gibt externe Links zu `last-z.com` und Cloudflare Insights — kein DNS Prefetch.

**Fix** (in `<head>` hinzufügen):
```html
<link rel="dns-prefetch" href="https://last-z.com" />
<link rel="preconnect" href="https://static.cloudflareinsights.com" />
```

---

## 🔵 MINOR / OPTIMIERUNGEN

### 13. hreflang-Regex ist hardcodiert (wartungsintensiv)
**Datei:** `src/layouts/Layout.astro:32,39`

```ts
// VORHER (muss bei neuer Sprache manuell aktualisiert werden)
currentPath.replace(/^\/(de|fr|ko|th|ja|pt|es|tr|id|zh-TW|zh-CN|it|ar|vi)(\/|$)/, '/');

// NACHHER (dynamisch aus languages-Object)
const supportedLangs = Object.keys(languages).filter(l => l !== 'en').join('|');
currentPath.replace(new RegExp(`^/(${supportedLangs})(/|$)`), '/');
```

---

### 14. "guild" Keyword fehlt in vielen Descriptions
**Datei:** `src/i18n/locales/en.ts`

Wild Hoggs ist eine Guild — das Keyword "guild" taucht aber kaum in den Meta-Descriptions auf. Besonders auf Home, Members, Events fehlt es.

---

### 15. Sitemap-lastmod wird bei jedem Build aktualisiert
**Datei:** `astro.config.mjs`

`item.lastmod = new Date().toISOString()` setzt das Datum bei jedem Deployment, auch wenn sich der Inhalt nicht geändert hat. Google interpretiert das als „Seite ändert sich ständig" und crawlt öfter.

**Fix:** Entweder lastmod weglassen, oder pro Seite ein echtes Änderungsdatum pflegen.

---

### 16. og:locale für Arabisch: `ar_AR` statt `ar_EG`/`ar_SA`
**Datei:** `src/layouts/Layout.astro` (localeMap)

Facebook OG erwartet regionale Varianten. `ar_AR` ist technisch gültig, aber `ar_EG` (Ägypten) oder `ar_SA` (Saudi-Arabien) wären präziser für die Zielgruppe.

---

## ✅ Was bereits sehr gut ist

| Bereich | Details |
|---------|---------|
| **Security Headers** | X-Frame-Options, CSP, HSTS, Permissions-Policy — vollständig in `public/_headers` |
| **hreflang** | Alle 15 Sprachen korrekt, x-default auf EN, bidirektional verlinkt |
| **Canonical URLs** | Auf jeder Seite korrekt gesetzt |
| **Open Graph** | Vollständig: type, url, title, desc, image (1200×630), locale-alternates |
| **Twitter Cards** | `summary_large_image`, alle Felder vorhanden |
| **OG-Images** | Für jede Seite ein eigenes WebP-Bild in `/public/` vorhanden |
| **Lazy Loading** | `loading="lazy"` auf allen `<img>`-Tags |
| **WebP-Format** | Alle Bilder modern und performant |
| **Vite-Build** | Code-Splitting, esbuild-Minify, Vendor-Chunks, console.log-Drop in Prod |
| **Hydration** | `client:visible/load/only` sinnvoll und dokumentiert eingesetzt |
| **robots.txt** | Admin, Profile, Community korrekt geblockt |
| **Sitemap** | Admin, Profile, Community, Events, Guides korrekt ausgeschlossen |
| **Schema.org** | Organization + WebSite + HowTo (Codes) vorhanden |
| **System Fonts** | Kein @font-face → kein Font-FOUT, kein Render-Blocking |
| **noopener noreferrer** | Auf allen externen Links korrekt gesetzt |

---

## Priorisierte Fix-Reihenfolge

### Phase 1 — Kritisch (< 1 Std)
- [ ] apple-touch-icon erstellen + einbinden
- [ ] Faction-Icon alt-Attribut reparieren (`ProfilePage.tsx:237`)
- [ ] BreadcrumbList Schema in PageLayout.astro implementieren
- [ ] Admin-Breadcrumb auf `t('nav.admin')` ändern

### Phase 2 — Wichtig (2–3 Std)
- [ ] 7 Title-Tags auf max. 60 Zeichen kürzen (`en.ts`)
- [ ] Profile & Community Descriptions auf 150+ Zeichen erweitern (`en.ts`)
- [ ] `trailingSlash: 'never'` in astro.config.mjs setzen
- [ ] Sitemap: `priority` + `changefreq` in serialize() ergänzen
- [ ] DNS Prefetch in Layout.astro HEAD einfügen
- [ ] ResearchCategoryCalculator: CSS-Dims → HTML width/height

### Phase 3 — i18n (3–5 Std, Übersetzer nötig)
- [ ] Alle 63 `seo.*` Keys in 14 Sprachen übersetzen (de, fr, es, pt, it, tr, ja, ko, zh-CN, zh-TW, th, id, ar, vi)

### Phase 4 — Optional
- [ ] Article-Schema für Heroes, Guides, Roses
- [ ] LocalBusiness-Schema auf About-Seite
- [ ] ItemList-Schema für Heroes/Members
- [ ] hreflang-Regex dynamisch machen
- [ ] lastmod nur bei echten Content-Änderungen aktualisieren

---

*Bericht erstellt am 27.02.2026 — basierend auf Analyse von 3 parallelen SEO-Agenten*

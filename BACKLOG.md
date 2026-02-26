# BACKLOG.md — Wild Hoggs Niedrig-Priorität Aufgaben

**Erstellt:** 2026-02-26
**Basis:** AUDIT_SENIOR34.md — Backlog-Sektion

---

## Übersicht

| #   | Kategorie     | Aufgabe                        | Aufwand | Impact  |
|-----|---------------|--------------------------------|---------|---------|
| B1  | SEO           | Sitemap priority-Werte         | Klein   | Niedrig |
| B2  | SEO           | Strukturierte Daten            | Mittel  | Mittel  |
| B3  | SEO           | Members Meta-Description       | Klein   | Niedrig |
| B4  | Performance   | Hero-Daten aufteilen           | Groß    | Mittel  |
| B5  | Accessibility | Navigation aria-label          | Klein   | Niedrig |
| B6  | Accessibility | Modal aria-live                | Klein   | Niedrig |
| B7  | Code Quality  | Inline-Styles auslagern        | Mittel  | Niedrig |
| B8  | Code Quality  | Magic Strings                  | Klein   | Niedrig |
| B9  | Cloudflare    | Web Analytics                  | Klein   | Mittel  |
| B10 | Cloudflare    | Permissions-Policy             | Klein   | Niedrig |
| B11 | Dead Code     | Hero-Daten vervollständigen    | Groß    | Mittel  |

---

## Detailbeschreibungen

---

### B1 — SEO: Sitemap priority-Werte hinzufügen
**Datei:** `astro.config.mjs` (Zeilen 17–54)

**Was ist das Problem?**

Die `serialize()` Funktion in `astro.config.mjs` fügt bereits `<lastmod>` Tags in die Sitemap ein
und schließt Placeholder-Seiten (`/events`, `/guides`) aus. Es werden jedoch keine `<priority>`-Werte
gesetzt. Dadurch behandelt Google alle Seiten als gleichwertig (Default-Priorität: 0.5), was bedeutet,
dass wichtige Seiten wie die Homepage oder die Hero-Tier-List nicht bevorzugt gecrawlt werden.

Aktuell sieht die `serialize()` Funktion so aus:

```js
serialize(item) {
  const placeholderPages = ['/events', '/guides'];
  const isPlaceholder = placeholderPages.some(page =>
    item.url.includes(page + '/') || item.url.endsWith(page)
  );
  if (isPlaceholder) { return undefined; }
  item.lastmod = new Date().toISOString();
  return item;
}
```

Es fehlt eine `priority`-Zuweisung basierend auf dem URL-Muster.

**Empfohlene priority-Werte:**
- `1.0` — Homepage (`/`, `/de/`, `/fr/`, etc.)
- `0.9` — Hero-Seite (`/heroes/`), Codes-Seite (`/codes/`)
- `0.8` — Tools-Übersichtsseite (`/tools/`), Roses (`/roses/`)
- `0.7` — Einzelne Tool-Seiten (`/tools/hero-exp/`, `/tools/tank/`, etc.)
- `0.5` — Members, About Us (weniger SEO-relevant, da guild-intern)

**Vorteile (Positiv):**
- Crawl-Budget effizienter nutzen: Google crawlt wichtige Seiten häufiger
- Höherwertige Seiten (Hero Tier List, Codes) erscheinen tendenziell schneller in den Suchergebnissen
- Minimaler Implementierungsaufwand, da `serialize()` bereits vorhanden ist

**Nachteile / Risiken (Negativ):**
- Google ignoriert `<priority>` offiziell seit Jahren — es ist ein Hinweis, keine Garantie
- Falsch gesetzte Prioritäten (z. B. alle auf 1.0) können das Signal entwerten
- Kein messbarer SEO-Impact auf Rankings, nur auf Crawling-Frequenz

**Aufwand:** Klein (ca. 15 Minuten — ein `if/else` Block in der bestehenden `serialize()` Funktion)
**Impact:** Niedrig (Google ignoriert priority weitgehend, aber schadet nicht)
**Empfehlung:** Umsetzen beim nächsten regulären Maintenance-Slot. Kein eigenes Sprint-Item nötig.

---

### B2 — SEO: Strukturierte Daten (Collection, SoftwareApplication) auf Content-Seiten
**Dateien:** `src/pages/[...lang]/heroes.astro`, `src/pages/[...lang]/tools.astro`, `src/layouts/Layout.astro`

**Was ist das Problem?**

**heroes.astro** (Zeilen 1–35): Kein seitenspezifisches JSON-LD. Die Seite rendert den `HeroGrid`
und übergibt `title`/`description` ans Layout, aber enthält kein `ItemList`- oder `CollectionPage`-Schema.

**codes.astro** (Zeilen 26–53): Hat bereits ein vollständiges `HowTo`-Schema mit den 3 Einlöseschritten.
Gut implementiert.

**tools.astro** (Zeilen 1–77): Kein JSON-LD. Fünf Tool-Karten werden gerendert ohne strukturierte Daten.
Das Layout fügt global `Organization` und `WebSite` JSON-LD ein (Layout.astro Zeilen 182–183), aber kein
`SoftwareApplication`-Schema pro Tool.

**Fehlende Schemas nach Seite:**

| Seite           | Fehlendes Schema                              | Nutzen                                          |
|-----------------|-----------------------------------------------|-------------------------------------------------|
| `/heroes/`      | `ItemList` + `CollectionPage`                 | Rich Results für Hero-Listen in der Suche        |
| `/tools/`       | `ItemList` von `SoftwareApplication`-Einträgen | Google versteht, dass es sich um Tools handelt  |
| `/tools/hero-exp/` etc. | `SoftwareApplication`               | Kann als "Web App" in Suchergebnissen erscheinen |

**Vorteile (Positiv):**
- `ItemList` + `CollectionPage` auf der Heroes-Seite kann zu Rich Results (Karussells) führen
- `SoftwareApplication` auf den Tool-Seiten signalisiert Google den Zweck der Seite
- Codes-Seite zeigt, dass HowTo-Schema bereits funktioniert — das Muster ist im Team bekannt

**Nachteile / Risiken (Negativ):**
- JSON-LD muss serverseitig befüllt werden (Astro-Frontmatter), kein reines Copy-Paste
- Heroes-ItemList müsste aus `heroes.ts` befüllt werden — da 36 Einträge, erhöht das den HTML-Output
- Rich Results sind nicht garantiert; Google entscheidet selbst über deren Anzeige
- Falsch implementiertes Schema kann zu Search Console-Fehlern führen

**Aufwand:** Mittel (2–3 Stunden für alle drei Seiten inklusive Test in der Rich Results-Testsuite)
**Impact:** Mittel (Erhöhte CTR durch Rich Snippets möglich, besonders für die Heroes-Seite)
**Empfehlung:** Mit heroes.astro beginnen (größter Traffic), dann tools.astro. Validierung mit
`https://search.google.com/test/rich-results` nach Implementierung.

---

### B3 — SEO: Members Meta-Description auf 150+ Zeichen erweitern
**Datei:** `src/i18n/locales/en.ts` (Zeile 562)

**Was ist das Problem?**

Der aktuelle Wert von `seo.members.description`:
```
'Meet the Wild Hoggs guild members on Last Z Server 395. Active players, R5 N0TNUTT leadership, and growing community.'
```

Zeichenanzahl: **115 Zeichen** (ohne Anführungszeichen).

Google empfiehlt 150–160 Zeichen für Meta-Descriptions, da alles darunter als "zu kurz" gilt und
Suchmaschinen den Snippet dann selbst aus dem Seiteninhalt generieren (oft unkontrolliert).
Die Beschreibung enthält zwar relevante Keywords (`Last Z Server 395`, `N0TNUTT`), schöpft aber
das verfügbare Zeichenbudget nicht aus. Es fehlen Call-to-Action-Elemente und mehr Kontext
(z. B. wie viele Mitglieder, welche Spielerniveaus).

**Vorschlag für erweiterte Description (158 Zeichen):**
```
Meet the Wild Hoggs guild members on Last Z Server 395. Active players of all levels, R5 N0TNUTT leadership, and a growing community ready to conquer.
```

**Vorteile (Positiv):**
- Höhere Wahrscheinlichkeit, dass Google den eigenen Snippet statt einen automatisch generierten anzeigt
- Mehr Kontext für Suchende, erhöht qualifizierten Traffic
- Minimaler Aufwand — nur ein einziger String ändern

**Nachteile / Risiken (Negativ):**
- Die Members-Seite hat generell niedrige externe SEO-Relevanz (guild-interner Content)
- Muss in allen 15 Lokalisierungsdateien angepasst werden, nicht nur in `en.ts`
- Impact auf Rankings praktisch null — nur der angezeigte Snippet ändert sich

**Aufwand:** Klein (15 Minuten für alle Sprachdateien, sofern alle ähnlich kurz sind)
**Impact:** Niedrig (nur Snippet-Darstellung, kein Ranking-Effekt)
**Empfehlung:** Im Rahmen einer i18n-Pflege-Session mitbehandeln.

---

### B4 — Performance: Hero-Daten aufteilen (58 KB heroes.ts)
**Dateien:** `src/data/heroes.ts`, `src/components/HeroGrid.tsx` (Zeile 4), `src/pages/[...lang]/heroes.astro` (Zeile 8)

**Was ist das Problem?**

`heroes.ts` hat eine Dateigröße von **58.827 Bytes (ca. 57,5 KB)**. Die gesamte Datei wird in
`heroes.astro` als `import { heroes } from '../../data/heroes'` geladen und direkt als
`heroes`-Prop an `<HeroGrid heroes={heroes} client:visible />` übergeben.

Das bedeutet, die **gesamten Daten für alle 36 Heroes** — inklusive vollständiger Skill-Beschreibungen,
Level-by-Level-Texte, Kategoriebezeichnungen und optionaler Felder — werden beim ersten Seitenaufruf
in das JavaScript-Bundle gebündelt und an den Client übertragen. Die Grid-Ansicht selbst zeigt jedoch
nur wenige Felder pro Hero-Karte an: `name`, `image`, `rarity`, `faction`, `role`, `skills.length`.

Die vollständigen Skill-Daten werden erst im Modal (`HeroModal` Komponente, Zeile 90–181 in HeroGrid.tsx)
benötigt, also erst wenn der Nutzer auf eine Karte klickt.

**Aktueller Datenfluss:**
```
heroes.ts (58 KB) → heroes.astro → HeroGrid prop → gesamtes Bundle → Client
```

**Optimierter Datenfluss (nach Split):**
```
heroes-list.ts (ca. 8 KB, nur Felder für Grid-Karten) → HeroGrid → Client
heroes-detail.ts (ca. 50 KB, Skill-Daten) → on-demand fetch nach Klick
```

**Vorteile (Positiv):**
- Reduziert das initiale JavaScript-Bundle um ca. 50 KB
- Verbessert Time-to-Interactive auf der Heroes-Seite, besonders auf mobilen Gerägen
- Skill-Daten werden nur geladen, wenn der Nutzer ein Hero-Modal öffnet (lazy loading)

**Nachteile / Risiken (Negativ):**
- Erheblicher Refactoring-Aufwand: `heroes.ts` aufteilen, `HeroGrid.tsx` anpassen, API-Route oder
  dynamischen Import für Detail-Daten implementieren
- Bei 36 Heroes und ca. 10 Helden mit vollständigen Skills ist der tatsächliche Payload-Unterschied
  geringer als bei 100+ Heroes — relativierter Impact
- `client:visible` in heroes.astro bedeutet, dass der initiale Bundle bereits lazy geladen wird.
  Der reale Vorteil hängt davon ab, wann `client:visible` feuert
- Risiko von Regressions im Modal (Skill-Accordion, Focus-Management) durch den Refactor
- Astro SSG mit statischen Importen ist einfacher zu debuggen als dynamische Fetches

**Aufwand:** Groß (4–8 Stunden: Daten-Split, neue API/Endpunkt, HeroGrid.tsx refactoring, Tests)
**Impact:** Mittel (relevante Verbesserung wenn hero-Zahl auf 50+ wächst; bei 36 Heroes marginal)
**Empfehlung:** Aufgabe zurückstellen bis Heldendatenbank auf 50+ Heroes anwächst. Dann lohnt sich der Split merklich mehr.

---

### B5 — Accessibility: Main Navigation aria-label fehlt
**Datei:** `src/components/Navigation.astro` (Zeile 37)

**Was ist das Problem?**

Das Haupt-Navigations-Element ist wie folgt definiert:
```html
<nav class="navigation">
```

Es fehlt ein `aria-label`-Attribut. WCAG 2.1 Erfolgskriterium 1.3.6 / ARIA-Best-Practice empfiehlt,
dass `<nav>`-Elemente ein Label erhalten, wenn eine Seite mehrere Navigationsbereiche enthält.

Im Projekt gibt es tatsächlich mehrere Nav-Bereiche:
- `<nav class="navigation">` — Hauptnavigation (Navigation.astro)
- Breadcrumbs (vermutlich in PageLayout/Breadcrumbs-Komponente) enthalten ebenfalls einen
  Navigationswrapper

Ohne `aria-label` können Screenreader-Nutzer nicht unterscheiden, welche Navigation die Hauptnavigation
ist und welche die Breadcrumb-Navigation.

**Fix:**
```html
<nav class="navigation" aria-label="Main navigation">
```

Oder lokalisiert (da die Seite 15 Sprachen unterstützt):
```html
<nav class="navigation" aria-label={t('nav.ariaLabel')}>
```

**Vorteile (Positiv):**
- Screenreader (NVDA, JAWS, VoiceOver) benennen die Navigation korrekt beim Springen zwischen
  Landmarks
- Minimaler Implementierungsaufwand: ein Attribut in einer Datei
- Verbessert WCAG 2.1 AA Compliance (Landmark Regions)

**Nachteile / Risiken (Negativ):**
- Bei einem englisch-only Label (`aria-label="Main navigation"`) ist der Wert für nicht-englische
  Sprachversionen falsch — erfordert dann einen i18n-String in allen 15 Lokalisierungsdateien
- Kein visueller Impact

**Aufwand:** Klein (5–30 Minuten je nach Entscheidung englisch-only vs. lokalisiert)
**Impact:** Niedrig (verbessert Accessibility nur für Screenreader-Nutzer)
**Empfehlung:** Quick Win — beim nächsten Accessibility-Durchgang als Ein-Zeiler umsetzen. Englisches Label
ist für die meisten Screenreader-Nutzer ausreichend.

---

### B6 — Accessibility: Modal role="alertdialog" oder aria-live prüfen
**Datei:** `src/components/HeroGrid.tsx` (Zeilen 90–181, `HeroModal` Komponente)

**Was ist das Problem?**

Das Hero-Modal ist korrekt mit `role="dialog"` und `aria-modal="true"` implementiert:
```tsx
<div
  className="hg-split"
  role="dialog"
  aria-modal="true"
  aria-labelledby="hg-hero-modal-title"
  ref={dialogRef}
  onClick={(e) => e.stopPropagation()}
>
```

Das Fokus-Management ist ebenfalls vorhanden (Zeilen 93–121): Fokus wird beim Öffnen auf das erste
fokussierbare Element gesetzt, Tab-Trapping ist implementiert, und beim Schließen kehrt der Fokus
zum vorherigen Element zurück.

**Was fehlt:**

1. **`aria-describedby`**: Das Modal hat `aria-labelledby="hg-hero-modal-title"` (der Hero-Name),
   aber kein `aria-describedby`. Die Hero-Description (`hero.description`) wäre ein guter Kandidat
   für `aria-describedby`, wenn sie vorhanden ist. Das hilft Screenreader-Nutzern, sofort den
   Kontext zu erfassen.

2. **`role="alertdialog"` vs. `role="dialog"`**: Der aktuelle `role="dialog"` ist korrekt für
   nicht-kritische Dialoge. `role="alertdialog"` wäre nur angemessen für Bestätigungs- oder
   Fehlerdialoge. Diese Rolle ist also absichtlich oder versehentlich korrekt — kein Handlungsbedarf.

3. **`aria-live` auf dem Grid-Counter**: Der Count-Bereich in HeroGrid.tsx Zeile 362 hat bereits
   `aria-live="polite"` und `aria-atomic="true"`:
   ```tsx
   <p className="hg-count" aria-live="polite" aria-atomic="true">
     {filtered.length} / {heroes.length} heroes
   </p>
   ```
   Das ist korrekt implementiert.

**Vorteile (Positiv):**
- `aria-describedby` auf dem Modal verbessert die Screenreader-Experience bei Heroes mit vorhandener Description
- Das bestehende Focus-Management ist solide — kein strukturelles Problem

**Nachteile / Risiken (Negativ):**
- 34 von 36 Heroes haben aktuell `description: ''` (leer), sodass `aria-describedby` für die meisten
  Heroes keinen Inhalt hätte — erst nach B11 (Hero-Daten vervollständigen) sinnvoll
- Minimaler Nutzen solange Beschreibungen fehlen

**Aufwand:** Klein (15 Minuten: ein bedingtes `aria-describedby`-Attribut)
**Impact:** Niedrig (nur wenn B11 vorher abgeschlossen ist)
**Empfehlung:** Gemeinsam mit B11 (Hero-Daten vervollständigen) umsetzen — erst wenn Description-Felder
befüllt sind, entfaltet das `aria-describedby` Wirkung.

---

### B7 — Code Quality: Inline-Styles in Calculator-Komponenten auslagern
**Dateien:** `src/components/calculators/TankCalculator.tsx`, `src/components/calculators/ResearchCategoryCalculator.tsx`
**Vorhandene CSS-Dateien:** `src/components/calculators/Calculator.css`, `src/components/calculators/CaravanCalculator.css`

**Was ist das Problem?**

Inline-Styles (`style={{ ... }}`) sind in beiden Calculator-Komponenten weit verbreitet:
- **TankCalculator.tsx**: 33 Vorkommen von `style={{ ... }}`
- **ResearchCategoryCalculator.tsx**: 22 Vorkommen von `style={{ ... }}`

Beispiele aus TankCalculator.tsx:
```tsx
<div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', minHeight: 0 }}>
<span style={{ marginLeft: '0.5rem', color: remainingWrenches < 0 ? '#e74c3c' : '#52be80' }}>
<div style={{ fontWeight: 'bold', color: '#ffa500', whiteSpace: 'nowrap' }}>
```

Beispiele aus ResearchCategoryCalculator.tsx:
```tsx
<h3 style={{ margin: '0 0 0.5rem 0', color: '#ffa500' }}>{t(category.nameKey as TranslationKey)}</h3>
<div style={{ fontSize: '1.2rem', fontWeight: 700, color: calculatedResults.totalBadges > 0 ? '#ffa500' : 'rgba(255,255,255,0.5)' }}>
```

Während `CaravanCalculator.tsx` bereits eine dedizierte `CaravanCalculator.css` nutzt, haben
`TankCalculator.tsx` und `ResearchCategoryCalculator.tsx` keine eigenen CSS-Dateien. Sie importieren
`Calculator.css` (Basis-Stile), aber alle komponentenspezifischen Stile stecken als Inline-Styles
direkt im JSX.

**Probleme mit dem Ist-Zustand:**
1. Kein Theming möglich — Farben wie `#ffa500`, `#e74c3c`, `#52be80` sind hartcodiert, statt
   CSS-Custom-Properties (`var(--color-primary)`) zu nutzen
2. Schlechte Performance: Inline-Styles erzeugen bei jedem Re-Render neue Objekte
3. Kein Media-Query-Support in Inline-Styles — responsive Anpassungen sind unmöglich
4. Wartbarkeit leidet: Design-Änderungen erfordern TypeScript-Dateien zu bearbeiten statt CSS

**Vorteile (Positiv):**
- Konsolidierung auf `Calculator.css` oder neue `TankCalculator.css` / `ResearchCalculator.css`
- CSS-Custom-Properties können Design-Tokens aus `design-tokens.css` nutzen
- Verbesserte Performance durch CSS-Klassen statt Inline-Objekte

**Nachteile / Risiken (Negativ):**
- Einige Inline-Styles sind dynamisch (z. B. Farbe abhängig von Zahlenwert) — diese müssen als
  CSS-Klassen mit Modifikatoren oder `data-*`-Attributen umgebaut werden
- 55 Stellen gesamt — mittlerer Aufwand ohne funktionalen Mehrwert für den Nutzer
- Risiko visueller Regressionen bei falscher CSS-Spezifität

**Aufwand:** Mittel (3–4 Stunden für beide Dateien mit manuellem Test)
**Impact:** Niedrig (nur Entwickler-Experience und Wartbarkeit, kein User-sichtbarer Unterschied)
**Empfehlung:** Bei einem dedizierten Code-Quality-Sprint oder wenn eine Calculator-Komponente
ohnehin refactored wird mitbehandeln.

---

### B8 — Code Quality: Magic Strings (Gender-Order, Faction-Keys)
**Dateien:** `src/components/MembersList.tsx` (Zeile 51), `src/components/calculators/CaravanCalculator.tsx` (Zeilen 14–24)

**Was ist das Problem?**

**MembersList.tsx (Zeile 51):**
```tsx
const GENDER_ORDER: Record<string, number> = { '♀': 0, '♂': 1, '–': 2 };
```
Die Sonderzeichen `'♀'`, `'♂'` und `'–'` sind Magic Strings. Sie müssen exakt mit den Werten in der
`members`-Daten übereinstimmen. Es gibt kein zentrales `GENDER`-Enum oder `const`-Objekt, das diese
Werte definiert.

**CaravanCalculator.tsx (Zeilen 14–24):**
```tsx
const FACTION_HERO: Record<HeroFaction, { name: string; buffKey: string }> = {
  'wings-of-dawn':  { name: 'Laura',   buffKey: 'ATK' },
  'blood-rose':     { name: 'Katrina', buffKey: 'DEF' },
  'guard-of-order': { name: 'Chicha',  buffKey: 'DMG' },
};

const FACTION_ICON: Record<HeroFaction, string> = {
  'blood-rose':     '/images/heroes/symbols/blood-rose.webp',
  'wings-of-dawn':  '/images/heroes/symbols/wings-of-dawn.webp',
  'guard-of-order': '/images/heroes/symbols/guard-of-order.webp',
};
```
Die Faction-Keys `'wings-of-dawn'`, `'blood-rose'`, `'guard-of-order'` werden hier als direkte
String-Literale verwendet. Diese Keys sind bereits in `src/data/heroes.ts` als `HeroFaction`-Typ
definiert — aber in der CaravanCalculator-Komponente sind sie nicht über eine typsichere Konstante
referenziert, sondern direkt als String-Literale eingetragen.

**Vorteile eines Refactors (Positiv):**
- Typsicherheit: Ein zentrales `GENDER_VALUES` oder `FACTION_KEYS` Objekt verhindert Tipp-Fehler
- Bei Umbenennung eines Faction-Keys muss nur eine Stelle geändert werden
- Konsistenz mit dem `HeroFaction`-Typ aus heroes.ts

**Nachteile / Risiken (Negativ):**
- TypeScript schützt bereits über den `HeroFaction`-Typ vor falschen Keys in `Record<HeroFaction, ...>`
- Die Gender-Zeichen sind Unicode-Literale — ein Enum darüber bringt wenig Mehrwert
- Kein funktionaler Unterschied, rein kosmetischer Refactor
- P12 hat bereits Teile dieser Magic-String-Problematik behoben — Restbestand ist minimal

**Aufwand:** Klein (30–45 Minuten für beide Dateien)
**Impact:** Niedrig (nur Code-Lesbarkeit, TypeScript fängt die meisten Fehler bereits ab)
**Empfehlung:** Bei nächster Änderung an MembersList.tsx oder CaravanCalculator.tsx mitbehandeln.
Kein eigenes Issue.

---

### B9 — Cloudflare: Web Analytics aktivieren
**Dateien:** `src/layouts/Layout.astro`, `public/_headers`

**Was ist das Problem?**

In `src/layouts/Layout.astro` gibt es **kein Analytics-Script** — weder Cloudflare Web Analytics,
noch Google Analytics, Plausible, Matomo oder ähnliche Tools. Die Suche nach `analytics`, `beacon`,
`gtag`, `plausible`, `zaraz` in Layout.astro liefert keine Treffer.

Auch in `public/_headers` sind keine analytics-bezogenen Einstellungen vorhanden.

Das bedeutet, es gibt **keine Daten** über:
- Welche Seiten am meisten besucht werden (Heroes? Tools? Codes?)
- Aus welchen Ländern die Besucher kommen (wichtig bei 15 Sprachen)
- Welche Such-Keywords Traffic bringen
- Bounce-Rate und Verweildauer

Cloudflare Web Analytics ist kostenlos für Cloudflare Pages und respektiert die DSGVO ohne Cookies
(pixel-basiert, keine PII-Speicherung).

**Implementierung wäre minimal:**
```html
<!-- In Layout.astro <head> -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js'
  data-cf-beacon='{"token": "DEIN_TOKEN"}'></script>
```

Zusätzlich müsste die CSP in `public/_headers` erweitert werden, da aktuell
`script-src 'self' 'unsafe-inline'` gilt — `static.cloudflareinsights.com` müsste dort ergänzt werden.

**Vorteile (Positiv):**
- Kostenlos, DSGVO-konform ohne Cookie-Banner (keine personenbezogenen Daten)
- Nativ in Cloudflare Dashboard integriert — kein separates Tool nötig
- Ermöglicht datengestützte Priorisierung zukünftiger Features (welche Tools werden genutzt?)

**Nachteile / Risiken (Negativ):**
- CSP-Header muss angepasst werden (`connect-src`, `script-src` erweitern)
- Cloudflare Analytics-Daten sind weniger granular als Google Analytics
- Für eine Guild-Seite mit überschaubarem Traffic ist der Informationsgewinn limitiert

**Aufwand:** Klein (30 Minuten: Token erstellen, Script einbinden, CSP anpassen)
**Impact:** Mittel (ermöglicht erstmals datengestützte Feature-Priorisierung)
**Empfehlung:** Hohe Umsetzbarkeit bei minimalem Risiko. Vor dem nächsten größeren Feature-Sprint
aktivieren, um Baseline-Daten zu sammeln.

---

### B10 — Cloudflare: Permissions-Policy erweitern
**Datei:** `public/_headers` (Zeile 11)

**Was ist das Problem?**

Der aktuelle `Permissions-Policy`-Header in `public/_headers`:
```
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()
```

Dies deaktiviert 6 Browser-Features. Es gibt weitere sensible Browser-APIs, die deaktiviert werden
könnten, da die Wild Hoggs Website keine davon benötigt:

**Fehlende Einschränkungen (Auswahl):**
- `interest-cohort=()` — deaktiviert Google FLoC / Privacy-Sandbox-Tracking
- `browsing-topics=()` — deaktiviert Topics API (Nachfolger von FLoC)
- `display-capture=()` — kein Screen-Sharing benötigt
- `fullscreen=()` — kein Fullscreen-API benötigt (außer Videos)
- `autoplay=()` — kein Autoplay benötigt
- `encrypted-media=()` — kein DRM benötigt
- `picture-in-picture=()` — kein PiP benötigt

**Vorteile (Positiv):**
- Stärkeres Privacy-Profil: verhindert, dass zukünftige Third-Party-Scripts (z. B. nach B9-Analytics)
  ungewollte Features nutzen
- `interest-cohort=()` ist besonders relevant — schützt Nutzer vor FLoC-Tracking
- Security Scanner (z. B. securityheaders.io) werten erweiterte Policies positiv

**Nachteile / Risiken (Negativ):**
- `fullscreen=()` könnte Hero-Bilder oder zukünftige Video-Embeds brechen
- Bestimmte Werte (z. B. `autoplay=()`) können unerwartete Nebeneffekte haben
- Änderungen müssen nach jedem Deploy getestet werden

**Aufwand:** Klein (15–30 Minuten: Header erweitern, Browser-Test)
**Impact:** Niedrig (marginale Security/Privacy-Verbesserung für eine statische Content-Seite)
**Empfehlung:** `interest-cohort=()` und `browsing-topics=()` sofort ergänzen (kein Risiko).
Restliche Features nach Prüfung auf tatsächliche Nutzung ergänzen.

---

### B11 — Dead Code: Hero-Daten vervollständigen (Mia, Sakura, 34/36 Descriptions)
**Datei:** `src/data/heroes.ts`

**Was ist das Problem?**

Von den **36 Heroes** in heroes.ts haben **34 ein leeres `description: ''`** Feld:

- `mia` (Zeile 1060): `description: ''` — Skills sind vollständig vorhanden (3 Skills mit Levels)
- `sakura` (Zeile 1295): `description: ''` — Skill `Motorcycle Frenzy` hat nur `effect: 'Increases damage (details coming soon).'`, kein `levels`-Array
- Weitere 32 Heroes: alle mit `description: ''`

Zusätzlich haben **10 Heroes** ein leeres `skills: []` Array — ihre Skill-Daten wurden noch nicht
eingetragen.

Die `description`-Felder werden in `HeroGrid.tsx` Zeile 165 nur bedingt angezeigt:
```tsx
{hero.description && <p className="hg-desc">{hero.description}</p>}
```

Das bedeutet: Im aktuellen Zustand zeigt das Hero-Modal für 34 von 36 Heroes keinen Description-Text.
Bei Sakura fehlen außerdem die `levels` für den Active Skill `Motorcycle Frenzy`.

**Umfang der fehlenden Daten:**
| Problem                             | Anzahl  |
|-------------------------------------|---------|
| Leere `description: ''`             | 34 / 36 |
| Leere `skills: []`                  | 10 / 36 |
| Unvollständige Skills (kein levels) | mind. 1 (Sakura) |

**Vorteile der Vervollständigung (Positiv):**
- Hero-Modal zeigt echten Lore/Kontext für Nutzer an
- Fehlende Skills (10 Heroes mit `skills: []`) zeigen aktuell das "!" Badge auf der Grid-Karte
  (HeroGrid.tsx Zeile 384–386) — schlechte UX
- Vollständige Daten ermöglichen B6 (aria-describedby) und bessere SEO für Hero-Seiten

**Nachteile / Risiken (Negativ):**
- Daten müssen recherchiert werden (Spiel-Lore für 34 Hero-Descriptions)
- Skill-Texte für 10 Heroes müssen aus dem Spiel extrahiert werden
- Zeitaufwändig: ca. 15–30 Minuten pro Hero für vollständige Dokumentation
- Keine Code-Änderungen nötig — reine Content-Pflege-Arbeit

**Aufwand:** Groß (8–18 Stunden für vollständige Vervollständigung aller 34+ Heroes)
**Impact:** Mittel (verbessert User-Experience im Hero-Modal merklich, ermöglicht B6)
**Empfehlung:** In Batches aufteilen: Zuerst die 10 Heroes mit `skills: []` (höchste UX-Priorität,
beseitigt das "!" Badge), dann die 34 fehlenden Descriptions. Sakuras `Motorcycle Frenzy`-Skill
als schnellen Fix bevorzugen.

---

## Zusammenfassung der Priorisierung

| Priorität | Items | Begründung |
|-----------|-------|------------|
| Zuerst    | B9 (Analytics), B5 (aria-label) | Hoher Nutzen-zu-Aufwand-Quotient, je ca. 30 min |
| Danach    | B10 (Permissions-Policy), B3 (Meta-Description) | Quick Wins in Wartungs-Sessions |
| Mittel    | B2 (Strukturierte Daten), B11 (Hero-Daten) | Größerer Impact, aber mehr Aufwand |
| Backlog   | B1 (Sitemap priority), B6 (aria-describedby), B8 (Magic Strings) | Abhängig von anderen Items oder marginal |
| Langfristig | B4 (Hero-Split), B7 (Inline-Styles) | Lohnt sich erst bei weiterem Wachstum |

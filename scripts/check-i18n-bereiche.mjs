// Prüft, dass jede Insel alle Texte bekommt, die sie anzeigt.
//
// Hintergrund: Die Seiten reichen ihren Komponenten nicht mehr das vollständige
// Wörterbuch durch, sondern nur noch bestimmte Bereiche (`nurBereiche`). Das
// spart rund ein Drittel der HTML-Masse — aber wer einen Text aus einem
// Bereich anzeigt, der nicht mitgeliefert wird, sieht statt des Textes den
// Schlüsselnamen. Im Browser fällt das erst auf, wenn jemand genau diese Stelle
// öffnet, und in dreizehn der fünfzehn Sprachen sieht es ohnehin niemand.
//
// Deshalb hier: Für jede Seite die Bereiche einsammeln, für jede Komponente
// (samt ihrer Importe) die verwendeten Schlüssel, und beides gegeneinander
// halten. Läuft vor dem Build und bricht ihn ab, wenn etwas fehlt.

// Nicht versucht werden sollte das Umgekehrte: unbenutzte Schlüssel suchen und
// löschen. Es gäbe rund 137 Kandidaten (etwa 2,4 % der ausgelieferten
// HTML-Masse), aber 18 davon werden zur Laufzeit zusammengesetzt —
// t(`seo.research.${categoryId}.title`) in [categoryId].astro. Wörtlich steht
// keiner dieser Schlüssel irgendwo; automatisch gelöscht hätte es Titel und
// Beschreibung von 300 indexierten Seiten getroffen. Wer hier aufräumen will,
// muss jeden Kandidaten von Hand ansehen.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const SEITEN = 'src/pages';
const WOERTERBUCH = 'src/i18n/locales/en.ts';

// Alle bekannten Schlüssel — nur diese Zeichenketten gelten als Textverweis
const alleSchluessel = new Set(
  [...readFileSync(WOERTERBUCH, 'utf8').matchAll(/['"]([a-zA-Z][\w.-]*\.[\w.-]+)['"]\s*:/g)].map((m) => m[1]),
);

// Schlüssel, die nicht im Quelltext stehen, sondern aus Daten kommen
// (nameKey-Felder in src/data). Sie lassen sich keiner Datei zuordnen, deshalb
// hier nach Bereich: wer den Bereich mitliefert, deckt sie ab.
const AUS_DATEN = ['research.', 'tank.', 'buildings.'];

function dateien(ordner, endungen) {
  const raus = [];
  for (const e of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) raus.push(...dateien(pfad, endungen));
    else if (endungen.some((x) => e.name.endsWith(x))) raus.push(pfad);
  }
  return raus;
}

/** Transitive lokale Importe einer Komponente */
function huelle(start, gesehen = new Set()) {
  if (!start || gesehen.has(start)) return gesehen;
  gesehen.add(start);
  let text;
  try { text = readFileSync(start, 'utf8'); } catch { return gesehen; }
  for (const m of text.matchAll(/from\s+'(\.[^']+)'/g)) {
    const basis = resolve(dirname(start), m[1]);
    for (const e of ['.tsx', '.ts']) {
      try { statSync(basis + e); huelle(basis + e, gesehen); break; } catch { /* weiter */ }
    }
  }
  return gesehen;
}

let fehler = 0;

for (const seite of dateien(SEITEN, ['.astro'])) {
  const quelle = readFileSync(seite, 'utf8');
  const aufrufe = [...quelle.matchAll(/nurBereiche\(translationData,\s*\[([^\]]*)\]\)/g)];
  if (aufrufe.length === 0) continue;

  const bereiche = aufrufe.flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));

  // Welche Komponenten bekommen das gefilterte Wörterbuch?
  const komponenten = [...quelle.matchAll(/<([A-Z][\w]*)[^>]*translationData=\{nurBereiche/g)].map((m) => m[1]);

  for (const name of komponenten) {
    const kandidaten = dateien('src/components', ['.tsx']).filter((p) => p.endsWith(`/${name}.tsx`));
    if (kandidaten.length === 0) continue;

    const benutzt = new Set();
    for (const datei of huelle(kandidaten[0])) {
      const text = readFileSync(datei, 'utf8');
      for (const m of text.matchAll(/['"`]([a-zA-Z][\w.-]*\.[\w.-]+)['"`]/g)) {
        if (alleSchluessel.has(m[1])) benutzt.add(m[1]);
      }
    }

    const fehlend = [...benutzt].filter((k) => !bereiche.some((b) => k.startsWith(b)));
    if (fehlend.length > 0) {
      fehler++;
      console.error(`✗ ${seite}`);
      console.error(`    ${name} zeigt Texte, die nicht mitgeliefert werden:`);
      for (const k of fehlend.slice(0, 8)) console.error(`      ${k}`);
      if (fehlend.length > 8) console.error(`      … und ${fehlend.length - 8} weitere`);
      const noetig = [...new Set(fehlend.map((k) => k.split('.')[0] + '.'))];
      console.error(`    Fehlende Bereiche: ${noetig.join(' ')}`);
    }
  }

  // Bereiche aus Daten: nur ein Hinweis, keine Prüfung — welche eine Seite
  // braucht, steht in ihren JSON-Daten, nicht in ihrem Quelltext.
  void AUS_DATEN;
}

if (fehler > 0) {
  console.error(`\n${fehler} Insel${fehler === 1 ? '' : 'n'} bekommt nicht alle Texte. In der jeweiligen .astro-Datei den Bereich zu nurBereiche(...) hinzufügen.`);
  process.exit(1);
}

console.log('✓ nurBereiche: alle Inseln bekommen die Texte, die sie anzeigen');

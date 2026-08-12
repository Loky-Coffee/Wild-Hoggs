// Prüft, dass Komponenten mit gekürztem Wörterbuch alle Texte bekommen,
// die sie anzeigen.
//
// Hintergrund: Astro schreibt die Eigenschaften einer Insel als JSON ins HTML.
// Das UserMenu bekommt deshalb nicht mehr das vollständige Wörterbuch, sondern
// nur die Schlüssel aus USER_MENU_KEYS. Wer in der Komponente ein t('…')
// ergänzt und die Liste vergisst, sieht im Menü den Schlüsselnamen statt des
// Textes — sichtbar, aber leicht zu übersehen, wenn man nicht angemeldet testet.
//
// Läuft vor dem Build (siehe package.json) und bricht ihn ab, wenn etwas fehlt.

import { readFileSync } from 'node:fs';

const PRUEFUNGEN = [
  {
    datei: 'src/components/auth/UserMenu.tsx',
    liste: 'USER_MENU_KEYS',
  },
];

let fehler = 0;

for (const { datei, liste } of PRUEFUNGEN) {
  const quelle = readFileSync(datei, 'utf8');

  // Was die Komponente anzeigt
  // Auch t('key', { n: '3' }) zählt — dieser Aufruf mit Platzhaltern wurde
  // vorher übersehen, und ein dort vergessener Schlüssel wäre durchgerutscht.
  const benutzt = new Set([...quelle.matchAll(/\bt\('([a-zA-Z0-9._]+)'\s*[,)]/g)].map((m) => m[1]));

  // Was sie mitgeliefert bekommt
  const block = quelle.match(new RegExp(`${liste}\\s*=\\s*\\[([^\\]]*)\\]`, 's'));
  if (!block) {
    console.error(`✗ ${datei}: ${liste} nicht gefunden`);
    fehler++;
    continue;
  }
  const geliefert = new Set([...block[1].matchAll(/'([a-zA-Z0-9._]+)'/g)].map((m) => m[1]));

  const fehlend = [...benutzt].filter((k) => !geliefert.has(k));
  const ueberzaehlig = [...geliefert].filter((k) => !benutzt.has(k));

  if (fehlend.length) {
    console.error(`✗ ${datei}: ${fehlend.length} Schlüssel werden angezeigt, aber nicht geliefert:`);
    for (const k of fehlend) console.error(`    ${k}`);
    fehler++;
  }
  if (ueberzaehlig.length) {
    // Kein Abbruchgrund — nur Ballast, den man beim Aufräumen mitnehmen kann.
    console.warn(`  ${datei}: ${ueberzaehlig.length} Schlüssel in ${liste} werden nicht mehr benutzt: ${ueberzaehlig.join(', ')}`);
  }
  if (!fehlend.length) {
    console.log(`✓ ${datei}: ${benutzt.size} Schlüssel, alle geliefert`);
  }
}

if (fehler) {
  console.error('\ni18n-Prüfung fehlgeschlagen.');
  process.exit(1);
}

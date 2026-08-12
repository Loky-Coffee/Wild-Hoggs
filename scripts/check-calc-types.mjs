// Prüft, dass jeder Rechner, der seinen Zustand speichert, dem Server auch
// bekannt ist.
//
// Hintergrund: /api/state/:calcType nimmt seit August 2026 nur noch die Namen
// aus RECHNER_TYPEN an — vorher liess sich unter jedem erfundenen Namen eine
// Zeile in der Datenbank anlegen. Der Preis dafür: Wer einen neuen Rechner
// baut und die Liste vergisst, bekommt beim Speichern still eine 400 zurück.
// Im Browser sieht dabei alles richtig aus, weil der Zustand zusätzlich im
// localStorage liegt; erst am anderen Gerät fehlt er.
//
// Läuft vor dem Build (siehe package.json) und bricht ihn ab, wenn etwas fehlt.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LISTE_DATEI = 'functions/_lib/state-limits.ts';
const SUCHORTE = ['src/components/calculators', 'src/components', 'src/hooks'];

// Was der Server annimmt
const quelle = readFileSync(LISTE_DATEI, 'utf8');
const block = quelle.match(/RECHNER_TYPEN\s*=\s*\[([^\]]*)\]/s);
if (!block) {
  console.error(`✗ ${LISTE_DATEI}: RECHNER_TYPEN nicht gefunden`);
  process.exit(1);
}
const erlaubt = new Set([...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

// Was das Frontend speichert
function dateien(ordner) {
  const raus = [];
  for (const e of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) raus.push(...dateien(pfad));
    else if (/\.(tsx|ts)$/.test(e.name)) raus.push(pfad);
  }
  return raus;
}

const benutzt = new Map(); // Typ → Datei
for (const ordner of SUCHORTE) {
  for (const datei of dateien(ordner)) {
    const text = readFileSync(datei, 'utf8');
    for (const m of text.matchAll(/useCalculatorState\s*<[^>]*>\s*\(\s*'([^']+)'/g)) {
      if (!benutzt.has(m[1])) benutzt.set(m[1], datei);
    }
  }
}

let fehler = 0;
for (const [typ, datei] of benutzt) {
  if (!erlaubt.has(typ)) {
    console.error(`✗ '${typ}' (${datei}) fehlt in RECHNER_TYPEN — der Server würde das Speichern ablehnen`);
    fehler++;
  }
}

if (fehler > 0) {
  console.error(`\n${fehler} Rechner ${fehler === 1 ? 'ist' : 'sind'} dem Server unbekannt. In ${LISTE_DATEI} ergänzen.`);
  process.exit(1);
}

console.log(`✓ ${LISTE_DATEI}: ${benutzt.size} Rechner, alle serverseitig erlaubt`);

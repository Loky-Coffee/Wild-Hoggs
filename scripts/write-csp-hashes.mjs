// Ersetzt 'unsafe-inline' in der Skript-Richtlinie durch die Prüfsummen der
// Inline-Skripte, die im Build tatsächlich vorkommen.
//
// Hintergrund: 'unsafe-inline' hebt den Schutz auf, den eine CSP gegen
// eingeschleustes JavaScript bietet — jedes <script> im Dokument darf laufen,
// gleich wo es herkam. Astro braucht Inline-Skripte für die Hydration seiner
// Inseln und für den ClientRouter, deshalb stand es hier. Nötig ist es nicht:
// über alle 511 Seiten gibt es nur eine Handvoll verschiedener Inline-Skripte,
// und für die genügen Prüfsummen.
//
// Läuft nach `astro build` (siehe package.json) und schreibt dist/_headers.
// public/_headers bleibt die Quelle und enthält den Platzhalter.
//
// Nicht erfasst: <script type="application/ld+json">. Das sind strukturierte
// Daten für Suchmaschinen, kein ausführbarer Code — Browser führen sie nicht
// aus und prüfen sie deshalb nicht gegen script-src. Es sind über tausend
// verschiedene Blöcke (jede Seite hat eigene), ihre Prüfsummen würden den
// Header sprengen.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const PLATZHALTER = '{{SCRIPT_HASHES}}';
const HEADER_DATEI = 'dist/_headers';

function htmlDateien(ordner) {
  const raus = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) raus.push(...htmlDateien(pfad));
    else if (name.endsWith('.html')) raus.push(pfad);
  }
  return raus;
}

const hashes = new Set();
let gesamt = 0;

for (const datei of htmlDateien('dist')) {
  const html = readFileSync(datei, 'utf8');
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const [, attrs, inhalt] = m;
    if (/\ssrc=/.test(attrs)) continue;          // externes Skript, deckt 'self' ab
    if (/ld\+json/.test(attrs)) continue;        // Daten, kein Code (siehe oben)
    gesamt++;
    // Der Hash geht über den Inhalt, exakt wie er im Dokument steht.
    hashes.add(createHash('sha256').update(inhalt, 'utf8').digest('base64'));
  }
}

const liste = [...hashes].sort().map((h) => `'sha256-${h}'`).join(' ');

const header = readFileSync(HEADER_DATEI, 'utf8');
if (!header.includes(PLATZHALTER)) {
  // Seit 16.08.2026 arbeitet die CSP wieder mit 'unsafe-inline' statt mit
  // Pruefsummen — Astros ClientRouter fuehrt die Inline-Skripte der Zielseite
  // beim Seitenwechsel selbst aus, und dabei stimmten die Pruefsummen nicht
  // mehr. Die Begruendung steht ausfuehrlich in public/_headers.
  //
  // Kein Fehler, sondern der erwartete Zustand: Das Skript rechnet weiter mit,
  // damit die Zahl sichtbar bleibt, schreibt aber nichts.
  console.log(`✓ CSP: Pruefsummen nicht aktiv (kein ${PLATZHALTER} in ${HEADER_DATEI}) — nichts zu tun`);
  process.exit(0);
}
// Bewusst `replace` statt `replaceAll`: Der Platzhalter soll genau einmal
// vorkommen. Stand er versehentlich auch in einem Kommentar, landete die
// Pruefsummenliste dort ebenfalls — und die Laengenpruefung unten schlug dann
// an der Kommentarzeile an und schickte einen zur falschen Stelle.
const vorkommen = header.split(PLATZHALTER).length - 1;
if (vorkommen !== 1) {
  console.error(`✗ ${HEADER_DATEI}: Platzhalter ${PLATZHALTER} kommt ${vorkommen}× vor, erwartet genau 1×`);
  process.exit(1);
}
const fertig = header.replace(PLATZHALTER, liste);

// Cloudflare Pages erlaubt 2000 Zeichen je Header-Zeile:
// https://developers.cloudflare.com/pages/platform/limits/#headers
// Wird das überschritten, greift die Regel nicht mehr — und das fiele erst
// im Betrieb auf, wenn die Seite bereits ohne Schutz ausgeliefert wird.
const GRENZE = 2000;
const zuLang = fertig
  .split('\n')
  .map((z) => z.trim())
  .filter((z) => z.length > GRENZE);

if (zuLang.length > 0) {
  console.error(`✗ CSP: eine Header-Zeile ist ${zuLang[0].length} Zeichen lang, erlaubt sind ${GRENZE}.`);
  console.error('  Cloudflare Pages verwirft zu lange Zeilen. Die Prüfsummen auf eine weitere');
  console.error("  'Content-Security-Policy'-Zeile aufteilen — mehrere Richtlinien gelten zusammen.");
  process.exit(1);
}

writeFileSync(HEADER_DATEI, fertig);

const laengste = Math.max(...fertig.split('\n').map((z) => z.trim().length));
console.log(
  `✓ CSP: ${hashes.size} verschiedene Inline-Skripte (${gesamt} Vorkommen) als Prüfsumme hinterlegt` +
  ` — längste Header-Zeile ${laengste}/${GRENZE} Zeichen`
);

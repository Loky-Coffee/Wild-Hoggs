// Legt neben jede .webp eine gleich benannte .avif.
//
//   npm run images:avif                      — alle Heldenbilder
//   node make-avif.js public/images/foo      — ein anderes Verzeichnis
//
// AVIF ist bei diesen Bildern rund 25–50 % kleiner als WebP. Ausgeliefert wird
// es über <picture> mit der WebP als Rückfallebene (siehe Pic in HeroGrid.tsx),
// ältere Browser bekommen also weiterhin die WebP.
//
// Nach dem Hinzufügen neuer Heldenbilder einmal laufen lassen.

import sharp from 'sharp';
import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const QUALITY = 58;   // visuell unauffällig, deutlich kleiner als WebP

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  dirs.push('public/images/heroes', 'public/images/heroes/symbols');
}

let webpBytes = 0, avifBytes = 0, made = 0, skipped = 0;

for (const dir of dirs) {
  if (!existsSync(dir)) { console.log(`  übersprungen (fehlt): ${dir}`); continue; }

  for (const file of readdirSync(dir).filter(f => f.endsWith('.webp'))) {
    const src = join(dir, file);
    const out = src.replace(/\.webp$/, '.avif');
    const srcSize = statSync(src).size;

    const buf = await sharp(src).avif({ quality: QUALITY, effort: 6 }).toBuffer();

    // Nur behalten, wenn AVIF tatsächlich kleiner ist — bei sehr kleinen
    // Grafiken ist das nicht immer der Fall.
    if (buf.length < srcSize) {
      writeFileSync(out, buf);
      avifBytes += buf.length;
      made++;
    } else {
      avifBytes += srcSize;
      skipped++;
    }
    webpBytes += srcSize;
  }
}

const kb = n => Math.round(n / 1024);
console.log(`\n🖼  ${made} AVIF erzeugt${skipped ? `, ${skipped} übersprungen (AVIF war nicht kleiner)` : ''}`);
console.log(`   WebP: ${kb(webpBytes)} KB  →  AVIF: ${kb(avifBytes)} KB  (${Math.round(100 - avifBytes / webpBytes * 100)} % weniger)\n`);

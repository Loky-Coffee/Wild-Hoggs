import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Schreibt dist/version.json mit der Kennung dieses Builds.
 *
 * Der Client kennt seine eigene Kennung über __BUILD_ID__ (siehe
 * astro.config.mjs) und vergleicht sie damit. Weichen sie ab, läuft im Browser
 * eine ältere Fassung — dann weist UpdateNotice darauf hin.
 *
 * Beide Werte stammen aus derselben Umgebungsvariable und demselben Build-Lauf,
 * können also nicht auseinanderlaufen.
 */
const buildId = process.env.CF_PAGES_COMMIT_SHA || 'dev';
const out = join('dist', 'version.json');

writeFileSync(out, JSON.stringify({ build: buildId }) + '\n');
console.log(`\n🔖 version.json geschrieben: ${buildId}`);

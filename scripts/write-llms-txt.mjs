// Erzeugt dist/llms.txt — einen Wegweiser für Sprachmodelle.
//
// Was das ist: llms.txt ist ein Vorschlag von 2024 (llmstxt.org). Eine
// Markdown-Datei im Wurzelverzeichnis, die einem Sprachmodell in einem Zug
// sagt, worum es auf der Seite geht und wo die belastbaren Daten liegen —
// ähnlich wie robots.txt für Suchmaschinen, nur zum Lesen statt zum Sperren.
//
// Ehrlich dazu: OpenAI, Anthropic und Google werten die Datei bislang NICHT
// offiziell aus. Sie kostet aber nichts, veraltet dank dieses Skripts nicht,
// und wer sie liest, findet die Datenseiten gebündelt statt sie über 1230
// Sitemap-Einträge zusammensuchen zu müssen.
//
// Läuft nach `astro build` (siehe package.json). Die Adressen stammen aus
// denselben Datendateien wie die Seiten selbst, können also nicht auseinander-
// laufen.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASIS = 'https://wild-hoggs.com';
const ZIEL  = 'dist/llms.txt';

const json = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ── Forschungsbäume ────────────────────────────────────────────────────────
// Die Reihenfolge der Seite selbst (src/pages/[...lang]/tools/research.astro).
const BAEUME = [
  'unit_special_training', 'fully_armed_alliance', 'field', 'alliance_recognition',
  'military_strategies', 'peace_shield', 'siege_to_seize', 'hero_training',
  'army_building', 'tactical_master', 'rider_training', 'assaulter_training',
  'shooter_training', 'age_of_steel', 'new_home', 'rapid_growth',
  'shelter_building', 'elite_troops', 'hq_management',
];

// Die englischen Namen stehen in den Rohdaten; Dateiname = id mit Bindestrichen.
function baumInfo(id) {
  const datei = `src/data/research/${id.replace(/_/g, '-')}.json`;
  if (!existsSync(datei)) return null;
  const d = json(datei);
  const badges = (d.technologies ?? []).reduce(
    (s, t) => s + (t.badgeCosts ?? []).reduce((a, b) => a + b, 0), 0,
  );
  return { name: d.name ?? id, anzahl: (d.technologies ?? []).length, badges };
}

const gebaeude = json('src/data/buildings.json');
const namen    = json('src/data/buildings-names.json');
const tank     = json('src/data/tank-modifications.json');

const nf = new Intl.NumberFormat('en-US');

const zeilen = [];
const z = (s = '') => zeilen.push(s);

z('# Wild Hoggs — Last Z: Survival Shooter tools and data');
z();
z('> Free calculators, cost tables and guides for the mobile game Last Z: Survival Shooter');
z('> (also written "Last Z" or "LastZ"). Built and maintained by Ediva, a player on Server 395.');
z('> Every page exists in 15 languages; the English addresses are listed below, the other');
z('> languages carry a two-letter prefix (e.g. /de/tools/research/).');
z();
z('The calculators are interactive and render their numbers in the browser. The pages ending');
z('in /costs/ carry the same figures as plain HTML tables — those are the ones worth reading');
z('if you cannot execute JavaScript.');
z();

// ── Forschung ──────────────────────────────────────────────────────────────
const baeume = BAEUME.map(id => ({ id, ...(baumInfo(id) ?? {}) })).filter(b => b.name);
const badgesGesamt = baeume.reduce((s, b) => s + b.badges, 0);
const ohneBadges   = baeume.filter(b => b.badges === 0);

z('## Research trees');
z();
z('Badge, power and centrifuge costs per technology, plus research time and prerequisites.');
z();
z(`Maxing every technology in all ${baeume.length} trees costs ${nf.format(badgesGesamt)} badges in total.`);
if (ohneBadges.length) {
  z(`${ohneBadges.length} of the trees (${ohneBadges.map(b => b.name).join(', ')}) cost no badges at all —`);
  z('they are paid for in power and centrifuges instead.');
}
z();
z('The figure after each tree is what that ONE tree costs, not the running total.');
z();
for (const b of baeume) {
  z(`- [${b.name}](${BASIS}/tools/research/${b.id}/costs/): ${b.anzahl} technologies, `
    + (b.badges > 0
      ? `${nf.format(b.badges)} badges for this tree`
      : 'no badges (power and centrifuges only)'));
}
z();

// ── Gebäude ────────────────────────────────────────────────────────────────
z('## Buildings');
z();
z('Wood, food, steel, zent, build time, combat power and required buildings — level by level.');
z();
for (const b of gebaeude) {
  const name = namen[b.id]?.en ?? b.id;
  z(`- [${name}](${BASIS}/tools/building/${b.id}/costs/): levels 1–${b.maxLevel}`);
}
z();

// ── Panzer ─────────────────────────────────────────────────────────────────
z('## Tank');
z();
z(`- [Tank modifications](${BASIS}/tools/tank/costs/): ${tank.modifications.length} modifications, `
  + `${nf.format(tank.totalWrenches)} wrenches to level ${tank.maxLevel}, `
  + `${(tank.milestones ?? []).length} vehicles`);
z();

// ── Übriges ────────────────────────────────────────────────────────────────
z('## Other pages');
z();
z(`- [Redeem codes](${BASIS}/codes/): active gift codes, checked against the official announcement channel every ten minutes`);
z(`- [Heroes](${BASIS}/heroes/): tier list, skills, factions`);
z(`- [Weekly roses](${BASIS}/roses/): the alliance buff rotation`);
z(`- [Research calculator](${BASIS}/tools/research/): interactive, keeps your progress`);
z(`- [Building calculator](${BASIS}/tools/building/): interactive`);
z(`- [Tank calculator](${BASIS}/tools/tank/): interactive`);
z(`- [About](${BASIS}/about/): who runs this and why`);
z();
z('## Notes');
z();
z('- All figures come from the game data and are updated when the game changes.');
z('- Times are given without any speed bonus; the calculators apply yours.');
z('- No account is needed to read anything. Sign-in only stores your own progress.');
z();

const inhalt = zeilen.join('\n');
writeFileSync(ZIEL, inhalt);

const eintraege = (inhalt.match(/^- \[/gm) ?? []).length;
console.log(`✓ llms.txt: ${eintraege} Einträge, ${(inhalt.length / 1024).toFixed(1)} kB`);

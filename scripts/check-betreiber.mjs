// Bricht den Build ab, solange die Angaben zum Verantwortlichen fehlen.
//
// Die Datenschutzerklärung nennt nach Art. 13 Abs. 1 lit. a DSGVO den
// Verantwortlichen samt Kontaktdaten. Stehen dort noch die Platzhalter, wäre
// die Erklärung wertlos — und schlimmer als keine, weil sie den Eindruck
// erweckt, die Sache sei erledigt.
//
// Läuft vor dem Build (siehe package.json).

import { readFileSync } from 'node:fs';

const DATEI = 'src/config/betreiber.ts';
const inhalt = readFileSync(DATEI, 'utf8');

const offen = [];
if (inhalt.includes('NAME EINTRAGEN')) offen.push('name');
if (inhalt.includes('E-MAIL EINTRAGEN')) offen.push('email');

if (offen.length > 0) {
  console.error(`✗ ${DATEI}: ${offen.join(' und ')} noch nicht ausgefüllt.`);
  console.error('');
  console.error('  Die Datenschutzerklärung braucht den Verantwortlichen mit Kontaktdaten');
  console.error('  (Art. 13 Abs. 1 lit. a DSGVO). Mit Platzhaltern darf sie nicht live gehen.');
  console.error('');
  console.error('  Eine Postanschrift ist dort NICHT zwingend — eine E-Mail-Adresse genügt.');
  console.error('  Die ladungsfähige Anschrift verlangt erst das Impressum (§ 5 DDG).');
  process.exit(1);
}

// Eine E-Mail-Adresse sollte auch wie eine aussehen.
const mail = inhalt.match(/email:\s*'([^']*)'/);
if (mail && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(mail[1])) {
  console.error(`✗ ${DATEI}: "${mail[1]}" sieht nicht nach einer E-Mail-Adresse aus.`);
  process.exit(1);
}

console.log('✓ Verantwortlicher: eingetragen');

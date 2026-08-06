// Legt eine lokale Testdatenbank an (Schema + ein paar Konten), damit man die
// Seite mitsamt APIs und Chat lokal durchklicken kann.
//
//   npm run dev:seed     — Datenbank neu aufsetzen
//   npm run dev:local    — Seite + APIs starten (Port 8788)
//   npm run dev:hub      — Chat-Hub starten (Port 8799), zweites Terminal
//
// Die Konten sind reine Testkonten mit bekannten Passwörtern. Sie existieren
// NUR in der lokalen Datei unter .wrangler/ — niemals in der echten Datenbank.

import { execFileSync } from 'child_process';
import { pbkdf2Sync, randomBytes } from 'crypto';
import { writeFileSync, unlinkSync } from 'fs';

// Muss zu hashPassword() in functions/_lib/auth.ts passen.
function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

const ACCOUNTS = [
  { id: 'dev-admin', username: 'admin', email: 'admin@local.test', password: 'admin1234', admin: 1, mod: 0, server: '395', lang: 'de', faction: 'blood-rose' },
  { id: 'dev-user',  username: 'tester', email: 'tester@local.test', password: 'tester1234', admin: 0, mod: 0, server: '395', lang: 'de', faction: 'wings-of-dawn' },
  { id: 'dev-user2', username: 'zweiter', email: 'zwei@local.test',  password: 'zweiter1234', admin: 0, mod: 0, server: '395', lang: 'de', faction: 'guard-of-order' },
];

const sql = [
  `DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS game_profiles;
   DROP TABLE IF EXISTS chat_global; DROP TABLE IF EXISTS chat_server; DROP TABLE IF EXISTS chat_pm;
   DROP TABLE IF EXISTS chat_rate_limits; DROP TABLE IF EXISTS app_settings; DROP TABLE IF EXISTS chat_reports;
   DROP TABLE IF EXISTS calculator_states;`,

  `CREATE TABLE users (
     id TEXT PRIMARY KEY, email TEXT UNIQUE, username TEXT UNIQUE, password_hash TEXT,
     faction TEXT, server TEXT, language TEXT,
     formation_power_br INTEGER, formation_power_wd INTEGER, formation_power_go INTEGER,
     is_admin INTEGER DEFAULT 0, is_moderator INTEGER DEFAULT 0,
     notification_sound INTEGER DEFAULT 1, notification_volume REAL DEFAULT 1.5,
     last_seen TEXT, updated_at TEXT DEFAULT (datetime('now')),
     created_at TEXT DEFAULT (datetime('now')));`,

  `CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT);`,

  `CREATE TABLE game_profiles (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, name TEXT, server TEXT, faction TEXT,
     formation_power_br INTEGER, formation_power_wd INTEGER, formation_power_go INTEGER,
     created_at TEXT DEFAULT (datetime('now')));`,

  `CREATE TABLE chat_global (id TEXT PRIMARY KEY, user_id TEXT, username TEXT, faction TEXT, server TEXT,
     lang TEXT, message TEXT, reply_to_id TEXT, created_at TEXT DEFAULT (datetime('now')));`,

  `CREATE TABLE chat_server (id TEXT PRIMARY KEY, server TEXT, user_id TEXT, username TEXT, faction TEXT,
     lang TEXT, message TEXT, reply_to_id TEXT, created_at TEXT DEFAULT (datetime('now')));`,

  `CREATE TABLE chat_pm (id TEXT PRIMARY KEY, sender_id TEXT, receiver_id TEXT, message TEXT,
     created_at TEXT DEFAULT (datetime('now')));`,

  `CREATE TABLE chat_rate_limits (user_id TEXT PRIMARY KEY, last_msg TEXT DEFAULT (datetime('now')),
     window_start TEXT DEFAULT (datetime('now')), msg_count INTEGER DEFAULT 0);`,

  `CREATE TABLE chat_reports (id TEXT PRIMARY KEY, chat_type TEXT, message_id TEXT, reported_by TEXT,
     reason TEXT, status TEXT DEFAULT 'open', created_at TEXT DEFAULT (datetime('now')));`,

  `CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL,
     updated_at TEXT NOT NULL DEFAULT (datetime('now')));`,

  // Spaltennamen exakt wie in der Produktion — calc_key und state_json, nicht
  // category und state. Eine Abweichung hier hat schon zweimal eine falsche
  // Diagnose erzeugt.
  `CREATE TABLE calculator_states (user_id TEXT REFERENCES users(id) ON DELETE CASCADE, profile_id TEXT,
     calc_type TEXT, calc_key TEXT, state_json TEXT, updated_at TEXT DEFAULT (datetime('now')),
     PRIMARY KEY (user_id, profile_id, calc_type, calc_key));`,

  `INSERT INTO app_settings (key, value) VALUES ('lucky_rose_active', '6');`,
];

for (const a of ACCOUNTS) {
  const h = hashPassword(a.password).replace(/'/g, "''");
  sql.push(
    `INSERT INTO users (id, email, username, password_hash, faction, server, language, is_admin, is_moderator, last_seen)
     VALUES ('${a.id}', '${a.email}', '${a.username}', '${h}', '${a.faction}', '${a.server}', '${a.lang}', ${a.admin}, ${a.mod}, datetime('now'));`,
    `INSERT INTO game_profiles (id, user_id, name, server, faction)
     VALUES ('p-${a.id}', '${a.id}', 'Standard', '${a.server}', '${a.faction}');`,
  );
}

sql.push(
  `INSERT INTO chat_global (id, user_id, username, faction, server, lang, message)
   VALUES ('seed1', 'dev-user', 'tester', 'wings-of-dawn', '395', NULL, 'Hallo aus dem globalen Chat');`,
  `INSERT INTO chat_server (id, server, user_id, username, faction, lang, message)
   VALUES ('seed2', '395', 'dev-user', 'tester', 'wings-of-dawn', NULL, 'Hallo aus dem Server-Chat');`,
);

const file = '.dev-seed.sql';
writeFileSync(file, sql.join('\n'));
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'wild-hoggs-db', '--local', `--file=${file}`],
    { stdio: ['ignore', 'ignore', 'inherit'] });
} finally {
  try { unlinkSync(file); } catch { /* ignore */ }
}

console.log('\n✅ Lokale Testdatenbank steht.\n');
console.log('   Konten (nur lokal!):');
for (const a of ACCOUNTS) {
  console.log(`     ${a.username.padEnd(8)} / ${a.password.padEnd(12)} ${a.admin ? '(Admin)' : ''}`);
}
console.log('\n   Weiter mit:  npm run dev:local     (Seite + APIs, Port 8788)');
console.log('   Für den Chat zusätzlich in einem zweiten Terminal:  npm run dev:hub\n');

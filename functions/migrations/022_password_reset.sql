-- Tabelle für das Zurücksetzen vergessener Passwörter
--
-- Bisher gab es keinen Weg zurück: Wer sein Passwort vergaß, verlor sein Konto
-- mitsamt Rechnerständen, Spielprofilen und Gesprächen. Bei 174 in dreißig
-- Tagen aktiven Konten ist das kein Randfall.
--
-- Gespeichert wird NICHT der Token, sondern sein SHA-256-Wert. Wer diese
-- Tabelle liest, kann damit kein Passwort zurücksetzen — genauso wie bei den
-- Passwörtern selbst. Der Token steht nur in der einen Mail.
--
-- Ein Konto kann mehrere offene Anfragen haben (jemand klickt zweimal auf
-- "vergessen"). Jede gilt eine Stunde, jede ist genau einmal einlösbar.
--
-- Additiv: eine neue Tabelle, sonst nichts.

CREATE TABLE IF NOT EXISTS password_resets (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);

-- Beim Einlösen wird über den Hash gesucht.
CREATE INDEX IF NOT EXISTS idx_password_resets_hash ON password_resets(token_hash);

-- Für das Aufräumen abgelaufener Anfragen.
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);

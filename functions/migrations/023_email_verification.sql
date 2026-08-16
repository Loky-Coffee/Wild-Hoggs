-- E-Mail-Bestätigung
--
-- Warum: Von 303 Konten lag bei zweien nachweislich ein Tippfehler in der
-- Adresse (gmai.com statt gmail.com, naver.con statt naver.com). Diese beiden
-- Menschen glauben, eine gültige Adresse hinterlegt zu haben, und könnten nie
-- ein Passwort zurücksetzen. Ohne Bestätigung merkt das niemand — bis es zu
-- spät ist.
--
-- Was das NICHT ist: eine Hürde bei der Registrierung. Wer sich anmeldet, ist
-- sofort drin und kann alles benutzen. Unbestätigt bleibt nur der
-- Passwort-Reset gesperrt — denn ein Reset an eine unbestätigte Adresse ist
-- genau das Loch, das man nicht haben will.
--
-- Zur Frist: Die Löschung unbestätigter Konten passiert NICHT automatisch.
-- Das Admin-Panel zeigt Kandidaten samt Begründung an, entschieden wird von
-- Hand.
--
-- Additiv: zwei Spalten, eine Tabelle, ein Einstellungswert. Bestehende Daten
-- werden nicht angefasst.

-- ── Bestätigungsstand am Konto ──────────────────────────────────────────────

-- 0 = nicht bestätigt. Alle 303 bestehenden Konten starten hier, weil bei
-- keinem je geprüft wurde, ob die Adresse existiert.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- Wann bestätigt wurde. NULL, solange offen.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

-- ── Offene Bestätigungen ────────────────────────────────────────────────────

-- Wie bei den Passwort-Token: gespeichert wird der SHA-256-Wert, nicht der
-- Token selbst. Der steht nur in der Mail.
CREATE TABLE IF NOT EXISTS email_verifications (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  -- An welche Adresse der Link ging. Wer seine Adresse zwischendurch ändert,
  -- soll den alten Link nicht mehr einlösen können.
  email       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_verif_hash ON email_verifications(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verifications(user_id);

-- ── Stichtag ────────────────────────────────────────────────────────────────

-- Ab wann die Frist für Bestandskonten läuft. Ohne diesen Wert wäre ein 2026
-- angelegtes Konto sofort "seit Monaten überfällig", obwohl es nie zur
-- Bestätigung aufgefordert wurde.
--
-- Die Frist eines Kontos ist damit: MAX(created_at, dieser Wert) + 30 Tage.
INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('email_verification_since', datetime('now'));

-- ── Altlast ─────────────────────────────────────────────────────────────────

-- Stammte aus dem ursprünglichen Schema, wurde nie implementiert (0 Zeilen,
-- kein Verweis im Code) und hätte den Token im KLARTEXT gespeichert. Der
-- Passwort-Reset benutzt password_resets aus Migration 022, dort gehasht.
DROP TABLE IF EXISTS password_reset_tokens;

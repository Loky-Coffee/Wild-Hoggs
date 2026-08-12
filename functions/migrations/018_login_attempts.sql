-- Bremse gegen das Durchprobieren von Passwörtern.
--
-- Bisher nahm /api/auth/login unbegrenzt Versuche an. Bei 289 Konten und einer
-- Mindestlänge von acht Zeichen ist das Durchprobieren aus geleakten
-- Passwortlisten realistisch.
--
-- Gezählt wird nach Schlüssel, nicht nach Konto: entweder "ip|e-mail" oder nur
-- "ip". Das ist wichtig, damit niemand einen fremden Zugang lahmlegen kann,
-- indem er absichtlich falsche Passwörter zu dessen Adresse schickt — er
-- bremst damit nur sich selbst.
--
-- Bewusst keine Fremdschlüssel-Beziehung zu users: Auch Versuche mit
-- E-Mail-Adressen, die es gar nicht gibt, müssen mitzählen.

CREATE TABLE IF NOT EXISTS login_attempts (
  key          TEXT PRIMARY KEY,
  window_start TEXT NOT NULL DEFAULT (datetime('now')),
  attempts     INTEGER NOT NULL DEFAULT 0
);

-- Für das Aufräumen abgelaufener Zeitfenster.
CREATE INDEX IF NOT EXISTS idx_login_attempts_window ON login_attempts(window_start);

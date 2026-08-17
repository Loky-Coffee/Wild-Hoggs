-- Konten sperren
--
-- Bisher gab es nur zwei Zustände: Konto da oder Konto weg. Für Ärger im Chat
-- ist Löschen die falsche Antwort — es ist endgültig, und wer sich danebenbe-
-- nimmt, meldet sich einfach neu an. Eine Sperre lässt sich zurücknehmen.
--
-- Das Recht 'users.ban' gibt es im System bereits; es liess sich vergeben, tat
-- aber nichts. Ab hier tut es etwas.
--
-- banned_at NULL = nicht gesperrt. Kein eigenes Ja/Nein-Feld daneben, das
-- damit auseinanderlaufen könnte.
--
-- Additiv: drei Spalten, sonst nichts.

ALTER TABLE users ADD COLUMN banned_at TEXT;

-- Wer gesperrt hat. Kein Fremdschlüssel: Wird das sperrende Konto später
-- gelöscht, soll die Angabe bestehen bleiben statt die Zeile mitzureissen.
ALTER TABLE users ADD COLUMN banned_by TEXT;

-- Grund, wie er dem Gesperrten beim Anmeldeversuch angezeigt wird. Darf leer
-- bleiben — dann steht dort nur der allgemeine Hinweis.
ALTER TABLE users ADD COLUMN ban_grund TEXT;

-- Für die Anzeige im Verwaltungsbereich ("nur Gesperrte").
CREATE INDEX IF NOT EXISTS idx_users_banned ON users(banned_at);

-- Die Längengrenze privater Nachrichten an die Einstellung angleichen
--
-- Die Chat-Einstellung im Admin-Panel lässt 50 bis 2000 Zeichen zu, und der
-- Server prüft auch dagegen. Die Tabelle für private Nachrichten trug daneben
-- aber noch ein festes CHECK(length(message) <= 500) aus ihrer ersten Fassung.
--
-- Solange die Einstellung nicht gesetzt ist, greift der Standard 500 und beides
-- passt zusammen. Setzt jemand die Grenze höher, nimmt der Server die Nachricht
-- an und die Datenbank weist sie ab — die Nachricht ist weg, und zwar nur im
-- privaten Chat, während Weltchat und Serverchat weiterlaufen (die haben kein
-- solches CHECK). Ein Fehler, der erst Monate später und nur an einer Stelle
-- auftritt.
--
-- SQLite kann eine CHECK-Bedingung nicht ändern; die Tabelle muss neu
-- geschrieben werden. Der Ablauf ist der von SQLite empfohlene:
-- https://www.sqlite.org/lang_altertable.html#otheralter
--
-- Inhalt bleibt unverändert: dieselben Spalten, dieselben Zeilen, dieselben
-- Indizes. Nur die Obergrenze steigt von 500 auf 2000 — den oberen Rand dessen,
-- was die Einstellung überhaupt zulässt.

CREATE TABLE chat_pm_neu (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL CHECK(length(message) <= 2000),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO chat_pm_neu (id, sender_id, receiver_id, message, created_at)
  SELECT id, sender_id, receiver_id, message, created_at FROM chat_pm;

DROP TABLE chat_pm;

ALTER TABLE chat_pm_neu RENAME TO chat_pm;

CREATE INDEX idx_chat_pm_convo    ON chat_pm(sender_id, receiver_id, created_at);
CREATE INDEX idx_chat_pm_receiver ON chat_pm(receiver_id, created_at);

-- Index auf users.last_seen
--
-- Die Online-Liste fragt "wer war in den letzten fuenf Minuten da?" und lief
-- dafuer ueber die ganze Tabelle. Dieselbe Abfrage steckt in /api/presence, in
-- /api/chat/sync und zweimal in der Statistik — und der Herzschlag kommt von
-- jeder Seite, jede Minute, von jedem angemeldeten Geraet.
--
-- Aendert keine Daten: ein Index kommt hinzu, mehr nicht.

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);

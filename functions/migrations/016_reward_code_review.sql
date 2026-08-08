-- Gift-Codes aus dem Discord-Ankündigungskanal einsammeln.
--
-- Der Cron im chat-hub-Worker liest mit, erkennt Code-Muster und legt sie hier
-- ab. Veröffentlicht wird nichts automatisch: gefundene Codes warten auf eine
-- Bestätigung im Admin-Panel. Die Erkennung darf deshalb bewusst großzügig
-- sein — ein überflüssiger Treffer kostet einen Klick, ein verpasster Code
-- kostet die Spieler eine Belohnung.

-- Bestehende Codes wurden von Hand eingetragen und gelten als bestätigt.
ALTER TABLE reward_codes ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';

-- Woher der Code kam: 'manual' (Admin-Panel) oder 'discord' (Cron).
ALTER TABLE reward_codes ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

-- Bei Discord-Funden die Nachrichten-ID — damit man den Ursprung nachlesen
-- kann und derselbe Post nicht zweimal ausgewertet wird.
ALTER TABLE reward_codes ADD COLUMN source_ref TEXT;

-- Derselbe Code darf nur einmal existieren. Ohne das legt jeder Lauf, der eine
-- Nachricht erneut sieht, einen weiteren Eintrag an.
--
-- Bisher liess die API Doppelte zu. Gibt es welche, liefe der eindeutige Index
-- in einen Fehler und die ganze Migration schluege fehl. Deshalb vorher
-- aufraeumen — es bleibt jeweils der zuerst angelegte Eintrag stehen.
DELETE FROM reward_codes
 WHERE rowid NOT IN (SELECT MIN(rowid) FROM reward_codes GROUP BY code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_codes_code ON reward_codes(code);

-- Die öffentliche Liste fragt nur nach bestätigten Codes, das Admin-Panel nur
-- nach wartenden.
CREATE INDEX IF NOT EXISTS idx_reward_codes_status ON reward_codes(status, added_at);

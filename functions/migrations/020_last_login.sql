-- Eigene Spalte fuer die letzte Anmeldung
--
-- Bisher wurde der Wert aus MAX(sessions.expires_at) minus 30 Tage
-- zurueckgerechnet. Meldet sich jemand ab, loescht logout.ts die Sitzungszeile —
-- und im Verwaltungsbereich stand fuer dieses Konto "—", als haette es sich nie
-- angemeldet. Dieselbe Ableitung traegt auch das Stundendiagramm.
--
-- Fuegt nur eine Spalte hinzu, aendert keine bestehenden Daten.

ALTER TABLE users ADD COLUMN last_login TEXT;

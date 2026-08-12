-- Einzeln vergebbare Rechte statt zwei Schaltern.
--
-- Bisher gab es is_admin und is_moderator: Moderator sein hieß, alles zu dürfen,
-- was Moderatoren dürfen. Wer nur die Meldungen bearbeiten sollte, bekam
-- zwangsläufig auch alles andere dazu.
--
-- Ab jetzt steht am Konto eine Liste von Rechten. is_admin bleibt bestehen und
-- bedeutet weiterhin "darf alles" — sonst könnte man sich selbst aussperren.
-- is_moderator bleibt ebenfalls, aber nur noch als Anzeige der Rolle; die
-- eigentliche Entscheidung trifft die Rechteliste.

ALTER TABLE users ADD COLUMN permissions TEXT;

-- Vorhandene Moderatoren behalten genau das, was sie heute dürfen: Meldungen
-- ansehen und bearbeiten, Chat-Nachrichten löschen, Nutzerliste einsehen.
-- Ohne diese Zeile stünden sie nach der Migration ohne Rechte da.
UPDATE users
   SET permissions = '["reports.view","reports.resolve","messages.delete","users.view"]'
 WHERE is_moderator = 1
   AND (permissions IS NULL OR permissions = '');

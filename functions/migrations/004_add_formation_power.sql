-- Migration 004: formation power per faction
-- Stores the user's best 5-item-set power for each of the three factions.

ALTER TABLE users ADD COLUMN formation_power_br  INTEGER;  -- Blood Rose
ALTER TABLE users ADD COLUMN formation_power_wd  INTEGER;  -- Wings of Dawn
ALTER TABLE users ADD COLUMN formation_power_go  INTEGER;  -- Guard of Order

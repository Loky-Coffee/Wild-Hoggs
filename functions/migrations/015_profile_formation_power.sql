-- Migration 015: Move formation power + faction to game_profiles
-- Faction already exists in game_profiles (from migration 014).
-- We add formation_power_br/wd/go columns and migrate from users table.

ALTER TABLE game_profiles ADD COLUMN formation_power_br INTEGER;
ALTER TABLE game_profiles ADD COLUMN formation_power_wd INTEGER;
ALTER TABLE game_profiles ADD COLUMN formation_power_go INTEGER;

-- Copy formation power values from users into their init_ profiles
UPDATE game_profiles
SET
  formation_power_br = (SELECT formation_power_br FROM users WHERE users.id = game_profiles.user_id),
  formation_power_wd = (SELECT formation_power_wd FROM users WHERE users.id = game_profiles.user_id),
  formation_power_go = (SELECT formation_power_go FROM users WHERE users.id = game_profiles.user_id)
WHERE game_profiles.id LIKE 'init_%';

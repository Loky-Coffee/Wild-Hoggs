-- Migration 014: Game profiles
-- One website account can have multiple in-game profiles (game accounts).
-- Each profile has its own calculator states.

-- 1. Create game_profiles table
CREATE TABLE IF NOT EXISTS game_profiles (
  id         TEXT NOT NULL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Standard',
  server     TEXT,
  faction    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Create a default profile for every existing user.
--    Profile ID = 'init_' || user_id  (deterministic, unique per user)
INSERT INTO game_profiles (id, user_id, name, server, faction)
SELECT 'init_' || id, id, 'Standard', server, faction FROM users;

-- 3. Recreate calculator_states with profile_id column.
--    SQLite cannot alter UNIQUE constraints, so we recreate the table.
CREATE TABLE calculator_states_new (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id  TEXT NOT NULL,
  calc_type   TEXT NOT NULL,
  calc_key    TEXT NOT NULL,
  state_json  TEXT NOT NULL,
  updated_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, profile_id, calc_type, calc_key)
);

-- 4. Copy existing states → assign to each user's default profile
INSERT INTO calculator_states_new (id, user_id, profile_id, calc_type, calc_key, state_json, updated_at)
SELECT cs.id, cs.user_id, 'init_' || cs.user_id, cs.calc_type, cs.calc_key, cs.state_json, cs.updated_at
FROM calculator_states cs;

-- 5. Swap tables
DROP TABLE calculator_states;
ALTER TABLE calculator_states_new RENAME TO calculator_states;

-- 6. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_game_profiles_user  ON game_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_calc_states_user    ON calculator_states(user_id);
CREATE INDEX IF NOT EXISTS idx_calc_states_lookup  ON calculator_states(user_id, profile_id, calc_type, calc_key);

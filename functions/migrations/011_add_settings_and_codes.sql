CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('lucky_rose_active', '10');

CREATE TABLE IF NOT EXISTS reward_codes (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  code       TEXT NOT NULL,
  image_key  TEXT,
  expires_at TEXT,
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO reward_codes (id, code, expires_at, added_at) VALUES
  ('legacy_1', 'GOLDBARMALL', '2026-02-08T23:59:59Z', '2026-02-05'),
  ('legacy_2', 'MONDAYBLESS', '2026-02-09T23:59:59Z', '2026-02-09');

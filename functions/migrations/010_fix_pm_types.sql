-- Migration 010: Fix chat_pm column types (sender_id/receiver_id must be TEXT, not INTEGER)
DROP TABLE IF EXISTS chat_pm;

CREATE TABLE IF NOT EXISTS chat_pm (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL CHECK(length(message) <= 500),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_pm_convo    ON chat_pm(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_pm_receiver ON chat_pm(receiver_id, created_at);

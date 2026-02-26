-- Migration 002: Chat Tables
-- Deploy: wrangler d1 execute wild-hoggs-db --remote --file=./functions/migrations/002_add_chat_tables.sql

CREATE TABLE IF NOT EXISTS chat_global (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT NOT NULL,
  faction    TEXT,
  server     TEXT,
  message    TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_server (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  server     TEXT NOT NULL,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT NOT NULL,
  faction    TEXT,
  message    TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_reports (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  chat_type   TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  reported_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT,
  status      TEXT DEFAULT 'open',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_rate_limits (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_msg     TEXT DEFAULT (datetime('now')),
  window_start TEXT DEFAULT (datetime('now')),
  msg_count    INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chat_global_created ON chat_global(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_global_user    ON chat_global(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_server_lookup  ON chat_server(server, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_server_user    ON chat_server(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_reports_status ON chat_reports(status);

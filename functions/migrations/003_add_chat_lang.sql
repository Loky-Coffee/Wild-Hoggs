-- Migration 003: Add language column to chat tables
-- Enables language-specific chat channels (e.g. Global DE, Server 395 DE)
-- NULL = all-languages channel (existing behaviour preserved)
-- Deploy: wrangler d1 execute wild-hoggs-db --remote --file=./functions/migrations/003_add_chat_lang.sql

ALTER TABLE chat_global ADD COLUMN lang TEXT;
ALTER TABLE chat_server ADD COLUMN lang TEXT;

-- Composite indexes for fast lang-filtered queries
CREATE INDEX IF NOT EXISTS idx_chat_global_lang ON chat_global(lang, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_server_lang  ON chat_server(server, lang, created_at);

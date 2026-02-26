-- Migration 001: add server column to users
-- Run: wrangler d1 execute wild-hoggs-db --remote --file=./functions/migrations/001_add_server.sql

ALTER TABLE users ADD COLUMN server TEXT;

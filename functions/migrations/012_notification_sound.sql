-- Add notification_sound preference to users
-- 1 = sound on (default), 0 = sound off
ALTER TABLE users ADD COLUMN notification_sound INTEGER NOT NULL DEFAULT 1;

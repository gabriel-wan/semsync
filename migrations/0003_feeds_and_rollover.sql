-- Which academic year the saved NUSMods link is for: the link itself only says "sem-1" or "sem-2". Every link saved
-- before this was for AY2026/27.
ALTER TABLE users ADD COLUMN nusmods_ay TEXT;
UPDATE users SET nusmods_ay = '2026-2027' WHERE nusmods_link IS NOT NULL;

-- A fingerprint of what the last full sync was built from (the Canvas feed, the NUSMods link, the settings) and when it
-- ran. An hourly run whose fingerprint matches can stop after downloading the Canvas feed.
ALTER TABLE users ADD COLUMN input_hash TEXT;
ALTER TABLE users ADD COLUMN full_sync_at BIGINT;
-- When a sync run took this user on, so two runs at once (a late hourly run and the next) never sync them twice.
ALTER TABLE users ADD COLUMN sync_claimed_at BIGINT;

-- A private subscribe link for Outlook, Apple Calendar and other apps: the SHA-256 of its secret part to look it up by,
-- and the secret itself encrypted, to show the link again.
ALTER TABLE users ADD COLUMN feed_token_hash TEXT;
ALTER TABLE users ADD COLUMN feed_token_enc TEXT;
CREATE UNIQUE INDEX users_feed_token ON users (feed_token_hash) WHERE feed_token_hash IS NOT NULL;

-- Each subscribe link's .ics, gzipped then base64'd, rebuilt by every sync that changes something.
CREATE TABLE feeds (
  user_id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;

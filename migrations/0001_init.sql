CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  canvas_feed_enc TEXT,
  nusmods_link TEXT,
  -- 'main': events go into the user's own calendar. 'shared': a calendar in the app's account, shared with them.
  mode TEXT NOT NULL DEFAULT 'main',
  -- Calendar the events are in: 'primary' in main mode, or the shared calendar's id.
  calendar_id TEXT,
  google_refresh_enc TEXT,
  needs_reconnect INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_sync_at INTEGER,
  last_sync_ok INTEGER,
  last_sync_message TEXT
);
CREATE INDEX users_last_sync ON users (last_sync_at);

-- Events this app has written to each user's calendar, so a sync only sends what changed.
CREATE TABLE synced_events (
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX synced_events_start ON synced_events (user_id, start_ms);

CREATE TABLE module_cache (
  acad_year TEXT NOT NULL,
  code TEXT NOT NULL,
  json TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (acad_year, code)
);

CREATE TABLE kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Only used when FAKE_GOOGLE=1 (local development without Google credentials).
CREATE TABLE fake_calendars (
  id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  shared_with TEXT
);
CREATE TABLE fake_events (
  calendar_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (calendar_id, event_id)
);

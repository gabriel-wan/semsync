-- A sync that was still running when someone deleted their data could write a few rows back for them afterwards:
-- what it had written, a copy of their subscribe link's calendar, and a cached Google access token. Nothing read them,
-- and the sync now only writes for people who still exist (WHILE_USER_EXISTS in src/lib/db.ts). This clears out any
-- left from before.
DELETE FROM synced_events WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM feeds WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM kv WHERE key LIKE 'token:user:%' AND substr(key, 12) NOT IN (SELECT id FROM users);

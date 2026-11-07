-- AI apps (Claude, ChatGPT and others) that read someone's deadlines, classes and exams through the MCP server, with
-- the person's OK. The app signs in with OAuth: it registers itself, the person allows it on Semsync's approval page,
-- and it gets short-lived passes. Codes and passes are kept only as SHA-256 hashes, like subscribe links.

-- Apps that registered themselves (OAuth dynamic client registration). Not tied to anyone until they're allowed.
CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- JSON list of the exact addresses the app may be sent back to after the approval page.
  redirect_uris TEXT NOT NULL,
  -- Set for apps that asked for a client secret; null for apps that use PKCE alone.
  secret_hash TEXT,
  created_at BIGINT NOT NULL
);

-- One row per person per app they allowed: what Settings lists under Connected apps.
CREATE TABLE oauth_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  -- The address it was allowed for, so Settings can say where the app is (an app can register several).
  redirect_uri TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  last_used_at BIGINT,
  -- A per minute count of tool calls, to rate limit each connection.
  window_start BIGINT NOT NULL DEFAULT 0,
  window_calls INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, client_id)
);

-- Codes from the approval page, swapped once for passes within a few minutes.
CREATE TABLE oauth_codes (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  scope TEXT NOT NULL,
  resource TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX oauth_codes_user ON oauth_codes (user_id);

-- Access passes (an hour) and refresh passes (replaced each time they're used). A used refresh pass is kept, as
-- 'refresh_used', until it would have expired, so a second use of it shows it was copied.
CREATE TABLE oauth_tokens (
  hash TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  resource TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX oauth_tokens_grant ON oauth_tokens (grant_id);

ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

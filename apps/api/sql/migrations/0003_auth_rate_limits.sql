CREATE TABLE auth_rate_limits (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

CREATE INDEX auth_rate_limits_window_idx ON auth_rate_limits (window_started_at);
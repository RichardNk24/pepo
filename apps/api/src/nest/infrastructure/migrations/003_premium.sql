CREATE TABLE IF NOT EXISTS premium_access (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('development', 'apple', 'google', 'promotion')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS premium_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'purple' CHECK (theme IN ('purple','mono','classic')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

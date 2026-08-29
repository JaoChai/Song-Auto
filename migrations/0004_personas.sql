CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  song_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_personas_created ON personas (created_at DESC);

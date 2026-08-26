CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  instrumental INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('PENDING','SUCCESS','FAILED')),
  error TEXT,
  r2_key TEXT,
  duration REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_songs_created ON songs (created_at DESC);
CREATE INDEX idx_songs_task ON songs (task_id);

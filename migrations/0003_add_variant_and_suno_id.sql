ALTER TABLE songs ADD COLUMN suno_id TEXT;
ALTER TABLE songs ADD COLUMN variant INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_task_variant ON songs (task_id, variant);

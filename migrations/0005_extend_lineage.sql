ALTER TABLE songs ADD COLUMN parent_song_id TEXT;
ALTER TABLE songs ADD COLUMN continue_at REAL;
CREATE INDEX IF NOT EXISTS idx_songs_parent ON songs (parent_song_id);

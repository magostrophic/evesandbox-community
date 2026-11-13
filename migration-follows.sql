CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,
  followee_id TEXT NOT NULL,
  at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS follows_to ON follows (followee_id, at DESC);
CREATE INDEX IF NOT EXISTS follows_from ON follows (follower_id, at DESC);

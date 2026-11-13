CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  gname TEXT,
  name TEXT,
  created INTEGER NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  banned INTEGER NOT NULL DEFAULT 0,
  username TEXT,
  uname_at INTEGER NOT NULL DEFAULT 0,
  bio TEXT NOT NULL DEFAULT '',
  links TEXT NOT NULL DEFAULT '{}',
  avatar INTEGER NOT NULL DEFAULT 0,
  show_likes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  img_count INTEGER NOT NULL DEFAULT 0,
  img_bytes INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS votes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  value INTEGER NOT NULL,
  at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  reply_id TEXT NOT NULL DEFAULT '',
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_once ON reports (reporter_id, post_id, reply_id);
CREATE INDEX IF NOT EXISTS posts_new ON posts (created DESC, id DESC);
CREATE INDEX IF NOT EXISTS posts_top ON posts (score DESC, created DESC, id DESC);
CREATE INDEX IF NOT EXISTS posts_author ON posts (author_id, created DESC);
CREATE INDEX IF NOT EXISTS replies_post ON replies (post_id, created, id);
CREATE INDEX IF NOT EXISTS replies_author ON replies (author_id, created DESC);
CREATE INDEX IF NOT EXISTS votes_user ON votes (user_id, post_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users (username);
CREATE INDEX IF NOT EXISTS votes_liked ON votes (user_id, value, at DESC, post_id DESC);
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,
  followee_id TEXT NOT NULL,
  at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS follows_to ON follows (followee_id, at DESC);
CREATE INDEX IF NOT EXISTS follows_from ON follows (follower_id, at DESC);

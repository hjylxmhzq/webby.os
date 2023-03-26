-- Your SQL goes here
CREATE TABLE users (
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  user_type INTEGER NOT NULL,
  user_root TEXT NOT NULL,
  PRIMARY KEY (username)
)

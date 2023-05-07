-- Your SQL goes here
CREATE TABLE users (
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  user_type INTEGER NOT NULL,
  user_root TEXT NOT NULL,
  group_name TEXT NOT NULL,
  otp_secret TEXT,
  CONSTRAINT fk_groups
    FOREIGN KEY(group_name) REFERENCES groups(name),
  PRIMARY KEY (username)
)

-- Your SQL goes here
CREATE TABLE groups (
  name TEXT NOT NULL UNIQUE,
  desc TEXT NOT NULL,
  permissions TEXT NOT NULL,
  PRIMARY KEY (name)
)

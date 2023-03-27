-- Your SQL goes here
create table kv_storage (
  username TEXT NOT NULL,
  collection TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  is_private BOOLEAN NOT NULL,
  PRIMARY KEY (collection, key, username)
)

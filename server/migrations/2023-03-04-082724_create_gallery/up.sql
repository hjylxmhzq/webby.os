-- Your SQL goes here
CREATE TABLE file_index (
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  username TEXT NOT NULL,
  size BIGINT NOT NULL,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  format TEXT,
  is_dir BOOLEAN NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (file_path, updated_at)
)

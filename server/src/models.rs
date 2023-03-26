use crate::schema::*;
use diesel::prelude::*;
use serde::Serialize;


#[derive(Queryable)]
#[diesel(table_name = users)]
pub struct User {
  pub username: String,
  pub password: String,
  pub email: String,
  pub user_type: i32,
  pub user_root: String,
}

#[derive(Insertable)]
#[diesel(table_name = users)]
pub struct NewUser<'a> {
  pub username: &'a str,
  pub password: &'a str,
  pub email: &'a str,
  pub user_type: i32,
  pub user_root: &'a str,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = file_index)]
pub struct NewFileIndex {
  pub file_name: String,
  pub file_path: String,
  pub username: String,
  pub size: i64,
  pub created_at: String,
  pub modified_at: String,
  pub format: Option<String>,
  pub is_dir: bool,
  pub updated_at: String,
}

#[derive(Queryable, Debug, Serialize, QueryableByName)]
#[diesel(table_name = file_index)]
pub struct FileIndex {
  pub file_name: String,
  pub file_path: String,
  pub username: String,
  pub size: i64,
  pub created_at: String,
  pub modified_at: String,
  pub format: Option<String>,
  pub is_dir: bool,
  pub updated_at: String,
}

#[derive(Queryable, Debug, Serialize, QueryableByName)]
#[diesel(table_name = file_index)]
pub struct FileIndexSizeCount {
  pub size: i64,
  pub username: String,
  pub format: Option<String>,
  pub is_dir: bool,
}

#[derive(Queryable, Debug, Serialize, QueryableByName)]
#[diesel(table_name = file_index)]
pub struct FileIndexLastUpdatedAt {
  pub updated_at: String,
}

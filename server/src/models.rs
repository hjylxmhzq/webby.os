use crate::schema::*;
use diesel::prelude::*;
use serde::Serialize;


#[derive(Serialize, Queryable)]
#[diesel(table_name = users)]
pub struct User {
  pub username: String,
  pub password: String,
  pub email: String,
  pub user_type: i32,
  pub user_root: String,
  pub group_name: String,
}

#[derive(Serialize, Queryable)]
#[diesel(table_name = groups)]
pub struct Group {
  pub name: String,
  pub desc: String,
  pub permissions: String,
}

#[derive(Insertable)]
#[diesel(table_name = groups)]
pub struct NewGroup {
  pub name: String,
  pub desc: String,
  pub permissions: String,
}

#[derive(Insertable)]
#[diesel(table_name = users)]
pub struct NewUser<'a> {
  pub username: &'a str,
  pub password: &'a str,
  pub email: &'a str,
  pub user_type: i32,
  pub user_root: &'a str,
  pub group_name: &'a str,
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

#[derive(Queryable, Debug, Serialize, Insertable)]
#[diesel(table_name = kv_storage)]
pub struct NewKvStorage<'a> {
  pub username: &'a str,
  pub collection: &'a str,
  pub key: &'a str,
  pub value: &'a str,
  pub is_private: bool,
}

#[derive(Queryable, Debug, Serialize, Insertable)]
#[diesel(table_name = kv_storage)]
pub struct KvStorageDoc {
  pub username: String,
  pub collection: String,
  pub key: String,
  pub value: String,
  pub is_private: bool,
}

#[derive(Queryable, Debug, Serialize, QueryableByName)]
#[diesel(table_name = kv_storage)]
pub struct KvStorageDocOnlyCollection {
  pub username: String,
  pub collection: String,
}

#[derive(Queryable, Debug, Serialize, QueryableByName)]
#[diesel(table_name = kv_storage)]
pub struct KvStorageDocNoValue {
  pub username: String,
  pub collection: String,
  pub key: String,
  pub is_private: bool,
}


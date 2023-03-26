use diesel::SqliteConnection;

use crate::models::FileIndex;

use super::error::AppError;

pub fn get_all_images(db: &mut SqliteConnection, username_: &str) -> Result<Vec<FileIndex>, AppError> {
  use crate::schema::file_index::dsl::*;
  use diesel::prelude::*;

  let exists = file_index.filter(format.like("%image%").and(username.eq(username_))).load::<FileIndex>(db)?;
  Ok(exists)
}

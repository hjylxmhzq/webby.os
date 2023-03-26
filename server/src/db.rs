use std::sync::{Arc, Mutex};

use diesel::SqliteConnection;
use lazy_static::lazy_static;

use crate::connect_db;

lazy_static! {
  pub static ref SHARED_DB_CONN: Arc<Mutex<SqliteConnection>> = {
    let conn = connect_db();
    Arc::new(Mutex::new(conn))
  };
}

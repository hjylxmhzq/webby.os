use diesel::prelude::*;
use diesel::{RunQueryDsl, SqliteConnection};
use lazy_static::lazy_static;
use serde::Serialize;
use std::{
  collections::HashMap,
  sync::{Arc, Mutex},
  time::Duration,
};

#[derive(Debug, Clone, Serialize)]
pub struct OneTimeTokenInfo {
  pub token: String,
  pub create_user: String,
  pub expire_secs: u64,
  pub module_prefix: String,
  pub extra: Option<String>,
}

lazy_static! {
  pub static ref ONETIME_TOKENS: Arc<Mutex<HashMap<String, OneTimeTokenInfo>>> =
    Arc::new(Mutex::new(HashMap::new()));
}

use crate::conv_err;
use crate::{
  db::SHARED_DB_CONN,
  models::{Group, NewGroup, NewUser, User},
  schema,
  utils::crypto::hash_pwd,
};

use super::error::AppError;

conv_err!(thotp::ThotpError);

pub fn enable_otp(user: &str, secret: &str, code: &str) -> Result<bool, AppError> {
  use crate::schema::users::dsl::*;

  let mut db_mutex = SHARED_DB_CONN.lock().unwrap();

  let db = &mut *db_mutex;

  let (success, _) = thotp::verify_totp(code, secret.as_bytes(), 0)?;

  if success {
    let effected = diesel::update(users.filter(username.eq(user)))
      .set(otp_secret.eq(secret))
      .execute(db)?;
    return Ok(effected > 0);
  }

  Ok(success)
}

pub fn verify_otp(user: &str, code: &str) -> Result<bool, AppError> {
  use crate::schema::users::dsl::*;

  let mut db_mutex = SHARED_DB_CONN.lock().unwrap();

  let db = &mut *db_mutex;
  let user_list = users
    .filter(username.eq(user))
    .load::<crate::models::User>(db)?;
  
  if user_list.len() > 0 {
    let user = &user_list[0];
    match &user.otp_secret {
        Some(s) => {
          let (success, _) = thotp::verify_totp(code, s.as_bytes(), 0)?;
          return Ok(success);
        }
        None => {
          return Ok(true)
        }
    }
  }
  return Ok(false);
}

pub fn is_otp_enabled(user: &str) -> Result<bool, AppError> {
  use crate::schema::users::dsl::*;

  let mut db_mutex = SHARED_DB_CONN.lock().unwrap();

  let db = &mut *db_mutex;
  let user_list = users
    .filter(username.eq(user))
    .load::<crate::models::User>(db)?;
  
  if user_list.len() > 0 {
    let user = &user_list[0];
    return Ok(match user.otp_secret {
        Some(_) => true,
        None => false
    });
  }
  return Ok(false);
}

pub fn disbale_otp(user: &str) -> Result<bool, AppError> {
  use crate::schema::users::dsl::*;

  let mut db_mutex = SHARED_DB_CONN.lock().unwrap();

  let db = &mut *db_mutex;
  let effected = diesel::update(users.filter(username.eq(user)))
  .set(otp_secret.eq(Option::<String>::None))
  .execute(db)?;

  return Ok(effected > 0);
}

pub fn auto_create_user_group(db: &mut SqliteConnection) {
  use crate::schema::groups::dsl::*;
  let group = groups.first::<Group>(db);
  if let Ok(_) = group {
    return ();
  }
  diesel::insert_into(schema::groups::table)
    .values(vec![
      NewGroup {
        name: "admin".to_owned(),
        desc: "administrator group".to_owned(),
        permissions: "all".to_owned(),
      },
      NewGroup {
        name: "guest".to_owned(),
        desc: "guest group".to_owned(),
        permissions: "none".to_owned(),
      },
    ])
    .execute(db)
    .unwrap();
  println!("create admin group autmatically");
}

pub fn auto_create_user(db: &mut SqliteConnection) {
  use crate::schema::users::dsl::*;
  let user = users.first::<User>(db);
  if let Ok(_) = user {
    return ();
  }
  let err = user.unwrap_err();
  if err != diesel::NotFound {
    panic!("create admin autmatically failed {:#?}", err);
  }
  diesel::insert_into(schema::users::table)
    .values(NewUser {
      username: "admin",
      password: &hash_pwd("admin"),
      email: "",
      user_type: 0,
      user_root: "",
      group_name: "admin",
    })
    .execute(db)
    .unwrap();
  println!("create admin autmatically");
}

pub fn create_one_time_token(
  user: &str,
  module_prefix: &str,
  expire_secs: u64,
) -> OneTimeTokenInfo {
  let t = OneTimeTokenInfo {
    token: uuid::Uuid::new_v4().to_string(),
    create_user: user.to_owned(),
    module_prefix: module_prefix.to_owned(),
    expire_secs,
    extra: None,
  };
  let token = t.token.clone();
  ONETIME_TOKENS
    .lock()
    .unwrap()
    .insert(token.clone(), t.clone());
  let c = ONETIME_TOKENS.clone();
  tokio::spawn(async move {
    tokio::time::sleep(Duration::from_secs(expire_secs)).await;
    c.lock().unwrap().remove(&token).unwrap();
  });
  t
}

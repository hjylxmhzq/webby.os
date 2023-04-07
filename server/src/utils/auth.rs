use std::{
  collections::HashMap,
  sync::{Arc, Mutex},
  time::Duration,
};

use diesel::{RunQueryDsl, SqliteConnection};
use lazy_static::lazy_static;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct OneTimeTokenInfo {
  pub token: String,
  pub create_user: String,
  pub expire_secs: u64,
  pub module_prefix: String,
  pub extra: Option<String>,
}

lazy_static! {
  pub static ref ONETIME_TOKENS: Arc<Mutex<HashMap<String, OneTimeTokenInfo>>> = Arc::new(Mutex::new(HashMap::new()));
}

use crate::{
  models::{Group, NewGroup, NewUser, User},
  schema,
  utils::crypto::hash_pwd,
};

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

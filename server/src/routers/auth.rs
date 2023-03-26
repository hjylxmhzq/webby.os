use actix_session::Session;
use diesel::prelude::*;
use std::borrow::Borrow;

use actix_web::{http::StatusCode, web, HttpResponse, Scope};
use serde::Deserialize;

use crate::{
  models::NewUser,
  models::User as TUser,
  schema,
  utils::{
    auth::create_one_time_token,
    crypto::hash_pwd,
    error::AppError,
    response::{create_resp, EmptyResponseData},
    session::SessionUtils,
  },
  AppData, UserSessionData,
};

#[derive(Deserialize)]
pub struct User {
  name: String,
  password: String,
}

#[derive(Deserialize)]
pub struct RegisterUser {
  name: String,
  password: String,
  email: String,
}

pub fn login_fake_user(sess: Session) -> Result<bool, AppError> {
  let name = "admin";

  let user_data = sess.get::<UserSessionData>("user")?;

  match user_data {
    Some(mut user_data) => {
      user_data.is_login = true;
      user_data.user_root = "".to_owned();
      sess.insert("user", user_data)?;
    }
    None => {
      let new_user_data = UserSessionData::new(name, "");
      sess.insert("user", new_user_data)?;
    }
  }
  Ok(true)
}

pub async fn login(
  body: web::Json<User>,
  data: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  use crate::schema::users::dsl::*;

  let name = &body.borrow().name;
  let pwd = &body.borrow().password;
  let hashed_pwd = hash_pwd(pwd);
  let state = data.borrow().write().unwrap();

  let mut db_mutex = state.db.lock().await;

  let db = &mut *db_mutex;

  let user = users
    .filter(username.eq(name).and(password.eq(hashed_pwd)))
    .load::<TUser>(db)?;

  drop(db_mutex);

  if user.len() == 0 {
    return Ok(create_resp(
      false,
      EmptyResponseData::new(),
      "password error or user not exists",
    ));
  }

  let user_data = sess.get::<UserSessionData>("user")?;

  let user = user.get(0).unwrap();
  match user_data {
    Some(mut user_data) => {
      user_data.is_login = true;
      user_data.user_root = user.user_root.clone();
      sess.insert("user", user_data)?;
    }
    None => {
      let new_user_data = UserSessionData::new(&user.username, &user.user_root);
      sess.insert("user", new_user_data)?;
    }
  }

  Ok(create_resp(true, EmptyResponseData::new(), "done"))
}

#[derive(Deserialize)]
pub struct ResetPasswordReq {
  pub old_password: String,
  pub new_password: String,
}

pub async fn reset_password(
  body: web::Json<ResetPasswordReq>,
  data: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  use crate::schema::users::dsl::*;

  let old_pwd = &body.borrow().old_password;
  let pwd = &body.borrow().new_password;
  let hashed_old_pwd = hash_pwd(old_pwd);
  let hashed_pwd = hash_pwd(pwd);
  let state = data.borrow().write().unwrap();
  let user_data = sess.get_user_data()?;
  let name = &user_data.username;

  let mut db_mutex = state.db.lock().await;

  let db = &mut *db_mutex;

  let user = users
    .filter(username.eq(name).and(password.eq(&hashed_old_pwd)))
    .load::<TUser>(db)?;

  if user.len() == 0 {
    return Ok(create_resp(
      false,
      EmptyResponseData::new(),
      "old password error",
    ));
  }

  diesel::update(users.filter(username.eq(name).and(password.eq(&hashed_old_pwd))))
    .set(password.eq(hashed_pwd))
    .execute(db)?;

  return logout(sess).await;
}

pub async fn logout(sess: Session) -> Result<HttpResponse, AppError> {
  let user_data = sess.get::<UserSessionData>("user")?;

  match user_data {
    Some(mut user_data) => {
      user_data.is_login = false;
      sess.insert("user", user_data)?;
    }
    None => {
      return Err(AppError::new("user is not login").with_status(StatusCode::FORBIDDEN));
    }
  }

  Ok(create_resp(true, EmptyResponseData::new(), "done"))
}

pub async fn register(
  body: web::Json<RegisterUser>,
  data: web::Data<AppData>,
) -> Result<HttpResponse, AppError> {
  let name = &body.borrow().name;
  let pwd = &body.borrow().password;
  let hashed_pwd = hash_pwd(pwd);
  let email = &body.borrow().email;
  let state = data.borrow().write().unwrap();

  let mut conn = state.db.lock().await;
  let conn = &mut *conn;

  diesel::insert_into(schema::users::table)
    .values(NewUser {
      username: name,
      password: &hashed_pwd,
      email,
      user_type: 1,
      user_root: "",
    })
    .execute(conn)?;

  Ok(create_resp(true, EmptyResponseData::new(), "done"))
}

#[derive(Debug, Deserialize)]
pub struct OneTimeTokenReq {
  pub module_prefix: String,
}

pub async fn request_one_time_token(
  sess: Session,
  body: web::Json<OneTimeTokenReq>,
) -> Result<HttpResponse, AppError> {
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();
  let module_prefix = &body.module_prefix;
  let token = create_one_time_token(&user_data.username.clone(), module_prefix, 60 * 5);
  Ok(create_resp(true, token, "done"))
}

pub fn auth_routers() -> Scope {
  web::scope("/auth")
    .route("/login", web::post().to(login))
    .route("/reset_password", web::post().to(reset_password))
    .route("/register", web::post().to(register))
    .route("/logout", web::post().to(logout))
    .route(
      "/request_one_time_token",
      web::post().to(request_one_time_token),
    )
}

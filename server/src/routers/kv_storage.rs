use std::borrow::Borrow;

use actix_session::Session;
use actix_web::{web, Scope};
use diesel::sql_types::Text;
use serde::Deserialize;

use crate::{
  db::SHARED_DB_CONN,
  models::{KvStorageDoc, NewKvStorage, KvStorageDocOnlyCollection, KvStorageDocNoValue},
  utils::{
    error::AppError,
    response::{create_resp, EmptyResponseData},
  },
  UserSessionData,
};

#[derive(Deserialize)]
struct KvSet {
  collection: String,
  key: String,
  value: String,
}

async fn set(body: web::Json<KvSet>, sess: Session) -> Result<actix_web::HttpResponse, AppError> {
  use crate::schema::kv_storage::dsl::*;
  use crate::schema::kv_storage::table;
  use diesel::prelude::*;
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();

  let _username = &user_data.username;
  let body = body.borrow();
  let _collection = &body.collection;
  let _key = &body.key;
  let _value = &body.value;
  let v = NewKvStorage {
    collection: _collection,
    key: _key,
    value: _value,
    username: _username,
    is_private: true,
  };

  let mut conn = SHARED_DB_CONN.lock().unwrap();

  let updated = diesel::update(
    kv_storage.filter(
      username
        .eq(_username)
        .and(collection.eq(_collection).and(key.eq(_key))),
    ),
  )
  .set(value.eq(_value))
  .execute(&mut *conn)?;

  if updated == 0 {
    diesel::insert_into(table).values(v).execute(&mut *conn)?;
  }
  let resp = create_resp(true, EmptyResponseData::new(), "Done");
  Ok(resp)
}

#[derive(Deserialize)]
struct KvGet {
  collection: String,
  key: String,
}

async fn get(body: web::Json<KvGet>, sess: Session) -> Result<actix_web::HttpResponse, AppError> {
  use crate::schema::kv_storage::dsl::*;
  use diesel::prelude::*;
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();

  let _username = &user_data.username;
  let body = body.borrow();
  let _collection = &body.collection;
  let _key = &body.key;

  let mut conn = SHARED_DB_CONN.lock().unwrap();
  let result = kv_storage
    .filter(
      username
        .eq(_username)
        .and(collection.eq(_collection).and(key.eq(_key))),
    )
    .load::<KvStorageDoc>(&mut *conn)?;
  let resp = create_resp(true, result, "Done");
  Ok(resp)
}

async fn remove(
  body: web::Json<KvGet>,
  sess: Session,
) -> Result<actix_web::HttpResponse, AppError> {
  use crate::schema::kv_storage::dsl::*;
  use diesel::prelude::*;
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();

  let _username = &user_data.username;
  let body = body.borrow();
  let _collection = &body.collection;
  let _key = &body.key;

  let mut conn = SHARED_DB_CONN.lock().unwrap();
  let r = diesel::delete(
    kv_storage.filter(
      username
        .eq(_username)
        .and(collection.eq(_collection).and(key.eq(_key))),
    ),
  )
  .execute(&mut *conn)?;

  let result = if r > 0 { true } else { false };
  let resp = create_resp(true, result, "Done");
  Ok(resp)
}

#[derive(Deserialize)]
struct KvDeleteCollection {
  collection: String,
}
async fn remove_collection(
  body: web::Json<KvDeleteCollection>,
  sess: Session,
) -> Result<actix_web::HttpResponse, AppError> {
  use crate::schema::kv_storage::dsl::*;
  use diesel::prelude::*;
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();

  let _username = &user_data.username;
  let body = body.borrow();
  let _collection = &body.collection;

  let mut conn = SHARED_DB_CONN.lock().unwrap();
  let r = diesel::delete(kv_storage.filter(username.eq(_username).and(collection.eq(_collection))))
    .execute(&mut *conn)?;

  let result = if r > 0 { true } else { false };
  let resp = create_resp(true, result, "Done");
  Ok(resp)
}

async fn collections(
  sess: Session,
) -> Result<actix_web::HttpResponse, AppError> {
  use diesel::prelude::*;
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();

  let _username = &user_data.username;

  let mut conn = SHARED_DB_CONN.lock().unwrap();

  let r = diesel::sql_query("select DISTINCT collection, username from kv_storage where username = ?")
    .bind::<Text, _>(_username)
    .load::<KvStorageDocOnlyCollection>(&mut *conn)?;

  let r: Vec<String> = r.into_iter().map(|v| v.collection).collect();

  let resp = create_resp(true, r, "Done");
  Ok(resp)
}
#[derive(Deserialize)]
struct KvHas {
  collection: String,
  key: String,
}

async fn has(body: web::Json<KvHas>, sess: Session) -> Result<actix_web::HttpResponse, AppError> {
  use crate::schema::kv_storage::dsl::*;
  use diesel::prelude::*;
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();

  let _username = &user_data.username;
  let body = body.borrow();
  let _collection = &body.collection;
  let _key = &body.key;

  let mut conn = SHARED_DB_CONN.lock().unwrap();
  let result = kv_storage
    .filter(
      username
        .eq(_username)
        .and(collection.eq(_collection).and(key.eq(_key))),
    )
    .load::<KvStorageDoc>(&mut *conn)?;

  let exist = if result.len() > 0 { true } else { false };

  let resp = create_resp(true, exist, "Done");

  Ok(resp)
}

#[derive(Deserialize)]
struct KvKeys {
  collection: String,
}
async fn keys(body: web::Json<KvKeys>, sess: Session) -> Result<actix_web::HttpResponse, AppError> {
  use diesel::prelude::*;
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();

  let _username = &user_data.username;
  let body = body.borrow();
  let _collection = &body.collection;

  let mut conn = SHARED_DB_CONN.lock().unwrap();

  let r = diesel::sql_query("select collection, key, username, is_private from kv_storage where username = ? AND collection = ?")
  .bind::<Text, _>(_username)
  .bind::<Text, _>(_collection)
  .load::<KvStorageDocNoValue>(&mut *conn)?;

  let result: Vec<String> = r.into_iter().map(|doc| return doc.key).collect();

  let resp = create_resp(true, result, "Done");

  Ok(resp)
}

#[derive(Deserialize)]
struct KvValues {
  collection: String,
}
async fn values(
  body: web::Json<KvValues>,
  sess: Session,
) -> Result<actix_web::HttpResponse, AppError> {
  use crate::schema::kv_storage::dsl::*;
  use diesel::prelude::*;
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();

  let _username = &user_data.username;
  let body = body.borrow();
  let _collection = &body.collection;

  let mut conn = SHARED_DB_CONN.lock().unwrap();
  let result = kv_storage
    .filter(username.eq(_username).and(collection.eq(_collection)))
    .load::<KvStorageDoc>(&mut *conn)?;

  let result: Vec<String> = result.into_iter().map(|doc| return doc.value).collect();

  let resp = create_resp(true, result, "Done");

  Ok(resp)
}

pub fn kv_storage_routers() -> Scope {
  web::scope("/kv_storage")
    .route("/set", web::post().to(set))
    .route("/get", web::post().to(get))
    .route("/has", web::post().to(has))
    .route("/remove", web::post().to(remove))
    .route("/remove_collection", web::post().to(remove_collection))
    .route("/collections", web::post().to(collections))
    .route("/keys", web::post().to(keys))
    .route("/values", web::post().to(values))
}

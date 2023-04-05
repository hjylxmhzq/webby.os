use std::{
  borrow::Borrow,
  collections::HashMap,
  sync::Mutex,
  time::{Duration, Instant},
};

use actix::{Actor, Addr, AsyncContext, Handler, StreamHandler};
use actix_session::Session;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use actix_web_actors::ws;
use diesel::sql_types::Text;
use serde::{Deserialize, Serialize};

use crate::{
  db::SHARED_DB_CONN,
  models::{KvStorageDoc, KvStorageDocNoValue, KvStorageDocOnlyCollection, NewKvStorage},
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
  let conn_map = WS_CONNS.lock().unwrap();
  let conn = conn_map.get(_username);
  if let Some(conn_info) = conn {
    let keys = conn_info.collections.get(_collection);
    if let Some(keys) = keys {
      if keys.contains(_key) {
        let msg = ws_msg(_collection, _key, Some(_value), None);
        conn_info.addr.do_send(msg);
      }
    }
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

  let result = if r > 0 {
    let conn_map = WS_CONNS.lock().unwrap();
    let conn = conn_map.get(_username);
    if let Some(conn_info) = conn {
      let keys = conn_info.collections.get(_collection);
      if let Some(keys) = keys {
        if keys.contains(_key) {
          let msg = ws_msg(_collection, _key, None, None);
          conn_info.addr.do_send(msg);
        }
      }
    }
    true
  } else {
    false
  };
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

async fn collections(sess: Session) -> Result<actix_web::HttpResponse, AppError> {
  use diesel::prelude::*;
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();

  let _username = &user_data.username;

  let mut conn = SHARED_DB_CONN.lock().unwrap();

  let r =
    diesel::sql_query("select DISTINCT collection, username from kv_storage where username = ?")
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

#[derive(Debug)]
struct ConnInfo {
  addr: Addr<MyWs>,
  collections: HashMap<String, Vec<String>>, // {[collection_name]: [keys...]}
}

lazy_static::lazy_static! {
  static ref WS_CONNS: Mutex<HashMap<String, ConnInfo>> = {
    Mutex::new(HashMap::new())
  };
}

#[derive(actix::Message, Debug)]
#[rtype(result = "String")] // result = your type T
struct WsTextMessage(String);

impl Handler<WsTextMessage> for MyWs {
  type Result = String; // This type is T

  fn handle(&mut self, msg: WsTextMessage, ctx: &mut Self::Context) -> Self::Result {
    // Returns your type T
    ctx.text(msg.0);
    return "".to_owned();
  }
}

#[derive(Serialize)]
struct WsMsg {
  collection: String,
  key: String,
  value: Option<String>,
  old_value: Option<String>,
}
fn ws_msg(collection: &str, key: &str, value: Option<&str>, old_value: Option<&str>) -> WsTextMessage {
  let msg = WsMsg {
    collection: collection.to_owned(),
    key: key.to_owned(),
    value: value.map(|v| v.to_owned()).to_owned(),
    old_value: old_value.map(|v| v.to_owned()),
  };
  let json = serde_json::to_string(&msg).unwrap();
  WsTextMessage(json)
}

/// Define HTTP actor
struct MyWs {
  hb: Instant,
  user: String,
}

impl Actor for MyWs {
  type Context = ws::WebsocketContext<Self>;
}

impl MyWs {
  fn new(user: &str) -> Self {
    Self {
      hb: Instant::now(),
      user: user.to_owned(),
    }
  }
}

#[derive(actix::Message)]
#[rtype(result = "String")] // result = your type T
pub struct WsMessage(Vec<u8>);

impl Handler<WsMessage> for MyWs {
  type Result = String; // This type is T

  fn handle(&mut self, msg: WsMessage, ctx: &mut Self::Context) -> Self::Result {
    // Returns your type T
    ctx.binary(msg.0);
    return "".to_owned();
  }
}

#[derive(Deserialize, Debug)]
struct WsClientMessage {
  r#type: String,
  collections: Option<HashMap<String, Vec<String>>>,
}

/// Handler for ws::Message message
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for MyWs {
  fn started(&mut self, ctx: &mut Self::Context) {
    self.hb = Instant::now();
    ctx.run_interval(std::time::Duration::from_secs(10), |act, ctx| {
      let now = Instant::now();
      if now.duration_since(act.hb) > Duration::from_secs(60) {
        ctx.close(None);
      }
      ctx.ping(b"PING");
    });
    let addr = ctx.address();
    let info = ConnInfo {
      addr,
      collections: HashMap::new(),
    };
    WS_CONNS.lock().unwrap().insert(self.user.clone(), info);
  }
  fn finished(&mut self, ctx: &mut Self::Context) {
    WS_CONNS.lock().unwrap().remove(&self.user);
    ctx.close(None);
  }

  fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
    match msg {
      Ok(ws::Message::Ping(msg)) => {
        self.hb = Instant::now();
        ctx.pong(&msg)
      }
      Ok(ws::Message::Pong(_)) => {
        self.hb = Instant::now();
      }
      Ok(ws::Message::Text(text)) => {
        let info = serde_json::from_str::<WsClientMessage>(&text.to_string());
        if let Ok(info) = info {
          if info.r#type == "subscribe" {
            let mut conn = WS_CONNS.lock().unwrap();
            let conn_info = conn.get_mut(&self.user);
            if let Some(conn_info) = conn_info {
              if let Some(collections) = info.collections {
                for key in collections {
                  conn_info.collections.insert(key.0, key.1);
                }
              }
            }
          }
        }
        ctx.text("{}");
      }
      Ok(ws::Message::Binary(_)) => {
        ctx.text("{}");
      }
      _ => (),
    }
  }
}

async fn subscribe(
  req: HttpRequest,
  stream: web::Payload,
  sess: Session,
) -> Result<HttpResponse, actix_web::error::Error> {
  let user_data = sess.get::<UserSessionData>("user")?.unwrap();
  let _username = &user_data.username;
  let resp = ws::start(MyWs::new(_username), &req, stream);
  resp
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

pub fn kv_storage_ws_routers() -> Scope {
  web::scope("/websocket/kv_storage").route("/subscribe", web::get().to(subscribe))
}

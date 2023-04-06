use std::{
  collections::HashMap,
  sync::Mutex,
  time::{Duration, Instant},
};

use actix::{Actor, Addr, AsyncContext, Handler, StreamHandler};
use actix_web::{
  web::{self, Bytes},
  HttpRequest, HttpResponse, Scope,
};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug)]
struct ConnInfo {
  addr: Addr<MyWs>,
}

lazy_static::lazy_static! {
  static ref WS_CONNS: Mutex<HashMap<String, HashMap<Uuid, ConnInfo>>> = {
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
  r#type: String,
  content: String,
}
fn ws_msg(r#type: &str, content: &str) -> WsTextMessage {
  let msg = WsMsg {
    r#type: r#type.to_owned(),
    content: content.to_owned(),
  };
  let json = serde_json::to_string(&msg).unwrap();
  WsTextMessage(json)
}

/// Define HTTP actor
struct MyWs {
  hb: Instant,
  key: String, // 加入的队列名称
  id: Uuid,
}

impl Actor for MyWs {
  type Context = ws::WebsocketContext<Self>;
}

impl MyWs {
  fn new(key: &str, id: &Uuid) -> Self {
    Self {
      hb: Instant::now(),
      key: key.to_owned(),
      id: id.clone(),
    }
  }
}

#[derive(actix::Message)]
#[rtype(result = "String")] // result = your type T
pub struct WsMessage(Bytes);

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
  content: String,
}

/// Handler for ws::Message message
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for MyWs {
  fn started(&mut self, ctx: &mut Self::Context) {
    self.hb = Instant::now();
    ctx.run_interval(std::time::Duration::from_secs(10), |act, ctx| {
      let now = Instant::now();
      if now.duration_since(act.hb) > Duration::from_secs(60) {
        let mut conn = WS_CONNS.lock().unwrap();
        let queue_list = conn.get_mut(&act.key);
        if let Some(queue_list) = queue_list {
          queue_list.remove(&act.id);
          if queue_list.len() == 0 {
            conn.remove(&act.key);
          }
        }
        ctx.close(None);
      }
      ctx.ping(b"PING");
    });
    let addr = ctx.address();
    let info = ConnInfo { addr };
    let mut conn = WS_CONNS.lock().unwrap();
    let entry = conn.entry(self.key.clone()).or_insert(HashMap::new());
    entry.insert(self.id.clone(), info);
  }
  fn finished(&mut self, ctx: &mut Self::Context) {
    let mut conn = WS_CONNS.lock().unwrap();
    let queue_list = conn.get_mut(&self.key);
    if let Some(queue_list) = queue_list {
      queue_list.remove(&self.id);
      if queue_list.len() == 0 {
        conn.remove(&self.key);
      }
    }
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
          if info.r#type == "message" {
            let mut conn = WS_CONNS.lock().unwrap();
            let conn_info = conn.get_mut(&self.key);
            if let Some(conn_info) = conn_info {
              for (id, addr) in conn_info.iter() {
                if &self.id != id {
                  addr.addr.do_send(ws_msg("message", &info.content));
                }
              }
            }
          }
        }
        ctx.text("{}");
      }
      Ok(ws::Message::Binary(bin)) => {
        let mut conn = WS_CONNS.lock().unwrap();
        let conn_info = conn.get_mut(&self.key);
        if let Some(conn_info) = conn_info {
          for (id, addr) in conn_info.iter() {
            if &self.id != id {
              addr.addr.do_send(WsMessage(bin.clone()));
            }
          }
        }
      }
      _ => (),
    }
  }
}

#[derive(Deserialize)]
pub struct JoinMessageQueue {
  key: String,
}
async fn join(
  req: HttpRequest,
  query: web::Query<JoinMessageQueue>,
  stream: web::Payload,
) -> Result<HttpResponse, actix_web::error::Error> {
  let key = query.key.clone();
  let id = Uuid::new_v4();
  let resp = ws::start(MyWs::new(&key, &id), &req, stream);
  resp
}

pub fn message_queue_routers() -> Scope {
  web::scope("/websocket/message_queue").route("/join", web::get().to(join))
}

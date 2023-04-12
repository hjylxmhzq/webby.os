use std::{
  io::{Read, Write},
  net::TcpStream,
  thread,
  time::{Duration, Instant},
};

use actix::{Actor, AsyncContext, Handler, StreamHandler};
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use bytes::Bytes;
use image::EncodableLayout;
use serde::Deserialize;

use crate::utils::error::AppError;

/// Define HTTP actor
#[allow(unused)]
struct MyWs {
  remote: String,
  stream: TcpStream,
  hb: Instant,
}

impl Actor for MyWs {
  type Context = ws::WebsocketContext<Self>;
}

impl MyWs {
  fn new(remote: &str) -> Result<Self, AppError> {
    let stream = TcpStream::connect(remote)?;
    Ok(Self {
      remote: remote.to_owned(),
      stream,
      hb: Instant::now(),
    })
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

#[derive(actix::Message)]
#[rtype(result = "String")] // result = your type T
pub struct WsTextMessage(String);

impl Handler<WsTextMessage> for MyWs {
  type Result = String; // This type is T

  fn handle(&mut self, msg: WsTextMessage, ctx: &mut Self::Context) -> Self::Result {
    // Returns your type T
    ctx.text(msg.0);
    return "".to_owned();
  }
}

/// Handler for ws::Message message
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for MyWs {
  fn started(&mut self, ctx: &mut Self::Context) {
    self.hb = Instant::now();
    ctx.run_interval(std::time::Duration::from_secs(10), |act, ctx| {
      let now = Instant::now();
      if now.duration_since(act.hb) > Duration::from_secs(60) {
        act.stream.shutdown(std::net::Shutdown::Both).ok();
        ctx.close(None);
      }
      ctx.ping(b"PING");
    });

    let mut stream = self.stream.try_clone().unwrap();

    let addr = ctx.address();

    thread::spawn(move || {
      let mut buf = [0; 4096];
      while let Ok(size) = stream.read(&mut buf) {
        if size == 0 {
          break;
        }
        let bb = buf[0..size].to_vec();
        let b = bytes::Bytes::from(bb);
        addr.do_send(WsMessage(b));
      }
    });
  }

  fn finished(&mut self, _: &mut Self::Context) {
    self.stream.shutdown(std::net::Shutdown::Both).ok();
  }

  fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
    match msg {
      Ok(ws::Message::Close(_)) => {
        ctx.close(None);
      }
      Ok(ws::Message::Ping(msg)) => {
        self.hb = Instant::now();
        ctx.pong(&msg)
      }
      Ok(ws::Message::Pong(_)) => {
        self.hb = Instant::now();
      }
      Ok(ws::Message::Text(text)) => {
        self.stream.write(text.as_bytes()).ok();
      }
      Ok(ws::Message::Binary(bin)) => {
        self.stream.write(bin.as_bytes()).ok();
      }
      _ => (),
    }
  }
}

#[derive(Deserialize)]
pub struct WebsockifyReq {
  remote: String,
}

pub async fn websockify(
  query: web::Query<WebsockifyReq>,
  req: HttpRequest,
  stream: web::Payload,
) -> Result<HttpResponse, Error> {
  let remote = &query.remote;
  let resp = ws::start(MyWs::new(remote)?, &req, stream);
  resp
}

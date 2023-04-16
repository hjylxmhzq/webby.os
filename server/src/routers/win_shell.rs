use std::{
  io::{Read, Write},
  thread,
  time::{Duration, Instant}, str::FromStr,
};

use actix::{Actor, AsyncContext, Handler, StreamHandler};
use actix_web::{web, Error, HttpRequest, HttpResponse, Scope};
use actix_web_actors::ws;
use serde::Deserialize;
use std::ffi::OsString;

use crate::{utils::error::AppError, config};

/// Define HTTP actor
struct MyWs {
  // child: Option<Child>,
  process: Option<conpty::Process>,
  hb: Instant,
}

impl Actor for MyWs {
  type Context = ws::WebsocketContext<Self>;
}

impl MyWs {
  fn new() -> Self {
    Self {
      // child: None,
      process: None,
      hb: Instant::now(),
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

#[derive(Deserialize)]
struct ClientMessage {
  r#type: String,
  payload: String,
}

#[derive(Deserialize)]
struct SetTTYSizePayload {
  rows: u16,
  cols: u16,
}

fn find_shell() -> Result<OsString, AppError> {
  let default_shell = config!(shell);
  if let Ok(shell) = which::which(default_shell) {
    return Ok(OsString::from_str(shell.to_str().unwrap()).unwrap());
  }
  let candidates = vec!["powershell", "cmd"];
  let list: Vec<OsString> = candidates.into_iter().map(|c| {
    return which::which(c);
  }).filter(|c| {
    return c.is_ok();
  }).map(|c| {
    return OsString::from_str(c.unwrap().to_str().unwrap()).unwrap();
  }).collect();
  if list.len() > 0 {
    return Ok(list[0].clone());
  }
  return Err(AppError::new("can not find proper shell"));
}

/// Handler for ws::Message message
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for MyWs {
  fn started(&mut self, ctx: &mut Self::Context) {
    self.hb = Instant::now();
    ctx.run_interval(std::time::Duration::from_secs(10), |act, ctx| {
      let now = Instant::now();
      if now.duration_since(act.hb) > Duration::from_secs(60) {
        if let Some(ref mut process) = act.process {
          process.exit(0).unwrap();
        }
        ctx.close(None);
      }
      if let Some(ref mut process) = act.process {
        if !process.is_alive() {
          ctx.close(None);
        }
      }
      ctx.ping(b"PING");
    });

    let cmd = find_shell();

    if cmd.is_err() {
      ctx.text(r#"{ "type": "spawn_shell_error", "payload": "" }"#.to_owned());
      ctx.close(None);
      return;
    }

    let cmd = cmd.unwrap();

    let mut process = conpty::spawn(cmd).expect("spawn shell error");
    process.set_echo(true).unwrap();
    let reader = process.output();
    self.process = Some(process);
    if let Ok(mut reader) = reader {
      let addr = ctx.address();
      thread::spawn(move || {
        let buf = &mut [0; 4096];
        while let Ok(s) = reader.read(buf) {
          if s == 0 {
            break;
          }
          addr.do_send(WsMessage(buf[0..s].to_vec()));
        }
        addr.do_send(WsTextMessage(
          r#"{ "type": "shell_closed", "payload": "" }"#.to_owned(),
        ));
      });
    } else {
      ctx.text(r#"{ "type": "spawn_shell_error", "payload": "" }"#.to_owned());
    }
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
        let msg = serde_json::from_str::<ClientMessage>(&text.to_string());
        if let Ok(msg) = msg {
          if msg.r#type == "cmd" {
            let cmd = msg.payload;
            let process = &mut self.process;
            if let Some(process) = process {
              let writer = process.input();
              if let Ok(mut writer) = writer {
                writer.write_all(cmd.as_bytes()).ok();
              } else {
                ctx.text(r#"{ "type": "error", "payload": "fail writing to shell" }"#.to_owned());
                ctx.close(None);
              }
            } else {
              ctx.text(r#"{ "type": "error", "payload": "shell_is_not_start" }"#.to_owned());
              ctx.close(None);
            }
          } else if msg.r#type == "set_size" {
            let sizes = serde_json::from_str::<SetTTYSizePayload>(&msg.payload);
            if let Ok(sizes) = sizes {
              let process = &mut self.process;
              if let Some(process) = process {
                process
                  .resize(sizes.cols as i16, sizes.rows as i16)
                  .unwrap();
              }
            } else {
              ctx.text(r#"{ "type": "error", "payload": "message format error" }"#.to_owned());
            }
          }
        } else {
          ctx.text(r#"{ "type": "error", "payload": "message format error" }"#.to_owned());
        }
        ctx.text("");
      }
      Ok(ws::Message::Binary(_)) => {
        ctx.text("");
      }
      _ => (),
    }
  }
}

async fn shell(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
  let resp = ws::start(MyWs::new(), &req, stream);
  resp
}

pub fn shell_routers() -> Scope {
  web::scope("/websocket/shell").route("/start", web::get().to(shell))
}

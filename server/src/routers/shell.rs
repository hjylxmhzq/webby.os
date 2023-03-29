use std::{
  io::{BufReader, Read, Write},
  process::Command,
  thread,
  time::{Duration, Instant},
};

use actix::{Actor, AsyncContext, Handler, StreamHandler};
use actix_web::{web, Error, HttpRequest, HttpResponse, Scope};
use actix_web_actors::ws;
use ptyprocess::PtyProcess;
use serde::Deserialize;

use crate::config;

/// Define HTTP actor
struct MyWs {
  // child: Option<Child>,
  process: Option<PtyProcess>,
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

/// Handler for ws::Message message
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for MyWs {
  fn started(&mut self, ctx: &mut Self::Context) {
    self.hb = Instant::now();
    ctx.run_interval(std::time::Duration::from_secs(10), |act, ctx| {
      let now = Instant::now();
      if now.duration_since(act.hb) > Duration::from_secs(60) {
        if let Some(ref mut process) = act.process {
          process.kill(ptyprocess::Signal::SIGKILL).unwrap();
        }
        ctx.close(None);
      }
      if let Some(ref mut process) = act.process {
        if !process.is_alive().unwrap() {
          ctx.close(None);
        }
      }
      ctx.ping(b"PING");
    });

    let process = PtyProcess::spawn(Command::new(config!(shell))).unwrap();

    let pty_handle = process.get_raw_handle().unwrap();

    self.process = Some(process);
    let addr = ctx.address();
    thread::spawn(move || {
      let mut reader = BufReader::new(pty_handle);
      let buf = &mut [0; 4096];
      while let Ok(s) = reader.read(buf) {
        if s == 0 {
          break;
        }
        addr.do_send(WsMessage(buf[0..s].to_vec()));
      }
    });
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
        let msg: ClientMessage = serde_json::from_str(&text.to_string()).unwrap();

        if msg.r#type == "cmd" {
          let cmd = msg.payload;
          let process = &mut self.process;
          if let Some(process) = process {
            let mut pty_handler = process.get_raw_handle().unwrap();
            pty_handler.write_all(cmd.as_bytes()).unwrap();
            if config!(shell) != "zsh" {
              ctx.binary(cmd.as_bytes().to_vec());
            }
          }
        } else if msg.r#type == "set_size" {
          let sizes: SetTTYSizePayload = serde_json::from_str(&msg.payload).unwrap();
          let process = &mut self.process;
          if let Some(process) = process {
            process.set_window_size(sizes.cols, sizes.rows).unwrap();
          }
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
  web::scope("/shell").route("/start", web::get().to(shell))
}

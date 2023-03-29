use std::{
  process::Stdio,
  time::{Duration, Instant},
};

use actix::{Actor, AsyncContext, Handler, StreamHandler};
use actix_web::{web, Error, HttpRequest, HttpResponse, Scope};
use actix_web_actors::ws;
use futures::executor::block_on;
use image::EncodableLayout;
use ptyprocess::PtyProcess;
use serde::Deserialize;
use tokio::{
  io::{AsyncReadExt, AsyncWriteExt},
  process::{Child, Command},
};

static DEFAULT_SHELL: &'static str = "zsh";

/// Define HTTP actor
struct MyWs {
  child: Option<Child>,
  hb: Instant,
}

impl Actor for MyWs {
  type Context = ws::WebsocketContext<Self>;
}

impl MyWs {
  fn new() -> Self {
    Self {
      child: None,
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

    // let mut process = PtyProcess::spawn(Command::new("bash"));

    let mut cmd = Command::new(DEFAULT_SHELL);
    let addr = ctx.address();
    let mut child = cmd
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .spawn()
      .unwrap();

    let mut stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();

    self.child = Some(child);
    let addr1 = addr.clone();
    tokio::spawn(async move {
      let buf = &mut [0; 4096];
      while let Ok(s) = stdout.read(buf).await {
        let mut v = buf[0..s].to_vec();
        v.push(0);
        addr1.do_send(WsMessage(v));
      }
    });
    tokio::spawn(async move {
      let buf = &mut [0; 4096];
      while let Ok(s) = stderr.read(buf).await {
        let mut v = buf[0..s].to_vec();
        v.push(1);
        addr.do_send(WsMessage(v));
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
          let child = &mut self.child;
          if let Some(child) = child {
            block_on(async {
              let c = child.stdin.as_mut().unwrap();
              c.write_all(cmd.as_bytes()).await.unwrap();
            });
          }
        }
        ctx.text("");
      }
      Ok(ws::Message::Binary(bin)) => {
        let child = &mut self.child;
        if let Some(child) = child {
          block_on(async {
            let c = child.stdin.as_mut().unwrap();
            c.write_all(bin.as_bytes()).await.unwrap();
          });
        }
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

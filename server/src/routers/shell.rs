/// A web shell backend
/// which implements a pseudo terminal
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
use serde::{Deserialize, Serialize};

use crate::{config, utils::error::AppError};

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

// use for resize pty size
#[derive(Deserialize)]
struct SetTTYSizePayload {
  rows: u16,
  cols: u16,
}

#[derive(Serialize)]
struct ShellErrorMsg<T: Serialize> {
  r#type: String,
  payload: T,
}

impl<T: Serialize> ShellErrorMsg<T> {
  fn new(t: &str, payload: T) -> Self {
    Self {
      r#type: t.to_string(),
      payload,
    }
  }
}

impl<T: Serialize> ToString for ShellErrorMsg<T> {
  fn to_string(&self) -> String {
      serde_json::to_string(self).unwrap()
  }
}

fn find_shell() -> Result<String, AppError> {
  let default_shell = config!(shell);
  if let Ok(shell) = which::which(default_shell) {
    return Ok(shell.to_string_lossy().to_string());
  }
  let candidates = vec!["zsh", "bash", "sh"];
  let list: Vec<String> = candidates
    .into_iter()
    .map(|c| {
      return which::which(c);
    })
    .filter(|c| {
      return c.is_ok();
    })
    .map(|c| {
      return c.unwrap().to_string_lossy().to_string();
    })
    .collect();
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
          process.kill(ptyprocess::Signal::SIGKILL).ok();
        }
        ctx.close(None);
      }
      if let Some(ref mut process) = act.process {
        if !process.is_alive().map_or(false, |v| v) {
          ctx.close(None);
        }
      }
      ctx.ping(b"PING");
    });

    let shell = find_shell();
    if shell.is_err() {
      ctx.text(ShellErrorMsg::new("spawn_shell_error", "can not find shell").to_string());
      ctx.close(None);
      return;
    }
    let shell = shell.unwrap();

    let process = PtyProcess::spawn(Command::new(shell));
    if let Ok(mut process) = process {
      process.set_echo(true, None).ok();

      let pty_handle = process.get_raw_handle();

      if let Ok(pty_handle) = pty_handle {
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
          addr.do_send(WsTextMessage(
            ShellErrorMsg::new("shell_closed", "").to_string()
          ));
        });
      } else {
        ctx.text(ShellErrorMsg::new("spawn_shell_error", "").to_string());
      }
    } else {
      ctx.text(ShellErrorMsg::new("spawn_shell_error", "").to_string());
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
              let mut pty_handler = process.get_raw_handle().unwrap();
              pty_handler.write_all(cmd.as_bytes()).unwrap();
            } else {
              ctx.text(ShellErrorMsg::new("error", "shell_is_not_started").to_string());
              ctx.close(None);
            }
          } else if msg.r#type == "set_size" {
            let sizes = serde_json::from_str::<SetTTYSizePayload>(&msg.payload);
            if let Ok(sizes) = sizes {
              let process = &mut self.process;
              if let Some(process) = process {
                process.set_window_size(sizes.cols, sizes.rows).unwrap();
              }
            } else {
              ctx.text(ShellErrorMsg::new("error", "message_format_error").to_string());
            }
          }
        } else {
          ctx.text(ShellErrorMsg::new("error", "message_format_error").to_string());
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

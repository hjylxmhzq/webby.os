use crate::utils::error::AppError;
use actix_web::{self, web, App, HttpServer};
use config::APP_CONFIG;
use log4rs::{
  append::rolling_file::policy::compound::{
    roll::delete::DeleteRoller, trigger::size::SizeTrigger,
  },
  config::{Appender, Root},
};
use serde::{Deserialize, Serialize};
use std::{
  collections::HashMap,
  env, fs,
  net::SocketAddr,
  path::PathBuf,
  str::FromStr,
  sync::{Arc, RwLock},
};
use tokio::sync::Mutex;
use tracing::log::info;
use utils::auth::{auto_create_user, auto_create_user_group};
mod middlewares;
pub mod models;
mod routers;
mod schedulers;
pub mod schema;
mod utils;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;

use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("./migrations");
mod config;
mod db;

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSessionData {
  username: String,
  is_login: bool,
  last_login: u64,
  user_root: String,
  csrf_token: String,
}

impl UserSessionData {
  pub fn new(username: &str, user_root: &str) -> UserSessionData {
    UserSessionData {
      is_login: true,
      username: username.to_string(),
      last_login: 0,
      user_root: user_root.to_string(),
      csrf_token: uuid::Uuid::new_v4().to_string(),
    }
  }
}

#[allow(unused)]
#[derive(Debug)]
struct AppSession {
  users: HashMap<String, UserSessionData>,
}
#[allow(unused)]
pub struct AppState {
  config: AppConfig,
  session: AppSession,
  db: Mutex<SqliteConnection>,
}

#[allow(unused)]
#[derive(Debug)]
struct AppConfig {
  file_root: PathBuf,
  static_root: PathBuf,
  port: i32,
  host: String,
}

pub type AppData = Arc<RwLock<AppState>>;

#[actix_web::main]
async fn main() -> Result<(), AppError> {
  init_log();

  let app_state = init();
  let app_state = Arc::new(RwLock::new(app_state));

  let state = app_state.read().unwrap();
  let AppConfig { host, port, .. } = &state.config;

  let addr = SocketAddr::from_str(format!("{host}:{port}").as_str()).unwrap();
  drop(state);

  info!("server start on {addr:?}");

  HttpServer::new(move || {
    let upload_temp_dir = config!(upload_temp_dir);
    let awmp_config;
    if let Some(upload_temp_dir) = upload_temp_dir {
      utils::vfs::ensure_dir_sync(&upload_temp_dir).unwrap();
      awmp_config = awmp::PartsConfig::default().with_temp_dir(&upload_temp_dir);
    } else {
      awmp_config = awmp::PartsConfig::default();
    }
    App::new()
      .app_data(awmp_config)
      .app_data(web::Data::new(app_state.clone()))
      .service(routers::tunnel::tunnel_routers())
      .service(routers::tunnel::websockify_routers())
      .service(routers::kv_storage::kv_storage_routers())
      .service(routers::kv_storage::kv_storage_ws_routers())
      .service(routers::message_queue::message_queue_routers())
      .service(routers::shell::shell_routers())
      .service(routers::fs::file_routers())
      .service(routers::log::log_routers())
      .service(routers::auth::auth_routers())
      .service(routers::gallery::gallery_routers())
      .service(routers::index::index_routers())
      .wrap(middlewares::guard::guard_mw())
      .wrap(middlewares::static_server::static_server())
      .wrap(middlewares::csrf::csrf_token())
      .wrap(middlewares::session::session())
  })
  .bind(addr)?
  .run()
  .await
  .unwrap();

  Ok(())
}

fn init() -> AppState {
  APP_CONFIG.lock().unwrap().init();

  let port: i32 = config!(port);

  let host = config!(host);
  let file_root = config!(file_root);
  let static_root = "static";
  let mut abs_file_root = env::current_dir().unwrap();
  let mut abs_static_root = env::current_dir().unwrap();
  abs_file_root.push(file_root);
  abs_static_root.push(static_root);
  fs::create_dir_all(&abs_file_root).unwrap();

  let mut conn = connect_db();
  run_migrations(&mut conn);

  auto_create_user_group(&mut conn);
  auto_create_user(&mut conn);

  let state = AppState {
    config: AppConfig {
      file_root: abs_file_root,
      static_root: abs_static_root,
      port,
      host: host.clone(),
    },
    session: AppSession {
      users: HashMap::new(),
    },
    db: Mutex::new(conn),
  };

  state
}

pub fn run_migrations(conn: &mut SqliteConnection) {
  info!("database is connected");
  info!("running migrations");
  MigrationHarness::run_pending_migrations(conn, MIGRATIONS).unwrap();
  info!("migrations finished");
}

pub fn connect_db() -> SqliteConnection {
  let database_url = config!(database_url);
  let conn =
    SqliteConnection::establish(&database_url).expect("can not establish database connection");
  conn
}

fn init_log() {
  use log4rs::{
    append::{
      console::ConsoleAppender,
      rolling_file::{policy::compound::CompoundPolicy, RollingFileAppender},
    },
    encode::pattern::PatternEncoder,
  };

  let stdout = ConsoleAppender::builder()
    .encoder(Box::new(PatternEncoder::new(
      "[{l}] {d} - {t} - {m}{n}",
    )))
    .build();

  let file = RollingFileAppender::builder()
    .encoder(Box::new(PatternEncoder::new(
      "[{l}] {d} - {t} - {m}{n}",
    )))
    .build(
      config!(log_path),
      Box::new(CompoundPolicy::new(
        Box::new(SizeTrigger::new(1000 * 1000 * 20)), // 20MB
        Box::new(DeleteRoller::new()),
      )),
    )
    .unwrap();

  let config = log4rs::Config::builder()
    .appender(Appender::builder().build("stdout", Box::new(stdout)))
    .appender(Appender::builder().build("file", Box::new(file)))
    .build(
      Root::builder()
        .appender("stdout")
        .appender("file")
        .build(tracing::log::LevelFilter::Info),
    )
    .unwrap();

  let _ = log4rs::init_config(config).unwrap();
}

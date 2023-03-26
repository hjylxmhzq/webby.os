use crate::utils::error::AppError;
use actix_web::{self, web, App, HttpServer};
use chrono::NaiveTime;
use config::APP_CONFIG;
use schedulers::update_file_index::JOB_UPDATE_GALLERY;
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
use utils::auth::auto_create_user;
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
  tracing_subscriber::fmt::init();

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
      .service(routers::fs::file_routers())
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

  JOB_UPDATE_GALLERY
    .lock()
    .unwrap()
    .set_file_root(&abs_file_root);
  JOB_UPDATE_GALLERY
    .lock()
    .unwrap()
    .init(NaiveTime::from_hms_opt(3, 0, 0).unwrap())
    .unwrap();

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

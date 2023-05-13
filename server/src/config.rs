use std::{path::PathBuf, sync::Mutex};

use clap::Parser;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct DynamicConfig {
  smtp: Option<SMTPConfig>,
}

#[derive(Serialize, Deserialize)]
pub struct SMTPConfig {
  user: String,
  secret: String,
  host: String,
  port: u32,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct AppConfig {
  pub host: Option<String>,
  pub port: Option<i32>,
  pub file_root: Option<String>,
  pub database_url: Option<String>,
  pub upload_temp_dir: Option<String>,
  pub use_ffmpeg_trancode: Option<bool>,
  pub ffmpeg_bin_path: Option<String>,
  pub indexing_follow_link: Option<bool>,
  pub search_index_path: Option<String>,
  pub authentication: Option<String>,
  pub static_dir: Option<String>,
  pub shell: Option<String>,
  pub log_path: Option<String>,
}

/// Simple program to greet a person
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
  #[arg(short, long)]
  config: Option<String>,
}

impl AppConfig {
  pub fn init(&mut self) {
    let args = Args::parse();
    let mut config_file = None;
    if let Some(ref config) = args.config {
      config_file = Some(config.to_owned());
    } else {
      if PathBuf::from("./config.toml").exists() {
        config_file = Some("./config.toml".to_owned());
      }
    }
    if let Some(config_file) = config_file {
      let content = std::fs::read_to_string(config_file).unwrap();
      *self = toml::from_str(&content).unwrap();
      println!(
        "app config:\n{}",
        serde_json::to_string_pretty(self).unwrap()
      );
    }
  }
}

macro_rules! default_str {
  ($env_var:expr, $v: expr) => {
    std::env::var($env_var).map_or(Some($v), |v| Some(v))
  };
}

macro_rules! default_int {
  ($env_var:expr, $v: expr) => {
    std::env::var($env_var).map_or(Some($v), |v| Some(v.parse::<i32>().unwrap()))
  };
}

macro_rules! default_bool {
  ($env_var:expr, $v: expr) => {
    std::env::var($env_var).map_or(Some($v), |v| Some(v.parse::<bool>().unwrap()))
  };
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      host: default_str!("HOST", "127.0.0.1".to_owned()),
      port: default_int!("PORT", 7001),
      file_root: default_str!("FILE_ROOT", "./files".to_owned()),
      database_url: default_str!("DATABASE_URL", "sqlite://./app.db".to_owned()),
      upload_temp_dir: default_str!("UPLOAD_TEMP_DIR", "./files/upload_temp".to_owned()),
      use_ffmpeg_trancode: default_bool!("USE_FFMPEG_TRANSCODE", false),
      ffmpeg_bin_path: default_str!("FFMPEG_BIN_PATH", "ffmpeg".to_owned()),
      indexing_follow_link: default_bool!("INDEXING_FOLLOW_LINK", true),
      search_index_path: Some("index".to_owned()),
      authentication: default_str!("AUTHENTICATION", "user".to_owned()),
      static_dir: default_str!("STATIC_DIR", "./static".to_owned()),
      shell: default_str!("SHELL", "zsh".to_owned()),
      log_path: default_str!("LOG_PATH", "log/system.log".to_owned()),
    }
  }
}

lazy_static! {
  pub static ref APP_CONFIG: Mutex<AppConfig> = {
    let default_config = AppConfig::default();
    Mutex::new(default_config)
  };
  pub static ref DYNAMIC_CONFIG: Mutex<DynamicConfig> = {
    let default_config = DynamicConfig { smtp: None };
    Mutex::new(default_config)
  };
}

#[macro_export]
macro_rules! config {
  ($key:ident) => {{
    use crate::config::{AppConfig, APP_CONFIG};
    let value = APP_CONFIG
      .lock()
      .unwrap()
      .$key
      .clone()
      .map_or_else(|| AppConfig::default().$key.unwrap(), |v| v);
    value
  }};
}

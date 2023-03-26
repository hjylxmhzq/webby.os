use std::{path::PathBuf, sync::Mutex};

use clap::Parser;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug, Serialize)]
pub struct AppConfig {
  pub host: Option<String>,
  pub port: Option<i32>,
  pub file_root: Option<String>,
  pub database_url: Option<String>,
  pub upload_temp_dir: Option<Option<String>>,
  pub use_ffmpeg_trancode: Option<bool>,
  pub ffmpeg_bin_path: Option<String>,
  pub indexing_follow_link: Option<bool>,
  pub search_index_path: Option<String>,
  pub authentication: Option<String>,
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

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      host: Some("127.0.0.1".to_owned()),
      port: Some(7001),
      file_root: Some("./files".to_owned()),
      database_url: Some("sqlite://./app.db".to_owned()),
      upload_temp_dir: Some(Some("./files/upload_temp".to_owned())),
      use_ffmpeg_trancode: Some(false),
      ffmpeg_bin_path: Some("ffmpeg".to_owned()),
      indexing_follow_link: Some(true),
      search_index_path: Some("index".to_owned()),
      authentication: Some("user".to_owned()),
    }
  }
}

lazy_static! {
  pub static ref APP_CONFIG: Mutex<AppConfig> = {
    let default_config = AppConfig::default();
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

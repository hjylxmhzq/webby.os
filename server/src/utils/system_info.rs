use serde::Serialize;
use systemstat::{System, Platform, Filesystem, BTreeMap, Network, Memory, Swap, SocketStats};

use super::error::AppError;


#[derive(Serialize)]
pub struct SystemInfo {
  pub mounts: Option<Vec<Filesystem>>,
  pub networks: Option<BTreeMap<String, Network>>,
  pub memory: Option<Memory>,
  pub swap: Option<Swap>,
  pub socket_stats: Option<SocketStats>,
}

pub fn get_system_info() -> Result<SystemInfo, AppError> {
  let sys = System::new();
  let mounts = sys.mounts().ok();
  let networks = sys.networks().ok();
  let memory = sys.memory().ok();
  let swap = sys.swap().ok();
  let socket_stats = sys.socket_stats().ok();


  let info = SystemInfo {
    mounts,
    networks,
    memory,
    swap,
    socket_stats,
  };

  Ok(info)
}
pub mod auth;
pub mod fs;
pub mod gallery;
pub mod index;
pub mod kv_storage;
pub mod tunnel;
pub mod log;
pub mod system_info;

#[cfg(target_os="windows")]
pub mod win_shell;
#[cfg(target_os="windows")]
pub use win_shell as shell;

#[cfg(not(target_os="windows"))]
pub mod shell;

pub mod message_queue;
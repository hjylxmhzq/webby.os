use tokio::fs;
use crate::config;
use super::error::AppError;

pub async fn read_log_to_string() -> Result<String, AppError> {
  let log_file = config!(log_path);
  let r = fs::read_to_string(log_file).await;
  match r {
      Ok(s) => Ok(s),
      Err(err) => Err(AppError::new(&err.to_string()))
  }
}
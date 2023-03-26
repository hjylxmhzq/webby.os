use std::path::PathBuf;

use super::error::AppError;
use pdf::file::File;
use tokio::{fs, io::AsyncReadExt};

#[allow(unused)]
pub async fn read_txt_to_string(file: &str) -> Result<String, AppError> {
  let mut f = fs::File::open(file).await?;
  let mut s = String::new();
  f.read_to_string(&mut s).await?;
  Ok(s)
}

pub fn read_txt_to_string_sync(file: &str) -> Result<String, AppError> {
  let s = std::fs::read_to_string(file)?;
  Ok(s)
}

pub fn read_pdf_to_string(file: &str) -> Result<String, AppError> {
  let path = PathBuf::from(file);
  let file = File::open(&path).unwrap();

  let mut result = String::new();
  if let Some(ref info) = file.trailer.info_dict {
    info
      .iter()
      .filter(|(_, primitive)| primitive.to_string_lossy().is_ok())
      .for_each(|(key, value)| {
        let s = format!("{}: {}", key, value.to_string_lossy().unwrap());
        result.push_str(&s);
      });
  }

  Ok(result)
}

#[allow(unused)]
pub async fn try_parse(file: &str, mime: &str) -> Result<Option<String>, AppError> {
  if mime.contains("text") {
    return Ok(Some(read_txt_to_string(file).await?));
  } else if mime.contains("pdf") {
    return Ok(Some(read_pdf_to_string(file)?));
  }
  Ok(None)
}

pub fn try_parse_sync(file: &str, mime: &str, size: u64) -> Result<Option<String>, AppError> {
  let max_size = 1024 * 1024 * 10;
  if size > max_size {
    return Ok(None);
  }
  if mime.contains("text") {
    return Ok(Some(read_txt_to_string_sync(file)?));
  } else if mime.contains("pdf") {
    return Ok(Some(read_pdf_to_string(file)?));
  }
  Ok(None)
}

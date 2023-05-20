use ffmpeg_cli_utils::FFMpeg;
use image::{ImageFormat};
use tokio::io::AsyncRead;
use std::{path::PathBuf, io::Cursor};

use super::error::AppError;

pub async fn ffmpeg_scale(file: &PathBuf, size: u32, bitrate: u32) -> impl AsyncRead {
  let stream = scale(file, size, bitrate);
  stream
}

fn scale(file: &PathBuf, size: u32, bitrate: u32) -> impl AsyncRead {
  let file = file.clone().canonicalize().unwrap();
  FFMpeg::set_ffmpeg_bin("./ffmpeg");
  let stream = FFMpeg::input(&file.to_string_lossy().to_string())
    .output()
    .resize(-2, size as i32)
    .set_bitrate(bitrate as u64)
    .stream()
    .unwrap();
  stream
}

pub fn create_image_thumbnail(file: &PathBuf, size: u32) -> Result<Vec<u8>, AppError> {
  let img = image::open(file)?;
  let mut width = img.width();
  let mut height = img.height();
  if size < width {
    height = (f64::from(height) * (f64::from(size) / f64::from(width))).round() as u32;
    width = size;
  }
  let thumbnail = image::imageops::thumbnail(&img, width, height);
  let mut w = Cursor::new(Vec::new());
  let img_format = ImageFormat::from_path(file)?;
  thumbnail.write_to(&mut w, img_format)?;
  let r = w.into_inner();
  Ok(r)
}

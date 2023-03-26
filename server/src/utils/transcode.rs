use ffmpeg_cli_utils::FFMpeg;
use tokio::io::AsyncRead;
use std::path::PathBuf;

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

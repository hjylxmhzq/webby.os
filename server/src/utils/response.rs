use actix_web::HttpResponse;
use percent_encoding::{AsciiSet, CONTROLS};
use serde::Serialize;
use tokio::{fs::File, io::AsyncRead};
use tokio_util::io::ReaderStream;

use super::stream::RangeStream;

pub enum AppResponseStatus {
  Success = 0,
  Error = 1,
}
impl Serialize for AppResponseStatus {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    match &self {
      Self::Success => serializer.serialize_i32(0),
      Self::Error => serializer.serialize_i32(1),
    }
  }
}

#[derive(Serialize)]
pub struct AppResponse<T: Serialize> {
  status: AppResponseStatus,
  message: String,
  data: T,
}

#[derive(Serialize)]
pub struct EmptyResponseData {}
impl EmptyResponseData {
  pub fn new() -> EmptyResponseData {
    EmptyResponseData {}
  }
}

pub fn create_resp<T: Serialize>(success: bool, data: T, message: &str) -> HttpResponse {
  let resp = AppResponse {
    status: if success {
      AppResponseStatus::Success
    } else {
      AppResponseStatus::Error
    },
    message: message.to_string(),
    data,
  };
  let r = serde_json::to_string(&resp).map_or_else(
    |_| {
      HttpResponse::InternalServerError()
        .content_type("application/json")
        .body(r#"{"status": 1, data: null, message: "internal server error"}"#)
    },
    |val| {
      HttpResponse::Ok()
        .content_type("application/json")
        .body(val)
    },
  );
  r
}
#[allow(unused)]
pub fn create_binary_resp(data: Vec<u8>, mime_type: Option<String>) -> HttpResponse {
  let mut resp = HttpResponse::Ok();
  resp.content_type(if let Some(mime) = mime_type {
    mime
  } else {
    "".to_owned()
  });
  resp.body(data)
}

pub fn create_stream_resp(
  stream: RangeStream<ReaderStream<File>>,
  mime_type: Option<String>,
  download_name: Option<&str>,
  range: (u64, u64),
  total_size: u64,
  is_range: bool,
) -> HttpResponse {
  let mut resp = if is_range {
    HttpResponse::PartialContent()
  } else {
    HttpResponse::Ok()
  };
  if let Some(download_name) = download_name {
    resp.append_header((
      "Content-Disposition",
      format!(
        r#"attachment; filename*=UTF-8''{}"#,
        percent_encode(download_name)
      ),
    ));
  }
  resp.append_header(("Accept-Ranges", "bytes"));
  if is_range {
    let l = range.0;
    let r = range.1;
    resp.append_header(("Content-Range", format!("bytes {}-{}/{}", l, r, total_size)));
  }
  resp.content_type(if let Some(mime) = mime_type {
    mime
  } else {
    "".to_owned()
  });
  resp.body(stream)
}

pub fn create_unsized_stream_resp<T: AsyncRead + 'static>(
  stream: ReaderStream<T>,
  mime_type: Option<String>,
  download_name: Option<&str>,
) -> HttpResponse {
  let mut resp = HttpResponse::Ok();
  if let Some(download_name) = download_name {
    resp.append_header((
      "Content-Disposition",
      format!(r#"attachment; filename="{download_name}""#),
    ));
  }
  resp.content_type(if let Some(mime) = mime_type {
    mime
  } else {
    "".to_owned()
  });
  resp.streaming(stream)
}

const FRAGMENT: &AsciiSet = &CONTROLS.add(b' ').add(b'"').add(b'<').add(b'>').add(b'`');

fn percent_encode(s: &str) -> String {
  percent_encoding::utf8_percent_encode(s, FRAGMENT).to_string()
}

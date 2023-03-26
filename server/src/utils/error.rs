use std::{fmt::Display, time::SystemTimeError, convert::Infallible};

use actix_session::{SessionInsertError, SessionGetError};
use actix_web::{http::StatusCode, ResponseError, error::BlockingError};
use image::ImageError;

use super::response::{create_resp, EmptyResponseData};

#[derive(Debug)]
pub struct AppError {
  pub msg: String,
  pub status_code: StatusCode,
}

#[macro_export]
macro_rules! conv_err (
  ($err:ty) => {
    impl From<$err> for AppError {
      fn from(e: $err) -> Self {
        let msg = e.to_string();
        AppError::new(&msg)
      }
    }
  };
);

impl AppError {
  pub fn new(msg: &str) -> AppError {
    Self {
      msg: msg.to_string(),
      status_code: StatusCode::INTERNAL_SERVER_ERROR,
    }
  }
  pub fn with_status(mut self, status: StatusCode) -> Self {
    self.status_code = status;
    self
  }
}

impl Display for AppError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.write_str(&self.msg)
  }
}

conv_err!(diesel::result::Error);
conv_err!(Infallible);
conv_err!(awmp::Error);
conv_err!(actix_web::error::HttpError);
conv_err!(BlockingError);
conv_err!(ImageError);
conv_err!(actix_web::Error);
conv_err!(SessionInsertError);
conv_err!(SessionGetError);
conv_err!(SystemTimeError);
conv_err!(std::io::Error);

impl ResponseError for AppError {
  fn error_response(&self) -> actix_web::HttpResponse<actix_web::body::BoxBody> {
    let mut resp = create_resp(false, EmptyResponseData::new(), &self.msg);
    let status = resp.status_mut();
    *status = self.status_code;
    resp
  }
  fn status_code(&self) -> actix_web::http::StatusCode {
    self.status_code
  }
}

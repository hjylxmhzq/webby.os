use actix_web::{web, HttpResponse, Scope};

use crate::utils::{self, response::create_resp, error::AppError};

pub async fn read_log_to_string() -> Result<HttpResponse, AppError> {
  let r = utils::log::read_log_to_string().await?;
  Ok(create_resp(true, r, "done"))
}

pub fn log_routers() -> Scope {
  web::scope("/log")
    .route("/read_to_string", web::post().to(read_log_to_string))
}

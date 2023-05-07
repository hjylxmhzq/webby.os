use actix_web::{Scope, HttpResponse, web};

use crate::utils::{error::AppError, response::create_resp, self};

pub async fn get_system_info() -> Result<HttpResponse, AppError> {
  let r = utils::system_info::get_system_info()?;
  Ok(create_resp(true, r, "done"))
}

pub fn system_info_routers() -> Scope {
  web::scope("/system_info")
    .route("/all", web::post().to(get_system_info))
}

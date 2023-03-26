use actix_web::{web, HttpResponse, Scope};

use crate::{middlewares::static_server::get_file, utils::error::AppError};

pub fn index_routers() -> Scope {
  web::scope("")
    .route("/", web::get().to(index))
    .route("/page/{page}*", web::get().to(index))
}

pub async fn index() -> Result<HttpResponse, AppError> {
  let content = get_file("index.html").ok_or(AppError::new("can not find index.html"))?;
  Ok(HttpResponse::Ok().content_type("text/html").body(content))
}

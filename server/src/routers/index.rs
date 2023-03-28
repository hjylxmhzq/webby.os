use actix_session::Session;
use actix_web::{web, HttpResponse, Scope};

use crate::{middlewares::static_server::get_file, utils::error::AppError, UserSessionData};

pub fn index_routers() -> Scope {
  web::scope("")
    .route("/", web::get().to(index))
    .route("/page/{page}*", web::get().to(index))
}

pub async fn index(sess: Session) -> Result<HttpResponse, AppError> {
  let user_data = sess.get::<UserSessionData>("user")?;
  if let Some(user_data) = user_data {
    if user_data.is_login {
      let content = get_file("index.html").ok_or(AppError::new("can not find index.html"))?;
      return Ok(HttpResponse::Ok().content_type("text/html").body(content));
    }
  }
  return Ok(HttpResponse::TemporaryRedirect().append_header(("location", "/login")).body(""));
}

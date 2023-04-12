use actix_web::{web, Scope};

use self::http::{tunnel_delete, tunnel_get, tunnel_head, tunnel_patch, tunnel_post, tunnel_put};

pub mod http;
pub mod websockify;

pub fn tunnel_routers() -> Scope {
  web::scope("/tunnel")
    .route("/http", web::get().to(tunnel_get))
    .route("/http", web::post().to(tunnel_post))
    .route("/http", web::head().to(tunnel_head))
    .route("/http", web::put().to(tunnel_put))
    .route("/http", web::patch().to(tunnel_patch))
    .route("/http", web::delete().to(tunnel_delete))
}

pub fn websockify_routers() -> Scope {
  web::scope("/websocket/websockify").route("/connect", web::get().to(websockify::websockify))
}

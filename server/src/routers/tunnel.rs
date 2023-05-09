/// The tunnel is some methods used to proxy browser requests.
/// As cross-domain resources without the CORS response header cannot be accessed in a browser,
/// server-side proxying is required to enable requests for any resource in the browser.
/// The tunnel also implements the ability to proxy TCP connections by implementing the websockify protocol.


use actix_web::{web, Scope};

pub mod http;
pub mod websockify;

use http::{tunnel_delete, tunnel_get, tunnel_head, tunnel_patch, tunnel_post, tunnel_put};

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

use include_dir::{include_dir, Dir};

use std::{
  future::{ready, Ready},
  path::PathBuf,
  str::FromStr,
};

use actix_web::{
  body::BoxBody,
  dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
  Error, HttpResponse,
};
use futures_util::future::LocalBoxFuture;

use crate::config;

// There are two steps in middleware processing.
// 1. Middleware initialization, middleware factory gets called with
//    next service in chain as parameter.
// 2. Middleware's call method gets called with normal request.
pub struct StaticServer;

static STATIC_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/static");

pub fn get_file<'a>(s: &'a str) -> Option<Vec<u8>> {
  let static_dir = config!(static_dir);
  if !static_dir.is_empty() && !s.contains("..") {
    let p = PathBuf::from_str(&static_dir).unwrap().join(s);
    if p.exists() {
      let content = std::fs::read(p);
      if let Ok(content) = content {
        return Some(content);
      }
    }
  }
  
  let file = STATIC_DIR.get_file(s);
  if let Some(file) = file {
    Some(file.contents().to_vec())
  } else {
    None
  }
}

// Middleware factory is `Transform` trait
// `S` - type of the next service
// `B` - type of response's body
impl<S> Transform<S, ServiceRequest> for StaticServer
where
  S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error>,
  S::Future: 'static,
{
  type Response = ServiceResponse<BoxBody>;
  type Error = Error;
  type InitError = ();
  type Transform = StaticServerMiddleware<S>;
  type Future = Ready<Result<Self::Transform, Self::InitError>>;

  fn new_transform(&self, service: S) -> Self::Future {
    ready(Ok(StaticServerMiddleware { service }))
  }
}

pub struct StaticServerMiddleware<S> {
  service: S,
}

impl<S> Service<ServiceRequest> for StaticServerMiddleware<S>
where
  S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error>,
  S::Future: 'static,
{
  type Response = ServiceResponse<BoxBody>;
  type Error = actix_web::Error;
  type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

  forward_ready!(service);

  fn call(&self, req: ServiceRequest) -> Self::Future {
    let p = req.path();
    let ret = get_file(&p[1..]);
    let g = mime_guess::from_path(p).first();
    if let Some(content) = ret {
      return Box::pin(async move {
        let mut resp_builder = HttpResponse::Ok();
        resp_builder.insert_header(("cache-control", "max-age=2592000"));
        if let Some(g) = g {
          let mime = g.to_string();
          resp_builder.content_type(mime);
        }

        let resp = resp_builder.body(content);
        let r = ServiceResponse::new(req.request().clone(), resp);
        Ok(r)
      });
    } else {
      let html_file = format!("{}.html", &p[1..]);
      let ret = get_file(&html_file);
      if let Some(content) = ret {
        return Box::pin(async move {
          let resp = HttpResponse::Ok().content_type("text/html").body(content);
          let r = ServiceResponse::new(req.request().clone(), resp);
          Ok(r)
        });
      }
    }

    let fut = self.service.call(req);
    Box::pin(async move {
      let res = fut.await?;
      Ok(res.map_into_boxed_body())
    })
  }
}

pub fn static_server() -> StaticServer {
  StaticServer
}

use std::collections::HashSet;

use actix_session::SessionExt;
use std::future::{ready, Ready};

use actix_web::{
  body::BoxBody,
  dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
  Error,
};
use futures_util::future::LocalBoxFuture;
use lazy_static::lazy_static;
use regex::Regex;

use crate::{utils::{
  auth::ONETIME_TOKENS,
  error::AppError,
  response::{create_resp, EmptyResponseData},
  session::SessionUtils,
}, config, routers::auth::login_fake_user};

lazy_static! {
  pub static ref IGNORE_PATHS: Vec<Regex> = vec![Regex::new(r#"^/static/.+"#).unwrap()];
  pub static ref ALLOW_PATHS: HashSet<&'static str> = vec![
    "/auth/login",
    "/login",
    "/",
    // "/asset-manifest.json",
    // "/favicon.ico",
    // "/robots.txt"
  ]
  .into_iter()
  .collect();
}

pub fn guard(req: &ServiceRequest) -> Result<bool, AppError> {
  if config!(authentication) == "none" {
    let sess = req.get_session();
    login_fake_user(sess).unwrap();
    return Ok(true);
  }
  let (r, _) = req.parts();
  let query = qstring::QString::from(r.query_string());
  let one_time_token = query.get("one_time_token");
  if let Some(token) = one_time_token {
    let tokens = ONETIME_TOKENS.lock().unwrap();
    let exist = tokens.get(token);
    if let Some(token) = exist {
      if r.path().starts_with(&token.module_prefix) {
        return Ok(true);
      }
    }
  }
  let p = r.path();
  for re in IGNORE_PATHS.iter() {
    if re.is_match(p) {
      return Ok(true);
    }
  }
  if ALLOW_PATHS.contains(p) {
    return Ok(true);
  }
  let sess = r.get_session();
  sess.is_login()
}

pub struct Guard;

// Middleware factory is `Transform` trait
// `S` - type of the next service
// `B` - type of response's body
impl<S> Transform<S, ServiceRequest> for Guard
where
  S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error>,
  S::Future: 'static,
{
  type Response = ServiceResponse<BoxBody>;
  type Error = Error;
  type InitError = ();
  type Transform = GuardMiddleware<S>;
  type Future = Ready<Result<Self::Transform, Self::InitError>>;

  fn new_transform(&self, service: S) -> Self::Future {
    ready(Ok(GuardMiddleware { service }))
  }
}

pub struct GuardMiddleware<S> {
  service: S,
}

impl<S> Service<ServiceRequest> for GuardMiddleware<S>
where
  S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error>,
  S::Future: 'static,
{
  type Response = ServiceResponse<BoxBody>;
  type Error = actix_web::Error;
  type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

  forward_ready!(service);

  fn call(&self, req: ServiceRequest) -> Self::Future {
    let ret = guard(&req);
    if let Ok(is_valid_request) = ret {
      if is_valid_request {
        let fut = self.service.call(req);
        return Box::pin(async move {
          let res = fut.await?;
          Ok(res.map_into_boxed_body())
        });
      }
    }

    return Box::pin(async move {
      let resp = create_resp(false, EmptyResponseData::new(), "authentication error");
      let r = ServiceResponse::new(req.request().clone(), resp);
      Ok(r)
    });
  }
}

pub fn guard_mw() -> Guard {
  Guard
}

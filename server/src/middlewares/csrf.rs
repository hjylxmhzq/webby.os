use std::future::{ready, Ready};

use actix_session::{Session, SessionExt};
use actix_web::{
  body::BoxBody,
  cookie::Cookie,
  dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
  http::Method,
  Error, HttpResponse,
};
use futures_util::future::LocalBoxFuture;

use crate::utils::{
  error::AppError,
  response::{create_resp, EmptyResponseData},
  session::SessionUtils,
};

// There are two steps in middleware processing.
// 1. Middleware initialization, middleware factory gets called with
//    next service in chain as parameter.
// 2. Middleware's call method gets called with normal request.
pub struct CsrfToken;

// Middleware factory is `Transform` trait
// `S` - type of the next service
// `B` - type of response's body
impl<S> Transform<S, ServiceRequest> for CsrfToken
where
  S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error>,
  S::Future: 'static,
{
  type Response = ServiceResponse<BoxBody>;
  type Error = Error;
  type InitError = ();
  type Transform = CsrfTokenMiddleware<S>;
  type Future = Ready<Result<Self::Transform, Self::InitError>>;

  fn new_transform(&self, service: S) -> Self::Future {
    ready(Ok(CsrfTokenMiddleware { service }))
  }
}

pub struct CsrfTokenMiddleware<S> {
  service: S,
}

impl<S> Service<ServiceRequest> for CsrfTokenMiddleware<S>
where
  S: Service<ServiceRequest, Response = ServiceResponse<BoxBody>, Error = Error>,
  S::Future: 'static,
{
  type Response = ServiceResponse<BoxBody>;
  type Error = actix_web::Error;
  type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

  forward_ready!(service);

  fn call(&self, req: ServiceRequest) -> Self::Future {
    let is_post = if let &Method::POST = req.method() {
      true
    } else {
      false
    };

    if is_post {
      let req = req.request();
      let mut sess = req.get_session();
      let csrf_token = req
        .headers()
        .get("csrf_token")
        .map_or("", |v| v.to_str().map_or("", |v| v));
      let is_csrf_token_valid = sess.is_csrf_token_valid(csrf_token).map_or(false, |v| v);
      if !is_csrf_token_valid {
        let req = req.clone();
        return Box::pin(async move {
          let mut resp = create_resp(false, EmptyResponseData::new(), "invalid csrf token");
          refresh_token(&mut resp, &mut sess)?;
          let r = ServiceResponse::new(req, resp);
          Ok(r)
        });
      }
    }

    let mut sess = req.get_session();
    let csrf_token = req
      .cookie("csrf_token")
      .map_or("".to_owned(), |v| v.to_string());
    let is_csrf_token_valid = sess.is_csrf_token_valid(&csrf_token).map_or(false, |v| v);

    let fut = self.service.call(req);

    Box::pin(async move {
      let mut res = fut.await?;
      let content_type = res
        .headers()
        .get("content-type")
        .map_or("", |v| v.to_str().map_or("", |v| v));
      if content_type.contains("html") && !is_csrf_token_valid {
        let resp = res.response_mut();
        refresh_token(resp, &mut sess)?;
      }
      Ok(res.map_into_boxed_body())
    })
  }
}

fn refresh_token(resp: &mut HttpResponse, sess: &mut Session) -> Result<(), AppError> {
  let csrf_token = uuid::Uuid::new_v4().to_string();
  let cookie = Cookie::build("csrf_token", &csrf_token)
    .max_age(time::Duration::seconds(3600 * 24 * 30))
    .http_only(false)
    .path("/")
    .finish();
  resp.add_cookie(&cookie)?;
  sess.set_csrf_token(&csrf_token)?;
  Ok(())
}

pub fn csrf_token() -> CsrfToken {
  CsrfToken
}

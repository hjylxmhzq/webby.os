use std::{collections::HashSet, str::FromStr};

use actix_web::{web::Payload, HttpRequest, HttpResponse};
use futures::StreamExt;
use reqwest::header::{HeaderName, HeaderValue, InvalidHeaderName, ToStrError};

use crate::{
  conv_err,
  utils::{
    error::AppError,
    response::{create_resp, EmptyResponseData},
  },
};

conv_err!(ToStrError);
conv_err!(url::ParseError);
conv_err!(InvalidHeaderName);

macro_rules! tunnel_method {
  ($fn_name: ident, $method: ident) => {
    pub async fn $fn_name(
      req: HttpRequest,
      mut payload: Payload,
    ) -> Result<HttpResponse, AppError> {
      let mut v = vec![];
      while let Some(Ok(bytes)) = payload.next().await {
        let mut vv = bytes.to_vec();
        v.append(&mut vv);
      }

      let headers = req.headers();
      let client = reqwest::Client::new();

      let target_url = headers.get("target-url");
      if let Some(target_url) = target_url {
        let target_url = target_url.to_str()?.to_string();
        let url_obj = url::Url::parse(&target_url)?;
        let creq = client.$method(&target_url);
        let mut req_headers = reqwest::header::HeaderMap::new();
        let keep_headers = headers
          .get("x-keep-resp")
          .map_or("".to_owned(), |v| {
            v.to_str().map_or("".to_string(), |v| v.to_string())
          })
          .split(",")
          .into_iter()
          .map(|v| v.trim().to_owned())
          .collect::<HashSet<_>>();
        for h in headers {
          let name = h.0.to_string();
          if name.starts_with("x-header-") {
            let n: String = name.chars().skip(9).collect();
            req_headers.append(HeaderName::from_str(&n)?, h.1.clone());
          }
        }
        let target_host = url_obj.host_str().ok_or(AppError::new("error host"))?;
        req_headers.append("host", HeaderValue::from_str(&target_host)?);
        let resp = creq.headers(req_headers).body(v).send().await.unwrap();
        let resp_headers = resp.headers();
        let mut r = HttpResponse::Ok();

        for (header_name, header_value) in resp_headers {
          let header_name = header_name.as_str();
          let new_header_name = "x-header-".to_owned() + header_name;
          r.append_header((new_header_name, header_value));
          if keep_headers.contains(&header_name.to_lowercase()) {
            r.append_header((header_name, header_value));
          }
        }
        let resp_stream = resp.bytes_stream();
        let r = r.streaming(resp_stream);
        return Ok(r);
      }
      let resp = create_resp(false, EmptyResponseData::new(), "no target url");
      Ok(resp)
    }
  };
}

tunnel_method!(tunnel_get, get);
tunnel_method!(tunnel_post, post);
tunnel_method!(tunnel_put, put);
tunnel_method!(tunnel_head, head);
tunnel_method!(tunnel_delete, delete);
tunnel_method!(tunnel_patch, patch);

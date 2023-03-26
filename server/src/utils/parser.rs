use std::num::ParseIntError;

use crate::conv_err;

use super::error::AppError;
use actix_web::{dev::ServiceRequest, http::header::HeaderMap};
use lazy_static::lazy_static;
use regex::Regex;

conv_err!(ParseIntError);

pub fn parse_range(headers: &HeaderMap, max_len: u64) -> Result<(u64, u64, bool), AppError> {
  lazy_static! {
    static ref RE: Regex = Regex::new(r#"bytes=(\d*?)-(\d*?)(,|$|\s)"#).unwrap();
  }

  let range = headers.get("range");
  if let Some(range) = range {
    let s = range.to_str();

    match s {
      Err(_) => Ok((0, max_len, false)),
      Ok(s) => {
        let caps = RE.captures(s).ok_or(AppError::new("range header error"))?;
        let first = caps.get(1).unwrap();
        let second = caps.get(2).unwrap();
        let f = &s[first.start()..first.end()];
        let s = &s[second.start()..second.end()];
        let f = if f.len() > 0 { f.parse::<u64>()? } else { 0 };
        if s.len() > 0 {
          let s = s.parse::<u64>()?;
          return Ok((f, s, true));
        }
        return Ok((f, max_len - 1, true));
      }
    }
  } else {
    return Ok((0, max_len - 1, false));
  }
}

#[allow(unused)]
pub fn ensure_cookie(req: &ServiceRequest) -> String {
  let uid = req.cookie("uid");
  if let Some(uid) = uid {
    return uid.to_string();
  }
  let new_uid = uuid::Uuid::new_v4().to_string();
  return new_uid;
}

#[macro_export]
macro_rules! any_params {
  ($left:ident, $right:ident, $key:ident) => {
    $left
      .borrow()
      .$key
      .clone()
      .map_or($right.borrow().$key.clone(), |v| Some(v))
  };
}

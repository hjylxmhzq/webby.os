use actix_web::{web, Scope};
use serde::Deserialize;

use crate::utils::{error::AppError, response::{create_resp, EmptyResponseData}};

#[derive(Deserialize)]
struct KvSet {
  collection: String,
  key: String,
  value: String,
}

async fn set(body: web::Json<KvSet>) -> Result<actix_web::HttpResponse, AppError> {

  let resp = create_resp(true, EmptyResponseData::new(), "");
  Ok(resp)
}

#[derive(Deserialize)]
struct KvGet {
  collection: String,
  key: String
}

async fn get(body: web::Json<KvGet>) -> Result<actix_web::HttpResponse, AppError> {

  let resp = create_resp(true, EmptyResponseData::new(), "");
  Ok(resp)
}

#[derive(Deserialize)]
struct KvHas {
  collection: String,
  key: String
}

async fn has(body: web::Json<KvHas>) -> Result<actix_web::HttpResponse, AppError> {

  let resp = create_resp(true, EmptyResponseData::new(), "");
  Ok(resp)
}

#[derive(Deserialize)]
struct KvKeys {
  collection: String,
}
async fn keys(body: web::Json<KvKeys>) -> Result<actix_web::HttpResponse, AppError> {

  let resp = create_resp(true, EmptyResponseData::new(), "");
  Ok(resp)
}

#[derive(Deserialize)]
struct KvValues {
  collection: String,
}
async fn values(body: web::Json<KvValues>) -> Result<actix_web::HttpResponse, AppError> {

  let resp = create_resp(true, EmptyResponseData::new(), "");
  Ok(resp)
}

pub fn kv_storage_routers() -> Scope {
  web::scope("/kv_storage")
    .route("/set", web::post().to(set))
    .route("/get", web::get().to(get))
    .route("/has", web::get().to(has))
    .route("/keys", web::get().to(keys))
    .route("/values", web::get().to(values))
}

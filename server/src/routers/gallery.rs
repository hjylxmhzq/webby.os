use crate::schedulers::update_file_index::JOB_UPDATE_GALLERY;
use crate::utils::error::AppError;
use crate::utils::gallery;
use crate::utils::response::create_resp;
use crate::utils::response::EmptyResponseData;
use crate::AppData;
use actix_web::{web, HttpResponse, Scope};
use std::borrow::Borrow;

pub async fn list(state: web::Data<AppData>) -> Result<HttpResponse, AppError> {
  let state = state.borrow().write().unwrap();

  let mut db_mutex = state.db.lock().await;

  let db = &mut *db_mutex;
  let images = gallery::get_all_images(db, "")?;
  let resp = create_resp(true, images, "done");
  Ok(resp)
}

pub async fn update_immediate() -> Result<HttpResponse, AppError> {
  let job = JOB_UPDATE_GALLERY.clone();
  job.lock().unwrap().update_immediate();
  let resp = create_resp(true, EmptyResponseData::new(), "done");
  Ok(resp)
}

pub async fn get_job_status() -> Result<HttpResponse, AppError> {
  let job = JOB_UPDATE_GALLERY.clone();
  let status = job.lock().unwrap().get_status();
  let resp = create_resp(true, status, "done");
  Ok(resp)
}

pub fn gallery_routers() -> Scope {
  web::scope("/gallery")
    .route("/list", web::post().to(list))
    .route("/update_index", web::post().to(update_immediate))
    .route("/get_job_status", web::post().to(get_job_status))
}

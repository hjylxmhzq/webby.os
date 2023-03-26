use crate::utils::error::AppError;
use crate::utils::parser::parse_range;
use crate::utils::response::{
  create_binary_resp, create_stream_resp, create_unsized_stream_resp, EmptyResponseData,
};
use crate::utils::session::SessionUtils;
use crate::utils::vfs::{
  ensure_parent_dir_sync, read_file_stream, read_to_zip_stream, FileStatWithName, FS_HOOK, FSHookType, FSHookPayload, rel_join,
};
use crate::utils::{response::create_resp, vfs};
use crate::AppData;
use actix_session::Session;
use actix_web::http::StatusCode;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use serde::{Deserialize, Serialize};
use std::borrow::Borrow;
use tokio_util::io::ReaderStream;

#[derive(Deserialize)]
pub struct GetFilesOfDirReq {
  file: Option<String>,
}

#[derive(Serialize)]
pub struct GetFilesOfDirResp {
  files: Vec<FileStatWithName>,
}

pub async fn fs_actions_get(
  path: web::Path<(String,)>,
  query: web::Query<GetFilesOfDirReq>,
  req_raw: HttpRequest,
  state: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  let file = query
    .borrow()
    .file
    .clone()
    .ok_or(AppError::new("query params error").with_status(StatusCode::BAD_REQUEST))?;
  fs_actions(path, &file, true, req_raw, state, sess).await
}

pub async fn fs_actions_post(
  path: web::Path<(String,)>,
  query: web::Json<GetFilesOfDirReq>,
  req_raw: HttpRequest,
  state: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  let file = query
    .borrow()
    .file
    .clone()
    .ok_or(AppError::new("query params error").with_status(StatusCode::BAD_REQUEST))?;
  fs_actions(path, &file, false, req_raw, state, sess).await
}

pub async fn fs_actions(
  path: web::Path<(String,)>,
  file: &str,
  is_download: bool,
  req_raw: HttpRequest,
  state: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  let file_root = &state.read().unwrap().config.file_root;
  let user_root = &sess.get_user_root()?;
  let action = path.into_inner().0;
  let headers = req_raw.headers();

  match action.as_str() {
    "read_dir" => {
      let files = vfs::read_dir(file_root, user_root, file).await.unwrap();

      let resp = GetFilesOfDirResp { files };

      Ok(create_resp(true, resp, ""))
    }

    "create_dir" => {
      vfs::create_dir(file_root, user_root, file).await.unwrap();

      Ok(create_resp(true, EmptyResponseData::new(), ""))
    }

    "read_zip_entries" => {
      let tree = vfs::read_entries_in_zip(file_root, user_root, file)
        .await
        .unwrap();

      Ok(create_resp(true, tree, ""))
    }

    "read_compression" => {
      let stream = read_to_zip_stream(file_root, user_root, file).await?;
      let resp = create_unsized_stream_resp(
        stream,
        Some("application/zip".to_string()),
        Some(&(file.to_string() + ".zip")),
      );
      Ok(resp)
    }

    "read" => {
      let file_stat = vfs::stat(file_root, user_root, file).await?;
      let (range_start, range_end, is_range) = parse_range(headers, file_stat.size)?;
      let stream = read_file_stream(file_root, user_root, file, (range_start, range_end)).await?;
      let mime = mime_guess::from_path(file.to_owned())
        .first()
        .map(|m| m.to_string());
      let resp = if is_download {
        create_stream_resp(
          stream,
          mime,
          Some(file),
          (range_start, range_end),
          file_stat.size,
          is_range,
        )
      } else {
        create_stream_resp(
          stream,
          mime,
          None,
          (range_start, range_end),
          file_stat.size,
          is_range,
        )
      };
      Ok(resp)
    }

    "delete" => {
      vfs::delete(file_root, user_root, file).await?;
      Ok(create_resp(true, EmptyResponseData::new(), "done"))
    }

    "stat" => {
      let file_stat = vfs::stat(file_root, user_root, file).await?;
      Ok(create_resp(true, file_stat, ""))
    }
    _ => Ok(create_resp(false, EmptyResponseData::new(), "error action")),
  }
}

#[derive(Deserialize)]
pub struct DeleteFilesOfDirReq {
  files: Option<Vec<String>>,
}

pub async fn delete_batch(
  query: web::Json<DeleteFilesOfDirReq>,
  state: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  let file_root = &state.read().unwrap().config.file_root;
  let user_root = &sess.get_user_root()?;
  let files = query
    .borrow()
    .files
    .clone()
    .ok_or(AppError::new("query params error").with_status(StatusCode::BAD_REQUEST))?;
  vfs::delete_batch(file_root, user_root, files).await?;
  Ok(create_resp(true, EmptyResponseData::new(), ""))
}

pub async fn upload(
  parts: awmp::Parts,
  state: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  let file_root = &state.read().unwrap().config.file_root;
  let user_root = &sess.get_user_root()?;

  let file_root = file_root.clone();
  let user_root = user_root.clone();
  web::block(move || -> Result<(), AppError> {
    let files = parts.files.into_inner();
    let mut flist = vec![];
    for (filename, file) in files {
      if let Ok(file) = file {
        let file_path = file_root.join(&user_root).join(&filename);
        ensure_parent_dir_sync(&file_path)?;
        let parent_dir = file_path.parent();
        if let Some(parent_dir) = parent_dir {
          file.persist_in(parent_dir)?;
          flist.push(rel_join(&user_root, &filename)?);
        }
      }
    }
    FS_HOOK.lock().unwrap().emit(FSHookType::AddFile, FSHookPayload(flist));
    Ok(())
  })
  .await??;

  Ok(create_resp(
    true,
    EmptyResponseData::new(),
    "upload file successfully",
  ))
}

#[derive(Deserialize)]
pub struct ReadImageReq {
  pub file: Option<String>,
  pub resize: Option<u32>,
}

#[derive(Deserialize)]
pub struct ReadVideoReq {
  pub file: Option<String>,
  pub resize: Option<u32>,
  pub bitrate: Option<u32>,
}

pub async fn read_image_get(
  query: web::Query<ReadImageReq>,
  state: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  let file = query.file.clone().ok_or(AppError::new("params error").with_status(StatusCode::BAD_REQUEST))?;
  let resize = query.resize;
  read_image(&file, resize, state, sess).await
}

pub async fn read_image_post(
  query: web::Json<ReadImageReq>,
  state: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  let file = query.file.clone().ok_or(AppError::new("params error").with_status(StatusCode::BAD_REQUEST))?;
  let resize = query.resize;
  read_image(&file, resize, state, sess).await
}

pub async fn read_image(
  file: &str,
  resize: Option<u32>,
  state: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  let file_root = &state.read().unwrap().config.file_root;
  let user_root = sess.get_user_root()?;

  let mime = mime_guess::from_path(file.to_owned())
    .first()
    .map(|m| m.to_string());

  let img = vfs::read_image(
    file_root.clone(),
    user_root.clone(),
    file.to_string(),
    resize,
  )
  .await?;

  Ok(create_binary_resp(img, mime))
}

pub async fn read_video_transcode_get(
  query: web::Query<ReadVideoReq>,
  state: web::Data<AppData>,
  sess: Session,
) -> Result<HttpResponse, AppError> {
  let file = query.file.clone().ok_or(AppError::new("params error").with_status(StatusCode::BAD_REQUEST))?;
  let resize = query.resize.clone();
  let bitrate = query.bitrate.clone();
  let file_root = &state.read().unwrap().config.file_root;
  let user_root = sess.get_user_root()?;

  let video_stream = vfs::read_video_transform_stream(
    file_root.clone(),
    user_root.clone(),
    file.to_string(),
    resize,
    bitrate,
  )
  .await?;

  let reader = ReaderStream::new(video_stream);
  Ok(create_unsized_stream_resp(
    reader,
    Some("video/mp4".to_string()),
    None,
  ))
}

#[derive(Deserialize)]
pub struct SearchFilesReq {
  keyword: String,
}

pub async fn search(body: web::Json<SearchFilesReq>) -> Result<HttpResponse, AppError> {
  let kw = body.keyword.clone();

  let r = vfs::search_in_index(&kw, 100).await?;

  Ok(create_resp(true, r, "done"))
}

pub async fn search_content(body: web::Json<SearchFilesReq>) -> Result<HttpResponse, AppError> {
  let kw = body.keyword.clone();
  let r = vfs::search_in_tantivy(&kw)?;
  Ok(create_resp(true, r, "done"))
}

pub async fn storage_info() -> Result<HttpResponse, AppError> {
  let r = vfs::storage_info_group_by_file_mime("").await?;

  Ok(create_resp(true, r, "done"))
}

pub async fn index_updated_at() -> Result<HttpResponse, AppError> {
  let r = vfs::file_index_last_updated_time("").await?;
  Ok(create_resp(true, r, "done"))
}

pub fn file_routers() -> Scope {
  web::scope("/file")
    .route("/upload", web::post().to(upload))
    .route("/search", web::post().to(search))
    .route("/search_content", web::post().to(search_content))
    .route("/delete_batch", web::post().to(delete_batch))
    .route("/read_image", web::post().to(read_image_post))
    .route("/read_image", web::get().to(read_image_get))
    .route("/storage_info", web::post().to(storage_info))
    .route("/index_updated_at", web::post().to(index_updated_at))
    .route(
      "/read_video_transcode",
      web::get().to(read_video_transcode_get),
    )
    .route("/{action}", web::get().to(fs_actions_get))
    .route("/{action}", web::post().to(fs_actions_post))
}

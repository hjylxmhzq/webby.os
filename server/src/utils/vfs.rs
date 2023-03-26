use actix_web::web::block;
use async_zip::error::ZipError;
use async_zip::write::ZipFileWriter;
use async_zip::{Compression, ZipEntryBuilder};
use diesel::sql_types::Text;
use diesel::{sql_query, RunQueryDsl};
use lazy_static::lazy_static;
use serde::Serialize;
use std::cell::RefCell;
use std::collections::HashMap;
use std::hash::Hash;
use std::io::Cursor;
use std::path::Path;
use std::rc::Rc;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::UNIX_EPOCH;
use std::{fs::Metadata, io, path::PathBuf};
use tantivy::Document;
use tokio::fs::{self, File};
use tokio::io::{duplex, AsyncRead, AsyncSeekExt, DuplexStream};
use tokio_util::io::ReaderStream;

use crate::{config, conv_err};
use crate::db::SHARED_DB_CONN;
use crate::models::{FileIndex, FileIndexSizeCount};
use crate::schedulers::update_file_index::UpdateGalleryJob;

use super::error::AppError;
use super::eventbus::EventEmitter;
use super::path::secure_join;
use super::search_engine::search_docs;
use super::stream::RangeStream;
use super::transcode::ffmpeg_scale;

#[derive(Debug, PartialEq, Eq, Clone, Hash)]
pub enum FSHookType {
  AddFile,
  DeleteFile,
}

#[derive(Debug, Clone)]
pub struct FSHookPayload(pub Vec<String>);

lazy_static! {
  pub static ref FS_HOOK: Arc<Mutex<EventEmitter<FSHookType, FSHookPayload>>> = {
    let mut ev = EventEmitter::<FSHookType, FSHookPayload>::new();

    ev.listen(FSHookType::AddFile, |payload| {
      let file_root = PathBuf::from_str(&config!(file_root)).unwrap();
      thread::spawn(move || {
        UpdateGalleryJob::update_file_indices(payload.0, &file_root).unwrap()
      });
    });

    ev.listen(FSHookType::DeleteFile, |payload| {
      thread::spawn(move || {
        UpdateGalleryJob::delete_file_indices(payload.0).unwrap();
      });
    });
    Arc::new(Mutex::new(ev))
  };
}

pub async fn read_dir(
  file_root: &PathBuf,
  user_root: &str,
  dir: &str,
) -> Result<Vec<FileStatWithName>, AppError> {
  let odir = PathBuf::from(dir);
  let dir = normailze_path(file_root, user_root, dir)?;
  let mut result = fs::read_dir(&dir).await?;
  let mut files_in_dir: Vec<FileStatWithName> = vec![];
  while let Result::Ok(Option::Some(dir_entry)) = result.next_entry().await {
    let filename = dir_entry.file_name().to_string_lossy().into_owned();
    let file_path = odir.join(&filename);
    let file_path = file_path.to_str().map_or("", |v| v);
    let file_stat = stat(file_root, user_root, file_path).await?;
    let file_stat_with_name = FileStatWithName::new(&file_stat, &filename);
    files_in_dir.push(file_stat_with_name);
  }
  Ok(files_in_dir)
}

#[allow(unused)]
pub async fn read_image(
  file_root: PathBuf,
  user_root: String,
  file: String,
  resize: Option<u32>,
) -> Result<Vec<u8>, AppError> {
  let dir = normailze_path(&file_root, &user_root, &file)?;

  let result = fs::read(dir).await?;
  if let Some(resize) = resize {
    let buf = block(move || {
      let img = image::io::Reader::new(Cursor::new(&result))
        .with_guessed_format()
        .unwrap()
        .decode()
        .unwrap();
      let img = img.thumbnail(resize, resize);
      let mut buf = Vec::new();
      img.write_to(&mut Cursor::new(&mut buf), image::ImageOutputFormat::Png);
      buf
    })
    .await?;
    return Ok(buf);
  }
  Ok(result)
}

pub async fn stat(file_root: &PathBuf, user_root: &str, file: &str) -> Result<FileStat, AppError> {
  let dir = normailze_path(file_root, user_root, file)?;
  let meta = fs::metadata(dir).await?;
  convert_meta_to_struct(meta)
}
#[allow(unused)]
pub async fn create(
  file_root: PathBuf,
  user_root: String,
  file: String,
  buffer: Vec<u8>,
) -> Result<(), AppError> {
  let dir = normailze_path(&file_root, &user_root, &file)?;
  let parent = Path::new(&file).parent().unwrap_or(dir.as_path());
  fs::create_dir_all(parent).await?;
  Ok(fs::write(file, buffer).await?)
}

pub async fn delete(file_root: &PathBuf, user_root: &str, file: &str) -> Result<(), AppError> {
  let dir = normailze_path(file_root, &user_root, &file)?;
  let path_stat = stat(file_root, user_root, file).await?;
  if path_stat.is_dir {
    fs::remove_dir_all(&dir).await?;
  } else {
    fs::remove_file(&dir).await?;
  }
  FS_HOOK.lock().unwrap().emit(
    FSHookType::DeleteFile,
    FSHookPayload(vec![rel_join(user_root, file)?]),
  );
  Ok(())
}

pub async fn delete_batch(
  file_root: &PathBuf,
  user_root: &str,
  files: Vec<String>,
) -> Result<(), AppError> {
  let mut flist = vec![];
  for file in files {
    let dir = normailze_path(&file_root, &user_root, &file)?;
    let path_stat = stat(file_root, user_root, &file).await?;
    if path_stat.is_dir {
      fs::remove_dir_all(&dir).await?;
    } else {
      fs::remove_file(&dir).await?;
    }
    flist.push(rel_join(user_root, &file)?);
  }
  FS_HOOK
    .lock()
    .unwrap()
    .emit(FSHookType::DeleteFile, FSHookPayload(flist));
  Ok(())
}

pub async fn read_video_transform_stream(
  file_root: PathBuf,
  user_root: String,
  file: String,
  resize: Option<u32>,
  bitrate: Option<u32>,
) -> Result<impl AsyncRead, AppError> {
  let dir = normailze_path(&file_root, &user_root, &file)?;
  let resize = resize.map_or(720, |v| v);
  let bitrate = bitrate.map_or(2000, |v| v);
  let stream = ffmpeg_scale(&dir, resize, bitrate).await;
  Ok(stream)
}

pub async fn create_dir(file_root: &PathBuf, user_root: &str, file: &str) -> Result<(), AppError> {
  let dir = normailze_path(&file_root, &user_root, &file)?;
  let result = fs::create_dir(&dir).await?;
  FS_HOOK.lock().unwrap().emit(
    FSHookType::AddFile,
    FSHookPayload(vec![rel_join(user_root, file)?]),
  );
  Ok(result)
}

pub async fn search_in_index(kw: &str, limit: i64) -> Result<Vec<FileIndex>, AppError> {
  use crate::schema::file_index::dsl::*;
  use diesel::prelude::*;

  let mut conn = SHARED_DB_CONN.lock().unwrap();
  let conn = &mut *conn;
  let result = file_index
    .filter(file_name.like(format!("%{kw}%")))
    .limit(limit)
    .load::<FileIndex>(conn)?;
  Ok(result)
}

pub fn search_in_tantivy(kw: &str) -> Result<Vec<Document>, AppError> {
  let docs = search_docs(kw)?;
  Ok(docs)
}

#[derive(Serialize)]
#[mixin::declare]
pub struct FileStat {
  pub is_dir: bool,
  pub is_file: bool,
  pub file_type: String,
  pub size: u64,
  pub created: u128,
  pub modified: u128,
  pub accessed: u128,
}

#[mixin::insert(FileStat)]
#[derive(Serialize, Debug)]
pub struct FileStatWithName {
  pub name: String,
}

impl FileStatWithName {
  fn new(file_stat: &FileStat, name: &str) -> Self {
    let FileStat {
      is_dir,
      is_file,
      file_type,
      size,
      created,
      modified,
      accessed,
    } = file_stat;
    Self {
      name: name.to_string(),
      is_dir: *is_dir,
      is_file: *is_file,
      file_type: file_type.to_string(),
      size: *size,
      created: *created,
      modified: *modified,
      accessed: *accessed,
    }
  }
}

pub fn convert_meta_to_struct(meta: Metadata) -> Result<FileStat, AppError> {
  Ok(FileStat {
    is_dir: meta.is_dir(),
    is_file: meta.is_file(),
    file_type: "".to_string(),
    size: meta.len(),
    created: meta.created()?.duration_since(UNIX_EPOCH)?.as_millis(),
    modified: meta.modified()?.duration_since(UNIX_EPOCH)?.as_millis(),
    accessed: meta.accessed()?.duration_since(UNIX_EPOCH)?.as_millis(),
  })
}

pub async fn read_file_stream(
  file_root: &PathBuf,
  user_root: &str,
  file: &str,
  range: (u64, u64),
) -> Result<RangeStream<ReaderStream<File>>, AppError> {
  let dir = normailze_path(&file_root, &user_root, &file)?;
  let mut f = tokio::fs::File::open(dir).await?;
  f.seek(io::SeekFrom::Start(range.0)).await.unwrap();
  let reader = ReaderStream::new(f);
  let reader = RangeStream::new(range.1 - range.0 + 1, reader);
  Ok(reader)
}

pub async fn storage_info_group_by_file_mime(
  username_: &str,
) -> Result<Vec<FileIndexSizeCount>, AppError> {
  let conn = &mut *SHARED_DB_CONN.lock().unwrap();

  let r = sql_query("select sum(size), size, format, is_dir, username from file_index where username = ? group by format;")
    .bind::<Text, _>(username_)
    .load::<FileIndexSizeCount>(conn)
    .unwrap();
  Ok(r)
}

pub async fn file_index_last_updated_time(username_: &str) -> Result<String, AppError> {
  let conn = &mut *SHARED_DB_CONN.lock().unwrap();
  use crate::schema::file_index::dsl::*;
  use diesel::prelude::*;

  let r = file_index
    .filter(username.is(username_))
    .first::<FileIndex>(conn)
    .map_or("".to_owned(), |v| v.updated_at);

  Ok(r)
}

pub async fn read_to_zip_stream(
  file_root: &PathBuf,
  user_root: &str,
  file: &str,
) -> Result<ReaderStream<DuplexStream>, AppError> {
  let f = zip_path_to_stream(&file_root.join(user_root), &PathBuf::from_str(&file)?).await?;
  let reader = ReaderStream::new(f);
  Ok(reader)
}

pub fn ensure_parent_dir_sync(file: &PathBuf) -> Result<(), AppError> {
  let parent_dir = file.parent();
  if let Some(parent_dir) = parent_dir {
    std::fs::create_dir_all(parent_dir)?;
  }
  Ok(())
}

fn normailze_path(file_root: &PathBuf, user_root: &str, file: &str) -> Result<PathBuf, AppError> {
  let user_abs_root = file_root.join(user_root);
  Ok(secure_join(&user_abs_root, &PathBuf::from(file))?)
}

pub async fn zip_path_to_stream(
  base: &PathBuf,
  file: &PathBuf,
) -> Result<DuplexStream, std::io::Error> {
  #[async_recursion::async_recursion]
  async fn walk(
    base: &PathBuf,
    file: &PathBuf,
    writer: &mut ZipFileWriter<DuplexStream>,
  ) -> Result<(), std::io::Error> {
    let meta = tokio::fs::metadata(base.join(file)).await?;
    if meta.is_file() {
      let s = file.to_str().unwrap().to_string();
      let entry = ZipEntryBuilder::new(s, Compression::Stored).build();
      let mut w = writer.write_entry_stream(entry).await.unwrap();
      let mut f = tokio::fs::File::open(base.join(file)).await?;
      tokio::io::copy(&mut f, &mut w).await?;
      w.close().await.unwrap();
    } else if meta.is_dir() {
      let mut files = tokio::fs::read_dir(base.join(file)).await?;
      while let Ok(Some(inner_file)) = files.next_entry().await {
        let filename = inner_file.file_name();
        walk(&base, &file.join(filename), writer).await?;
      }
    }
    Ok(())
  }

  let (w, r) = duplex(512 * 1024);

  let base = base.clone();
  let file = file.clone();
  tokio::spawn(async move {
    let mut writer = ZipFileWriter::new(w);
    walk(&base, &file, &mut writer).await.unwrap();
  });

  Ok(r)
}

pub fn ensure_dir_sync(dir: impl Into<PathBuf>) -> Result<(), AppError> {
  let p: PathBuf = dir.into();
  Ok(std::fs::create_dir_all(p)?)
}

conv_err!(ZipError);

#[derive(Debug, Serialize)]
pub struct FileStatTreeInner {
  file: FileStatWithName,
  children: Vec<Rc<RefCell<FileStatTreeInner>>>,
}

pub async fn read_entries_in_zip(
  file_root: &PathBuf,
  user_root: &str,
  file: &str,
) -> Result<Rc<RefCell<FileStatTreeInner>>, AppError> {
  let file = normailze_path(file_root, user_root, file)?;
  let mut file = File::open(file).await?;
  let zip_file = async_zip::read::seek::ZipFileReader::new(&mut file).await?;
  let mut file_map = HashMap::<String, Rc<RefCell<FileStatTreeInner>>>::new();
  let mut root = None;
  for entry in zip_file.file().entries() {
    let entry = entry.entry();
    let mut abs_filename = entry.filename();
    if abs_filename.ends_with("/") {
      let len = abs_filename.len();
      abs_filename = &abs_filename[..len - 1];
    }
    let f = Path::new(abs_filename);
    let is_dir = entry.dir();
    let is_file = !is_dir;
    let size = entry.uncompressed_size();
    let modified = entry.last_modification_date();
    let created = entry.last_modification_date();
    let accessed = entry.last_modification_date();
    let filename = f
      .file_name()
      .map_or("unknown".to_owned(), |f| f.to_string_lossy().to_string());
    let parent = f
      .parent()
      .map_or("".to_owned(), |p| p.to_string_lossy().to_string());

    let ref_file;

    if file_map.contains_key(abs_filename) {
      ref_file = file_map.get(abs_filename).unwrap().clone();
    } else {
      ref_file = Rc::new(RefCell::new(FileStatTreeInner {
        file: FileStatWithName {
          name: filename.clone(),
          is_dir,
          is_file,
          file_type: "".to_owned(),
          size,
          created: created.second() as u128,
          modified: modified.second() as u128,
          accessed: accessed.second() as u128,
        },
        children: vec![],
      }));
      if is_dir {
        file_map.insert(abs_filename.to_string(), ref_file.clone());
      }
    }

    let parent_file_stat = file_map.entry(parent.clone()).or_insert_with(|| {
      let ref_dir = Rc::new(RefCell::new(FileStatTreeInner {
        file: FileStatWithName {
          name: parent.clone(),
          is_dir: true,
          is_file: false,
          file_type: "".to_owned(),
          size,
          created: created.second() as u128,
          modified: modified.second() as u128,
          accessed: accessed.second() as u128,
        },
        children: vec![],
      }));
      ref_dir
    });

    match root {
      None => root = Some(parent),
      Some(r) if r.len() > parent.len() => {
        root = Some(parent.clone());
      }
      _ => (),
    }

    parent_file_stat.borrow_mut().children.push(ref_file);
  }
  let root = root.ok_or(AppError::new("fail to read zip file"))?;
  let root = file_map
    .get(&root)
    .ok_or(AppError::new("fail to read zip file"))?
    .clone();
  Ok(root)
}

pub fn rel_join(p1: &str, p2: &str) -> Result<String, AppError> {
  let p = secure_join(&PathBuf::from_str(p1)?, &PathBuf::from_str(p2)?)?;
  Ok(p.to_string_lossy().to_string())
}

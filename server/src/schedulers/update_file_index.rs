use chrono::NaiveTime;
use clokwerk::{Job, ScheduleHandle, Scheduler, TimeUnits};
use lazy_static::lazy_static;
use serde::Serialize;
use std::{
  collections::HashMap,
  path::{PathBuf, StripPrefixError},
  sync::{Arc, Mutex, RwLock},
  thread::{self, sleep},
  time::{Duration, SystemTime, UNIX_EPOCH},
};
use walkdir::WalkDir;

use crate::{
  config,
  db::SHARED_DB_CONN,
  models::{FileIndex, NewFileIndex},
  utils::{
    doc_parser::try_parse_sync,
    error::AppError,
    search_engine::{self, insert_docs, Doc},
  }, conv_err,
};

lazy_static! {
  pub static ref JOB_UPDATE_GALLERY: Arc<Mutex<UpdateGalleryJob>> =
    Arc::new(Mutex::new(UpdateGalleryJob::new()));
}

conv_err!(StripPrefixError);
conv_err!(walkdir::Error);

#[derive(Clone, Serialize, Debug)]
pub enum JobStatus {
  Running(u64),
  Idle,
  Error(String),
}

pub struct UpdateGalleryJob {
  schedule_handle: Option<ScheduleHandle>,
  file_root: Option<PathBuf>,
  status: Arc<RwLock<JobStatus>>,
}

impl UpdateGalleryJob {
  pub fn new() -> Self {
    Self {
      schedule_handle: None,
      file_root: None,
      status: Arc::new(RwLock::new(JobStatus::Idle)),
    }
  }

  pub fn set_file_root(&mut self, file_root: &PathBuf) {
    self.file_root = Some(file_root.clone());
  }

  pub fn stop(&mut self) {
    if let Some(_) = self.schedule_handle {
      let s = self.schedule_handle.take().unwrap();
      s.stop();
    }
  }

  fn cleanup_db(updated_at_str: String) -> Result<(), AppError> {
    use crate::schema::file_index::dsl::*;
    use crate::schema::file_index::table;
    use diesel::prelude::*;
    let mut conn = SHARED_DB_CONN.lock().unwrap();
    let conn = &mut *conn;
    let _ = diesel::delete(table.filter(updated_at.is_not(&updated_at_str)))
      .execute(conn)
      .unwrap();
    search_engine::cleanup(&updated_at_str).unwrap();
    // let max_stale_secs = 3600 * 24 * 7;
    // search_engine::cleanup_stale_data(max_stale_secs).unwrap();
    Ok(())
  }

  pub fn delete_file_indices(files: Vec<String>) -> Result<(), AppError> {
    use crate::schema::file_index::dsl::*;
    use crate::schema::file_index::table;
    use diesel::prelude::*;
    let mut conn = SHARED_DB_CONN.lock().unwrap();
    let conn = &mut *conn;
    let effect = diesel::delete(table.filter(file_path.eq_any(&files)))
      .execute(conn)
      .unwrap();
    println!("delete effect {effect} {files:?}");
    search_engine::delete(&files).unwrap();
    Ok(())
  }

  pub fn update_file_indices(files: Vec<String>, file_root: &PathBuf) -> Result<(), AppError> {
    let now = SystemTime::now()
      .duration_since(UNIX_EPOCH)?
      .as_millis()
      .to_string();
    Self::insert_files_into_db(files, now, file_root).unwrap();
    Ok(())
  }

  fn insert_files_into_db(
    images: Vec<String>,
    now: String,
    file_root: &PathBuf,
  ) -> Result<(), AppError> {
    use crate::schema::file_index::dsl::*;
    use crate::schema::file_index::table;
    use diesel::prelude::*;

    let mut conn = SHARED_DB_CONN.lock().unwrap();
    let conn = &mut *conn;
    let exists = file_index
      .filter(file_path.eq_any(&images))
      .load::<FileIndex>(conn)?;

    let set: HashMap<String, FileIndex> = exists
      .into_iter()
      .map(|img| (img.file_path.clone(), img))
      .collect();
    let mut to_insert_docs = vec![];
    let mut to_insert: Vec<NewFileIndex> = vec![];

    for f in images {
      let p = file_root.join(&f);
      let mime = mime_guess::from_path(&p);
      let mime: Vec<_> = mime.into_iter().map(|m| m.to_string()).collect();
      let mime_joined = mime.join("|");
      let meta = p.metadata().unwrap();
      let path_str = p.to_string_lossy().to_string();

      let last = set.get(&f);
      let created_at_ = meta
        .created()?
        .duration_since(UNIX_EPOCH)?
        .as_millis()
        .to_string();
      let modified_at_ = meta
        .modified()?
        .duration_since(UNIX_EPOCH)?
        .as_millis()
        .to_string();
      let file_name_ = p.file_name().unwrap().to_string_lossy().to_string();

      let mut should_update = true;
      if let Some(last) = last {
        if last.modified_at != modified_at_ {
          should_update = true;
        }
      } else {
        should_update = true;
      }
      if should_update {
        let body = try_parse_sync(&path_str, &mime_joined, meta.len()).map_or(None, |v| v);
        if let Some(body) = body {
          to_insert_docs.push(Doc {
            body,
            path: f.clone(),
            name: file_name_.clone(),
          })
        }
      }

      to_insert.push(NewFileIndex {
        file_name: file_name_.clone(),
        file_path: f,
        size: meta.len() as i64,
        format: Some(mime_joined),
        username: "".to_owned(),
        created_at: created_at_,
        modified_at: modified_at_,
        updated_at: now.clone(),
        is_dir: meta.is_dir(),
      });
    }
    insert_docs(to_insert_docs, &now)?;
    diesel::insert_into(table).values(to_insert).execute(conn)?;
    Ok(())
  }

  pub fn get_status(&self) -> JobStatus {
    let status = self.status.read().unwrap().clone();
    status
  }

  pub fn update_immediate(&self) {
    let status = self.status.clone();
    let file_root = self.file_root.clone();
    thread::spawn(move || {
      Self::update(status.clone(), file_root.as_ref().unwrap()).unwrap_or_else(|err| {
        *status.write().unwrap() = JobStatus::Error(err.to_string());
      });
    });
  }

  fn update(status: Arc<RwLock<JobStatus>>, file_root: &PathBuf) -> Result<(), AppError> {
    let mut status_lock = status.write().unwrap();
    match *status_lock {
      JobStatus::Idle => *status_lock = JobStatus::Running(0),
      JobStatus::Running(_) => return Ok(()),
      JobStatus::Error(_) => {
        JobStatus::Running(0);
      }
    };
    drop(status_lock);

    let file_root = file_root.clone();
    let now = SystemTime::now()
      .duration_since(UNIX_EPOCH)?
      .as_millis()
      .to_string();
    let mut images = vec![];
    let follow_link = config!(indexing_follow_link);
    for entry in WalkDir::new(&file_root).follow_links(follow_link) {
      let entry = entry?;
      let dir = entry.path().strip_prefix(file_root.clone())?;
      images.push(dir.to_string_lossy().to_string());
      if images.len() > 25 {
        let len = images.len() as u64;
        let to_insert = images.drain(..).collect();
        Self::insert_files_into_db(to_insert, now.clone(), &file_root)?;
        let mut status_lock = status.write().unwrap();
        if let JobStatus::Running(sum) = *status_lock {
          *status_lock = JobStatus::Running(sum + len);
        }
        sleep(std::time::Duration::from_millis(200));
        drop(status_lock);
      }
    }
    if images.len() > 0 {
      let len = images.len() as u64;
      Self::insert_files_into_db(images, now.clone(), &file_root)?;
      let mut status_lock = status.write().unwrap();
      if let JobStatus::Running(sum) = *status_lock {
        *status_lock = JobStatus::Running(sum + len);
      }
    }
    Self::cleanup_db(now.clone())?;
    *status.write().unwrap() = JobStatus::Idle;
    Ok(())
  }

  pub fn init(&mut self, at_time: NaiveTime) -> Result<(), AppError> {
    self.stop();
    // Create a new scheduler
    let mut scheduler = Scheduler::new();
    // Add some tasks to it

    let file_root = self.file_root.clone().unwrap();

    let status = self.status.clone();
    let run = move || {
      Self::update(status.clone(), &file_root).unwrap_or_else(|err| {
        *status.write().unwrap() = JobStatus::Error(err.to_string());
      });
    };
    scheduler.every(1.days()).at_time(at_time).run(run);

    // Or run it in a background thread
    let thread_handle = scheduler.watch_thread(Duration::from_millis(1000));
    // The scheduler stops when `thread_handle` is dropped, or `stop` is called
    self.schedule_handle = Some(thread_handle);
    Ok(())
  }
}

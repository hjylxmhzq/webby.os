use actix_web::http::StatusCode;

use super::error::AppError;
use std::path::PathBuf;

/// make sure the joined path is a sub path of root
/// e.g. join("a", "b") -> "a/b"
///      join("a", "../b") -> error
/// this function only care about '..', but ignore link
/// for example: link /a/b/c -> /c, then join("/a/b", "c") -> "a/b/c"
pub fn secure_join(root: &PathBuf, unsafe_path: &PathBuf) -> Result<PathBuf, AppError> {
  if unsafe_path.has_root() {
    return Err(
      AppError::new(&format!("path error: path has root {:?}", unsafe_path))
        .with_status(StatusCode::BAD_REQUEST),
    );
  };
  for s in unsafe_path.components() {
    if let std::path::Component::ParentDir = s {
      return Err(
        AppError::new(&format!("path error: {unsafe_path:?}")).with_status(StatusCode::BAD_REQUEST),
      );
    }
  }
  let new_path = root.join(unsafe_path);
  Ok(new_path)
}

/// this function care about ".." but also link
/// A strict version of secure_join(..)
#[allow(unused)]
pub fn secure_join_strict(root: &PathBuf, unsafe_path: &PathBuf) -> Result<PathBuf, AppError> {
  if unsafe_path.has_root() {
    return Err(
      AppError::new(&format!("path error: path has root {:?}", unsafe_path))
        .with_status(StatusCode::BAD_REQUEST),
    );
  }
  let new_path = root.join(unsafe_path);
  let t1 = new_path.canonicalize()?;
  let t2 = root.canonicalize()?;

  let nc = t1.components();
  let rc = t2.components();

  if nc.into_iter().count() < rc.into_iter().count() {
    return Err(
      AppError::new(&format!("path error: {:?}", unsafe_path)).with_status(StatusCode::BAD_REQUEST),
    );
  }
  Ok(new_path)
}

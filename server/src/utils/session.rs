use actix_session::Session;

use crate::UserSessionData;

use super::error::AppError;

pub fn is_login(sess: &Session) -> Result<bool, AppError> {
  let user_data = sess.get::<UserSessionData>("user")?;
  if let Some(user_data) = user_data {
    return Ok(user_data.is_login);
  }
  Ok(false)
}

pub fn get_user_data(sess: &Session) -> Result<UserSessionData, AppError> {
  let user_data = sess
    .get::<UserSessionData>("user")?
    .ok_or(AppError::new("no user session data"))?;

  return Ok(user_data);
}

pub trait SessionUtils {
  fn is_login(&self) -> Result<bool, AppError>;
  fn get_user_data(&self) -> Result<UserSessionData, AppError>;
  fn get_user_root(&self) -> Result<String, AppError>;
  fn is_csrf_token_valid(&self, csrf_token: &str) -> Result<bool, AppError>;
  fn set_csrf_token(&mut self, csrf_token: &str) -> Result<bool, AppError>;
}

impl SessionUtils for Session {
  fn is_csrf_token_valid(&self, csrf_token: &str) -> Result<bool, AppError> {
    let csrf = self.get::<String>("csrf_token")?;
    if let Some(csrf) = csrf {
      return Ok(csrf == csrf_token);
    }
    Ok(false)
  }
  fn set_csrf_token(&mut self, csrf_token: &str) -> Result<bool, AppError> {
    self.insert("csrf_token", csrf_token.to_string())?;
    Ok(true)
  }
  fn is_login(&self) -> Result<bool, AppError> {
    is_login(self)
  }
  fn get_user_data(&self) -> Result<UserSessionData, AppError> {
    get_user_data(self)
  }
  fn get_user_root(&self) -> Result<String, AppError> {
    let data = self.get_user_data()?;
    Ok(data.user_root)
  }
}

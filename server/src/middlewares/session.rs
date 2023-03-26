use actix_session::{
  config::{CookieContentSecurity, PersistentSession},
  storage::{self, SessionKey, SessionStore},
  SessionMiddleware,
};
use actix_web::{cookie::Key, http::header::InvalidHeaderValue};
use chrono::Utc;
use std::{collections::HashMap, sync::RwLock};
use time::Duration;

use crate::{utils::error::AppError, conv_err};

conv_err!(InvalidHeaderValue);

pub fn session() -> SessionMiddleware<MemorySessionStore> {
  let session_ttl = PersistentSession::default();
  let session_ttl = session_ttl.session_ttl(actix_web::cookie::time::Duration::days(30));
  let store = MemorySessionStore::new();
  SessionMiddleware::builder(store, Key::from(&[0; 64]))
    .cookie_secure(false)
    .cookie_content_security(CookieContentSecurity::Private)
    .session_lifecycle(session_ttl)
    .build()
}

pub struct MemorySessionStore {}

lazy_static::lazy_static! {
  static ref STATE: RwLock<HashMap<String, InternalState>> = {
    RwLock::new(HashMap::new())
  };
}

struct InternalState {
  ttl: chrono::DateTime<Utc>,
  state: SessionState,
}

impl InternalState {
  fn new(ttl: &Duration, state: SessionState) -> Self {
    let expires = ttl_to_expires(ttl);
    Self {
      ttl: expires,
      state,
    }
  }
}

type SessionState = HashMap<String, String>;

impl MemorySessionStore {
  pub fn new() -> Self {
    Self {}
  }
}

impl SessionStore for MemorySessionStore {
  fn save<'life0, 'life1, 'async_trait>(
    &'life0 self,
    session_state: SessionState,
    ttl: &'life1 Duration,
  ) -> core::pin::Pin<
    Box<
      dyn core::future::Future<Output = Result<storage::SessionKey, storage::SaveError>>
        + 'async_trait,
    >,
  >
  where
    'life0: 'async_trait,
    'life1: 'async_trait,
    Self: 'async_trait,
  {
    Box::pin(async move {
      let key = uuid::Uuid::new_v4().to_string();
      let mut state = STATE.write().unwrap();

      state.insert(key.clone(), InternalState::new(ttl, session_state.clone()));

      let now = chrono::Utc::now();
      let mut to_delete = vec![];
      for s in state.iter() {
        if s.1.ttl < now {
          to_delete.push(s.0.clone());
        }
      }
      for key in to_delete {
        state.remove(&key);
      }

      let sess_key: SessionKey = key.try_into().unwrap();
      Ok(sess_key)
    })
  }

  fn load<'life0, 'life1, 'async_trait>(
    &'life0 self,
    session_key: &'life1 SessionKey,
  ) -> core::pin::Pin<
    Box<
      dyn core::future::Future<Output = Result<Option<SessionState>, storage::LoadError>>
        + 'async_trait,
    >,
  >
  where
    'life0: 'async_trait,
    'life1: 'async_trait,
    Self: 'async_trait,
  {
    Box::pin(async move {
      let state = STATE.read().unwrap();
      let internal_state = state.get(session_key.as_ref());
      if let Some(internal_state) = internal_state {
        return Ok(Some(internal_state.state.clone()));
      }
      Ok(None)
    })
  }

  fn delete<'life0, 'life1, 'async_trait>(
    &'life0 self,
    session_key: &'life1 SessionKey,
  ) -> core::pin::Pin<
    Box<dyn core::future::Future<Output = Result<(), anyhow::Error>> + 'async_trait>,
  >
  where
    'life0: 'async_trait,
    'life1: 'async_trait,
    Self: 'async_trait,
  {
    Box::pin(async move {
      let mut state = STATE.write().unwrap();

      state.remove(session_key.as_ref());

      let now = chrono::Utc::now();
      let mut to_delete = vec![];
      for s in state.iter() {
        if s.1.ttl > now {
          to_delete.push(s.0.clone());
        }
      }
      for key in to_delete {
        state.remove(&key);
      }

      Ok(())
    })
  }

  fn update<'life0, 'life1, 'async_trait>(
    &'life0 self,
    session_key: SessionKey,
    session_state: SessionState,
    ttl: &'life1 Duration,
  ) -> core::pin::Pin<
    Box<dyn core::future::Future<Output = Result<SessionKey, storage::UpdateError>> + 'async_trait>,
  >
  where
    'life0: 'async_trait,
    'life1: 'async_trait,
    Self: 'async_trait,
  {
    Box::pin(async move {
      let key = session_key.as_ref();
      let mut state = STATE.write().unwrap();
      let internal_state = state.entry(key.to_owned());
      let expires = ttl_to_expires(ttl);
      internal_state.and_modify(|s| {
        s.state = session_state;
        s.ttl = expires;
      });
      Ok(session_key)
    })
  }

  fn update_ttl<'life0, 'life1, 'life2, 'async_trait>(
    &'life0 self,
    session_key: &'life1 SessionKey,
    ttl: &'life2 Duration,
  ) -> core::pin::Pin<
    Box<dyn core::future::Future<Output = Result<(), anyhow::Error>> + 'async_trait>,
  >
  where
    'life0: 'async_trait,
    'life1: 'async_trait,
    'life2: 'async_trait,
    Self: 'async_trait,
  {
    Box::pin(async move {
      let key = session_key.as_ref();
      let mut state = STATE.write().unwrap();
      let internal_state = state.entry(key.to_owned());
      let expires = ttl_to_expires(ttl);
      internal_state.and_modify(|s| s.ttl = expires);
      Ok(())
    })
  }
}

fn ttl_to_expires(ttl: &Duration) -> chrono::DateTime<Utc> {
  let secs = ttl.as_seconds_f64();
  let ttl = chrono::Duration::from_std(std::time::Duration::from_secs_f64(secs)).unwrap();
  let expires = chrono::Utc::now() + ttl;
  expires
}

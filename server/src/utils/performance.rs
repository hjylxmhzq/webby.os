use std::{collections::HashMap, sync::Mutex, time::Instant};

use lazy_static::lazy_static;

lazy_static! {
  static ref TIMER_SET: Mutex<HashMap<String, Instant>> = Mutex::new(HashMap::new());
}
#[allow(unused)]
pub fn timer(tag: &str) {
  let mut t = TIMER_SET.lock().unwrap();
  let instant = t.get(tag);
  if let Some(instant) = instant {
    let duration = instant.elapsed();
    println!("{tag}: {duration:?}");
    t.remove(tag);
  } else {
    let now = std::time::Instant::now();
    t.insert(tag.to_string(), now);
  }
}

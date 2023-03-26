use std::{collections::HashMap, fmt::Debug, hash::Hash, sync::Mutex};

pub type Listener<P> = Box<dyn Fn(P) -> ()>;

pub struct EventEmitter<ET, P> {
  events: Mutex<HashMap<ET, Vec<Listener<P>>>>,
}

unsafe impl<T, P> Sync for EventEmitter<T, P> {}
unsafe impl<T, P> Send for EventEmitter<T, P> {}

impl<ET: PartialEq + Eq + Hash + Clone + Debug, P: Clone> EventEmitter<ET, P> {
  pub fn new() -> Self {
    Self {
      events: Mutex::new(HashMap::new()),
    }
  }
  pub fn emit(&mut self, event: ET, payload: P) {
    let mut v = self.events.lock().unwrap();
    println!("emit: {:?}", v.keys());
    let listeners = v.entry(event.clone()).or_insert(vec![]);
    for l in listeners {
      l(payload.clone());
    }
  }
  pub fn listen(&mut self, event: ET, cb: impl Fn(P) -> () + 'static) {
    println!("listen: {:?}", event);
    let b = Box::new(cb);
    let mut v = self.events.lock().unwrap();
    v.entry(event.clone()).or_insert(vec![]).push(b);
  }
}

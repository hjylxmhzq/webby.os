use actix_web::body::{BodySize, MessageBody};
use actix_web::web::Bytes;
use futures::{ready, Stream};
use std::error::Error as StdError;
use std::pin::Pin;
use std::task::{Context, Poll};

pub struct RangeStream<S> {
  size: u64,
  stream: Pin<Box<S>>,
  read_bytes: u64,
}

impl<S, E> RangeStream<S>
where
  S: Stream<Item = Result<Bytes, E>>,
  E: Into<Box<dyn StdError>> + 'static,
{
  #[inline]
  pub fn new(size: u64, stream: S) -> Self {
    RangeStream {
      size,
      stream: Box::pin(stream),
      read_bytes: 0,
    }
  }
}

// read specific size of bytes from stream
impl<S, E> MessageBody for RangeStream<S>
where
  S: Stream<Item = Result<Bytes, E>> + Unpin,
  E: Into<Box<dyn StdError>> + 'static,
{
  type Error = E;

  #[inline]
  fn size(&self) -> BodySize {
    BodySize::Sized(self.size)
  }

  /// Attempts to pull out the next value of the underlying [`Stream`].
  ///
  /// Empty values are skipped to prevent [`SizedStream`]'s transmission being
  /// ended on a zero-length chunk, but rather proceed until the underlying
  /// [`Stream`] ends.
  fn poll_next(
    mut self: Pin<&mut Self>,
    cx: &mut Context<'_>,
  ) -> Poll<Option<Result<Bytes, Self::Error>>> {
    loop {
      let stream = &mut self.as_mut().stream;
      let s = stream.as_mut();
      let chunk = match ready!(s.poll_next(cx)) {
        Some(Ok(ref bytes)) if bytes.is_empty() => continue,
        val => {
          let ret;
          if let Some(Ok(ref r)) = val {
            let len = r.len() as u64;
            let mut p = self.as_mut();
            let read_bytes = p.read_bytes;
            let size = p.size;
            if read_bytes >= size {
              ret = None;
            } else {
              if read_bytes + len > size {
                let overflow = size - read_bytes;
                let r = &r[..overflow as usize];
                ret = Some(Ok(Bytes::copy_from_slice(&r[..overflow as usize])));
              } else {
                ret = val;
              }
            }
            p.read_bytes += len;
          } else {
            ret = val;
          }
          ret
        }
      };

      return Poll::Ready(chunk);
    }
  }
}

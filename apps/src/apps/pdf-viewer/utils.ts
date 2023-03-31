
export function debounce<T extends Function>(fn: T, delay = 500, mw?: (...args: any[]) => any) {
  let timer: number | undefined;
  return (...args: any[]) => {
    let v: any;
    if (mw) {
      v = mw(...args);
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn(...args, v);
    }, delay);
  }
}

export function debounceThrottle<T extends Function>(fn: T, delay = 500, mw?: (...args: any[]) => any) {
  let isPending = false;
  let hasWaitingTask = false;
  let v: any;
  return async (...args: any[]) => {
    if (mw) {
      v = mw(...args);
    }
    if (isPending) {
      hasWaitingTask = true;
      return;
    } else {
      hasWaitingTask = false;
    }
    isPending = true;
    await fn(...args, v);
    window.setTimeout(async () => {
      if (hasWaitingTask) {
        await fn(...args, v);
      }
      isPending = false;
    }, delay);
  }
}

export function debounce<T extends Function>(fn: T, delay = 500) {
  let timer: number | undefined;
  return (...args: any[]) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn(...args);
    }, delay);
  }
}

export function fullscreen(el: HTMLElement) {
  let elem: any = el; 
  if (elem.requestFullScreen) {
    elem.requestFullScreen();
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullScreen) {
    elem.webkitRequestFullScreen();
  } else if (elem.webkitEnterFullScreen) {
    elem.webkitEnterFullScreen();
  }
}
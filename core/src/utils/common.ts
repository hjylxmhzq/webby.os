export function debounce<T extends Function>(fn: T, delay = 500) {
  let timer: number | undefined;
  let cachedArgs: any[] = [];
  return (...args: any[]) => {
    cachedArgs = args;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn(...cachedArgs);
    }, delay);
  }
}

export async function fullscreen(el: HTMLElement): Promise<void> {
  const elem: any = el; 
  if (elem.requestFullScreen) {
    return await elem.requestFullScreen();
  } else if (elem.mozRequestFullScreen) {
    return await elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullScreen) {
    return await elem.webkitRequestFullScreen();
  } else if (elem.webkitEnterFullScreen) {
    return await elem.webkitEnterFullScreen();
  }
}
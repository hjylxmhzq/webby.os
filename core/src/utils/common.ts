declare global {
  interface Document {
    mozCancelFullScreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
    webkitExitFullscreen?: () => Promise<void>;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
    webkitFullscreenElement?: Element;
  }

  interface HTMLElement {
    msRequestFullscreen?: () => Promise<void>;
    mozRequestFullscreen?: () => Promise<void>;
    webkitRequestFullscreen?: () => Promise<void>;
  }
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay = 500) {
  let timer: number | undefined;
  let cachedArgs: unknown[] = [];
  return (...args: any[]) => {
    cachedArgs = args;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn(...cachedArgs);
    }, delay);
  }
}

export async function fullscreen(elem: HTMLElement): Promise<void> {
  if (elem.requestFullscreen) {
    return await elem.requestFullscreen();
  } else if (elem.mozRequestFullscreen) {
    return await elem.mozRequestFullscreen();
  } else if (elem.webkitRequestFullscreen) {
    return await elem.webkitRequestFullscreen();
  } else {
    throw new Error('fullscreen api is not supported');
  }
}

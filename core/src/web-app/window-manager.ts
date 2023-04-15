import EventEmitter from "events";
import { commonCollection } from "../kv-storage";
import { AppWindow } from ".";
import zIndexManager from "./z-index-manager";
import style from './index.module.less';

enum WindowEventType {
  BeforeClose = 'BeforeClose',
  WindowMin = 'WindowMin',
}

function getRectByElementStyle(el: HTMLElement) {
  const style = getComputedStyle(el);
  const { left, top, width, height } = style;
  if (!left || !top || !width || !height) {
    throw new Error('not position element');
  }
  const rect = {
    left: parseFloat(left),
    top: parseFloat(top),
    width: parseFloat(width),
    height: parseFloat(height),
  };
  return rect;
}

export class WindowManager {
  createWindow(appName: string, appContainer: HTMLElement): AppWindow {
    const windowEventBus = new EventEmitter();

    const clientWidth = document.documentElement.clientWidth;
    const clientHeight = document.documentElement.clientHeight;

    const appEl = document.createElement('div');
    appEl.id = 'app-' + appName;
    appEl.style.width = '500px';
    appEl.style.height = '500px';
    appEl.style.position = 'fixed';
    appEl.style.left = clientWidth / 2 - 250 + 'px';
    appEl.style.top = clientHeight / 2 - 250 + 'px';
    appEl.style.boxShadow = 'var(--box-shadow)';
    appEl.style.borderRadius = '10px';
    appEl.style.backgroundColor = 'white';
    appEl.style.overflow = 'hidden';
    appEl.style.color = 'var(--font-color)';
    appEl.style.backgroundColor = 'var(--bg-medium-hover)';
    appEl.style.transition = 'transform 0.2s, opacity 0.2s, box-shadow 0.1s';
    appEl.style.outline = 'none';
    appEl.tabIndex = 0;
    zIndexManager.setTop(appEl);

    const setVisible = (visible: boolean) => {
      if (visible) {
        appEl.style.pointerEvents = 'all';
        appEl.style.opacity = '1';
        appEl.style.transform = 'scale(1)';
      } else {
        appEl.style.pointerEvents = 'none';
        appEl.style.opacity = '0';
        appEl.style.transform = 'scale(0.5)';
      }
    }

    const setActive = (active: boolean) => {
      if (active) {
        zIndexManager.setTop(appEl);
        appEl.style.boxShadow = 'var(--box-shadow-grow)';
      } else {
        appEl.style.boxShadow = 'var(--box-shadow-shrink)';
      }
    }

    appEl.style.opacity = '0';

    appEl.style.opacity = '1';
    const titleBar = document.createElement('div');
    titleBar.style.userSelect = 'none';
    titleBar.innerHTML = `<span style="${`display: flex;
    padding: 0 10px;
    height: 22px;
    font-size: 14px;
    background-image: var(--title-bar-bg-image);
    line-height: 22px;
    user-select: none;
    -webkit-user-select: none;
    align-items: center;
    position: relative;
    overflow: hidden;
  `}">
    <span class="app_window_close_btn" style="cursor: pointer;">
      <svg class="icon" aria-hidden="true">
        <use xlink:href="#icon-cross"></use>
      </svg>
    </span>
    <span class="app_window_minimize_btn" style="cursor: pointer;">
      <svg class="icon" aria-hidden="true">
        <use xlink:href="#icon-minus"></use>
      </svg>
    </span>
    <span class="title_text" style="flex-grow: 1;
    position: absolute;
    inset: 0;
    margin: 0 50px;
    overflow: hidden;
    text-overflow: ellipsis;"
    >${appName}</span>
    <span class="app_window_new_window_btn" style="cursor: pointer;">
      <svg class="icon" aria-hidden="true">
        <use xlink:href="#icon-windows"></use>
      </svg>
    </span>
  </span>`

    const closeBtn = titleBar.querySelector('.app_window_close_btn') as HTMLSpanElement;
    const minBtn = titleBar.querySelector('.app_window_minimize_btn') as HTMLSpanElement;
    const newWindowBtn = titleBar.querySelector('.app_window_new_window_btn') as HTMLSpanElement;
    closeBtn.classList.add(style['titlebar_btn'].trim());
    minBtn.classList.add(style['titlebar_btn'].trim());
    newWindowBtn.classList.add(style['titlebar_btn_right'].trim());
    newWindowBtn.addEventListener('click', () => {
      const size = getSize();
      const url = new URL(window.location.href);
      url.hash = `#app=${appName}`;
      let strWindowFeatures = `menubar=no,location=no,resizable=yes,scrollbars=no,status=no,width=${size.width},height=${size.height}`;
      window.open(url.href, `${appName}_window`, strWindowFeatures)
    });

    closeBtn.addEventListener('click', (e) => {
      windowEventBus.emit(WindowEventType.BeforeClose);
      setVisible(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setTimeout(() => {
        appEl.parentElement?.removeChild(appEl);
      }, 400);
    });
    closeBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    minBtn.addEventListener('click', (e) => {
      windowEventBus.emit(WindowEventType.WindowMin);
    });
    minBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    })
    const onMinimize = (cb: () => void) => {
      windowEventBus.on(WindowEventType.WindowMin, cb);
      return () => windowEventBus.off(WindowEventType.WindowMin, cb);
    };
    const resizeHandler = document.createElement('div');
    resizeHandler.innerHTML = `
  <div class="resize_handler resize_handler_left"></div>
  <div class="resize_handler resize_handler_top"></div>
  <div class="resize_handler resize_handler_right"></div>
  <div class="resize_handler resize_handler_bottom"></div>
  <div class="resize_handler resize_handler_left resize_handler_top"></div>
  <div class="resize_handler resize_handler_right resize_handler_top"></div>
  <div class="resize_handler resize_handler_left resize_handler_bottom"></div>
  <div class="resize_handler resize_handler_right resize_handler_bottom"></div>
  `;
    appEl.appendChild(resizeHandler);
    let resizing = 0;
    const horizonTop = 1;
    const verticalLeft = 1 << 1;
    const horizonBottom = 1 << 2;
    const verticalRight = 1 << 3;

    resizeHandler.addEventListener('mousedown', (e) => {
      appContainer.style.pointerEvents = 'none';
      const el = (e.target as HTMLElement);
      resizing = 0;
      if (el.classList.contains('resize_handler')) {
        if (el.classList.contains('resize_handler_left')) {
          resizing = resizing | verticalLeft;
        }
        if (el.classList.contains('resize_handler_right')) {
          resizing = resizing | verticalRight;
        }
        if (el.classList.contains('resize_handler_top')) {
          resizing = resizing | horizonTop;
        }
        if (el.classList.contains('resize_handler_bottom')) {
          resizing = resizing | horizonBottom;
        }
        startElSize = [parseFloat(appEl.style.width), parseFloat(appEl.style.height)];
        startElPos = [parseFloat(appEl.style.left), parseFloat(appEl.style.top)];
        startCursorPos = [e.clientX, e.clientY];
        console.log(startElSize)
      }
    });
    const checkPos = () => {
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      const rect = getRectByElementStyle(appEl);
      if (rect.top < 25) {
        appEl.style.top = '25px';
      }
      if (rect.left + rect.width < 20) {
        appEl.style.left = (20 - rect.width) + 'px';
      }
      if (rect.left > width - 20) {
        appEl.style.left = (width - 20) + 'px';
      }
      if (rect.top > height - 25) {
        appEl.style.top = (height - 25) + 'px';
      }
    };
    const onMouseUp = () => {
      appContainer.style.pointerEvents = 'all';
      checkPos();
      resizing = 0;
      isMouseDown = false;
    };

    let isMouseDown = false;
    let startCursorPos = [0, 0];
    let startElPos = [0, 0];
    let startElSize = [0, 0];
    titleBar.addEventListener('mousedown', (e) => {
      appContainer.style.pointerEvents = 'none';
      isMouseDown = true;
      startCursorPos = [e.clientX, e.clientY];
      startElPos = [parseFloat(appEl.style.left), parseFloat(appEl.style.top)];
    });
    window.addEventListener('mouseup', onMouseUp);
    const onResizeCbs: ((w: number, h: number) => void)[] = [];
    const onMoveCbs: ((left: number, top: number) => void)[] = [];
    const onWindowResize = (cb: (w: number, h: number) => void) => {
      onResizeCbs.push(cb);
      return () => {
        const idx = onResizeCbs.findIndex(c => c === cb);
        if (idx > -1) {
          onResizeCbs.splice(idx, 1);
        }
      }
    }
    const onWindowMove = (cb: (left: number, top: number) => void) => {
      onMoveCbs.push(cb);
      return () => {
        const idx = onMoveCbs.findIndex(c => c === cb);
        if (idx > -1) {
          onMoveCbs.splice(idx, 1);
        }
      }
    }
    const onMouseMove = (e: MouseEvent) => {
      let _w = startElSize[0];
      let _h = startElSize[1];
      let _left = startElPos[0];
      let _top = startElPos[1];
      if (resizing) {
        let delta = [e.clientX - startCursorPos[0], e.clientY - startCursorPos[1]];
        if (resizing & verticalRight) {
          const w = startElSize[0] + delta[0];
          if (w >= appWindow.minWidth) {
            _w = w;
            appEl.style.width = w + 'px';
          }
        }
        if (resizing & horizonBottom) {
          const h = startElSize[1] + delta[1];
          if (h >= appWindow.minHeight) {
            _h = h;
            appEl.style.height = h + 'px';
          }
        }
        if (resizing & horizonTop) {
          const h = startElSize[1] - delta[1];
          if (h >= appWindow.minHeight) {
            appEl.style.height = h + 'px';
            const top = startElPos[1] + delta[1];
            appEl.style.top = top + 'px';
            _h = h;
            _top = top;
          }
        }
        if (resizing & verticalLeft) {
          const w = startElSize[0] - delta[0];
          if (w >= appWindow.minWidth) {
            appEl.style.width = w + 'px';
            const left = startElPos[0] + delta[0]
            appEl.style.left = left + 'px';
            _w = w;
            _left = left;
          }
        }
        onMoveCbs.forEach(cb => cb(_left, _top));
        onResizeCbs.forEach(cb => cb(_w, _h));
      } else if (isMouseDown) {
        let delta = [e.clientX - startCursorPos[0], e.clientY - startCursorPos[1]];
        let left = startElPos[0] + delta[0];
        let top = startElPos[1] + delta[1];
        appEl.style.left = left + 'px';
        appEl.style.top = top + 'px';
        onMoveCbs.forEach(cb => cb(left, top));
      }
    }
    window.addEventListener('mousemove', onMouseMove);

    let isForceFullscreen = false;
    const forceFullscreenResizeCb = () => {
      const rect = getRect();
      onResizeCbs.forEach(cb => cb(rect.width, rect.height));
    }
    const foruceFullscreenBeforeClose = () => {
      windowEventBus.emit(WindowEventType.BeforeClose);
    }
    function forceFullscreen(fullscreen = true) {
      isForceFullscreen = fullscreen;
      if (fullscreen) {
        window.addEventListener('resize', forceFullscreenResizeCb);
        window.addEventListener('beforeunload', foruceFullscreenBeforeClose);
        appEl.style.inset = '25px 0 0 0';
        appEl.style.width = 'auto'
        appEl.style.height = 'auto';
        appEl.style.borderRadius = '0px';
      } else {
        window.removeEventListener('resize', forceFullscreenResizeCb);
        window.removeEventListener('beforeunload', foruceFullscreenBeforeClose);
        appEl.style.inset = 'none';
        appEl.style.width = '500px';
        appEl.style.height = '500px';
        appEl.style.borderRadius = '10px';
      }
    }

    function toggleFullscreen(force: boolean = false) {
      const rect = getRect();
      const dockHeight = 0;
      let tleft = 0;
      let ttop = 25;
      let twidth = document.documentElement.clientWidth;
      let theight = document.documentElement.clientHeight - 25 - dockHeight;
      if (force || (rect.width === twidth && theight === rect.height)) {
        twidth = lastRect.width;
        theight = lastRect.height;
        tleft = lastRect.left;
        ttop = lastRect.top
      } else {
        lastRect = getRect();
      }
      if (appEl.animate) {
        appEl.animate([{
          left: tleft + 'px',
          top: ttop + 'px',
          width: twidth + 'px',
          height: theight + 'px',
        }], {
          duration: 200,
          iterations: 1,
          easing: 'ease-in',
        }).addEventListener('finish', () => {
          appEl.style.left = tleft + 'px';
          appEl.style.top = ttop + 'px';
          appEl.style.width = twidth + 'px';
          appEl.style.height = theight + 'px';
          onResizeCbs.forEach(cb => cb(twidth, theight));
          onMoveCbs.forEach(cb => cb(tleft, ttop));
        });
      } else {
        appEl.style.left = tleft + 'px';
        appEl.style.top = ttop + 'px';
        appEl.style.width = twidth + 'px';
        appEl.style.height = theight + 'px';
        onResizeCbs.forEach(cb => cb(twidth, theight));
        onMoveCbs.forEach(cb => cb(tleft, ttop));
      }
    }

    titleBar.addEventListener('dblclick', () => {
      toggleFullscreen();
    });

    const mountPoint = document.createElement('div');
    appContainer.shadowRoot?.appendChild(mountPoint);

    appEl.appendChild(titleBar);
    appEl.appendChild(appContainer);

    appContainer.style.cssText = `position: absolute;
  background-color: var(--bg-medium-hover);
  top: 22px;
  bottom: 0;
  left: 0;
  right: 0;`;

    function showTitleBar(show: boolean = true) {
      if (!show) {
        (titleBar.firstElementChild as HTMLSpanElement).style.height = '0px';
        appContainer.style.top = '0px'
      } else {
        (titleBar.firstElementChild as HTMLSpanElement).style.height = '22px';
        appContainer.style.top = '22px'
      }
    }

    const titleText = titleBar.querySelector('.title_text') as HTMLSpanElement;
    const setTitle = (title: string) => {
      titleText!.innerText = title;
    };
    const focus = () => {
      appEl.focus();
    };
    const getSize = () => {
      const w = parseFloat(appEl.style.width);
      const h = parseFloat(appEl.style.height);
      return {
        width: w,
        height: h,
      }
    };

    const getPos = () => {
      const left = parseFloat(appEl.style.left);
      const top = parseFloat(appEl.style.top);
      return {
        left,
        top,
      }
    };
    const getRect = () => {
      const rect = appEl.getBoundingClientRect();
      return rect;
    }
    let lastRect = getRect();
    const setSize = (w: number, h: number) => {
      if (isForceFullscreen) return;
      lastRect = getRect();
      appEl.style.width = w + 'px';
      appEl.style.height = h + 'px';
      onResizeCbs.forEach(cb => cb(w, h));
    };
    const setPos = (left: number, top: number) => {
      if (isForceFullscreen) return;
      appEl.style.left = left + 'px';
      appEl.style.top = top + 'px';
      onMoveCbs.forEach(cb => cb(left, top));
    }
    const onActive = (cb: () => void) => {
      const fn = () => cb();
      appEl.addEventListener('mousedown', fn);
      return () => {
        appEl.removeEventListener('mousedown', fn);
      };
    }
    const onBeforeClose = (cb: () => void) => {
      windowEventBus.on(WindowEventType.BeforeClose, cb);
      return () => windowEventBus.off(WindowEventType.BeforeClose, cb);
    }
    let appWindow: AppWindow = {
      isMinimized: false,
      minWidth: 200,
      minHeight: 200,
      window: appEl,
      body: mountPoint,
      titleBar,
      setTitle,
      setVisible,
      setActive,
      focus,
      setSize,
      getSize,
      setPos,
      checkPos,
      onActive,
      onBeforeClose,
      onWindowMove,
      onWindowResize,
      getRect,
      getPos,
      onWindowMinimize: onMinimize,
      toggleFullscreen,
      showTitleBar,
      forceFullscreen,
    };
    return appWindow;
  }
}

const windowManager = new WindowManager();
export default windowManager;

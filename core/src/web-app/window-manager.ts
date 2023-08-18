import EventEmitter from "events";
import { AppWindow, ProcessState } from ".";
import zIndexManager from "./z-index-manager";
import style from './index.module.less';
import { debounce, fullscreen } from "../utils/common";
import { processManager } from "./process-manager";
import { AppDefinitionWithContainer } from "./app-manager";
import { removeFromArray } from "../utils/array";

const DOCK_HEIGHT = 25; // also defined in ./index.module.css

enum WindowEventType {
  BeforeClose = 'BeforeClose',
  WindowMin = 'WindowMin',
  Resize = 'Resize',
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
  newWindowOffset = 0;
  windows: AppWindow[] = [];
  checkActiveTimer: number;
  activeWindow: AppWindow | undefined;
  eventBus = new EventEmitter();
  container = document.body;
  constructor() {
    this.checkActiveTimer = window.setInterval(() => {
      let hasActive = false;
      for (let win of this.windows) {
        if (document.activeElement && win.window.contains(document.activeElement)) {
          hasActive = true;
          if (this.activeWindow !== win) {
            console.log(this.activeWindow, win, this.activeWindow === win)
            const oldWin = this.activeWindow;
            this.activeWindow = win;
            this.eventBus.emit('active_window_change', win, oldWin);
            win.setActive(true);
          }
        }
      };
    }, 200);

    window.addEventListener('mousedown', e => {
      let activeWin: AppWindow | undefined;
      for (const win of this.windows) {
        if (win.window.contains(e.target as Node)) {
          activeWin = win;
          break;
        }
      }
      if (activeWin && this.activeWindow !== activeWin) {
        activeWin.setActive(true)
        const oldWin = this.activeWindow;
        this.activeWindow = activeWin;
        this.eventBus.emit('active_window_change', this.activeWindow, oldWin);
      }
    })
    const onResize = debounce(() => {
      this.windows.forEach(win => {
        win.checkPos();
      });
    }, 200);
    window.addEventListener('resize', onResize);
  }

  setContainer(el: HTMLElement) {
    this.container = el;
  }

  onActiveWindowChange(cb: (win?: AppWindow, lastWin?: AppWindow) => any) {
    this.eventBus.on('active_window_change', cb);
    return () => {
      this.eventBus.off('active_window_change', cb);
    }
  }

  blurAll() {
    for (let win of this.windows) {
      win.setActive(false);
    }
  }

  createWindow(app: AppDefinitionWithContainer, windowId: string, process: ProcessState): AppWindow {
    const appName = app.name;
    const windowEventBus = new EventEmitter();

    const clientWidth = document.documentElement.clientWidth;
    const clientHeight = document.documentElement.clientHeight;

    const appEl = document.createElement('div');
    appEl.id = 'app-' + windowId;
    appEl.style.width = '700px';
    appEl.style.height = '500px';
    appEl.style.position = 'fixed';
    appEl.style.left = clientWidth / 2 - 380 + this.newWindowOffset + 'px';
    appEl.style.top = clientHeight / 2 - 280 + this.newWindowOffset + 'px';
    this.newWindowOffset = this.newWindowOffset > 100 ? 0 : this.newWindowOffset + 10;
    appEl.style.boxShadow = 'var(--box-shadow)';
    appEl.style.borderRadius = '10px';
    appEl.style.overflow = 'hidden';
    appEl.style.color = 'var(--font-color)';
    appEl.style.transition = 'transform 0.2s cubic-bezier(0.230, 1.000, 0.320, 1.000), opacity 0.2s, box-shadow 0.1s';
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
      const oldActiveWindow = this.activeWindow;
      if (active) {
        for (let win of this.windows) {
          if (win !== appWindow) {
            win.setActive(false);
          }
        }
        this.activeWindow = appWindow;
        zIndexManager.setTop(appEl);
        appEl.style.boxShadow = 'var(--box-shadow-grow)';
        this.eventBus.emit('active_window_change', this.activeWindow, oldActiveWindow);
      } else {
        appEl.style.boxShadow = 'var(--box-shadow-shrink)';
        this.activeWindow = undefined;
        this.eventBus.emit('active_window_change', undefined, oldActiveWindow);
      }
    }

    appEl.style.opacity = '0';

    appEl.style.opacity = '1';
    const titleBar = document.createElement('div');
    titleBar.style.userSelect = 'none';
    titleBar.style.backgroundColor = 'var(--bg-medium-hover)';
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
    text-align: center;
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
    <span class="app_window_fullscreen_btn" style="cursor: pointer;">
      <svg class="icon" aria-hidden="true">
        <use xlink:href="#icon-fullscreen"></use>
      </svg>
    </span>
    <span class="title_text" style="flex-grow: 1;
    position: absolute;
    inset: 0;
    margin: 0 50px 0 70px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;"
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
    const fullscreenBtn = titleBar.querySelector('.app_window_fullscreen_btn') as HTMLSpanElement;
    closeBtn.classList.add(style['titlebar_btn'].trim());
    minBtn.classList.add(style['titlebar_btn'].trim());
    fullscreenBtn.classList.add(style['titlebar_btn'].trim());
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
    });
    fullscreenBtn.addEventListener('click', () => {
      systemFullScreen();
    });
    const onMinimize = (cb: () => void) => {
      windowEventBus.on(WindowEventType.WindowMin, cb);
      return () => windowEventBus.off(WindowEventType.WindowMin, cb);
    };
    const resizeHandler = document.createElement('div');
    resizeHandler.innerHTML = `
  <div class="${style.resize_handler} ${style.resize_handler_left}"></div>
  <div class="${style.resize_handler} ${style.resize_handler_top}"></div>
  <div class="${style.resize_handler} ${style.resize_handler_right}"></div>
  <div class="${style.resize_handler} ${style.resize_handler_bottom}"></div>
  <div class="${style.resize_handler} ${style.resize_handler_left} ${style.resize_handler_top}"></div>
  <div class="${style.resize_handler} ${style.resize_handler_right} ${style.resize_handler_top}"></div>
  <div class="${style.resize_handler} ${style.resize_handler_left} ${style.resize_handler_bottom}"></div>
  <div class="${style.resize_handler} ${style.resize_handler_right} ${style.resize_handler_bottom}"></div>
  `;


    const appContainer = document.createElement('div');
    const shadow = appContainer.attachShadow({ mode: 'open' });
    const fakeFrame = document.createElement('div');
    const head = document.createElement('div');
    head.append(...app.scoped.head.cloneNode(true).childNodes)
    fakeFrame.appendChild(head);
    shadow.appendChild(fakeFrame);

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
      if (el.classList.contains(style.resize_handler)) {
        if (el.classList.contains(style.resize_handler_left)) {
          resizing = resizing | verticalLeft;
        }
        if (el.classList.contains(style.resize_handler_right)) {
          resizing = resizing | verticalRight;
        }
        if (el.classList.contains(style.resize_handler_top)) {
          resizing = resizing | horizonTop;
        }
        if (el.classList.contains(style.resize_handler_bottom)) {
          resizing = resizing | horizonBottom;
        }
        startElSize = [parseFloat(appEl.style.width), parseFloat(appEl.style.height)];
        startElPos = [parseFloat(appEl.style.left), parseFloat(appEl.style.top)];
        startCursorPos = [e.clientX, e.clientY];
      }
    });
    const checkPos = () => {
      if (isForceFullscreen) return;
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
    const onMoveCbs: ((left: number, top: number) => void)[] = [];
    const onWindowResize = (cb: (w: number, h: number) => void) => {
      windowEventBus.on(WindowEventType.Resize, cb);
      return () => {
        windowEventBus.off(WindowEventType.Resize, cb);
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
        // windowEventBus.emit(WindowEventType.Resize, _w, _h);
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
      windowEventBus.emit(WindowEventType.Resize, rect.width, rect.height);
    }
    const foruceFullscreenBeforeClose = () => {
      windowEventBus.emit(WindowEventType.BeforeClose);
    }
    function forceFullscreen(fullscreen = true) {
      isForceFullscreen = fullscreen;
      if (fullscreen) {
        // window.addEventListener(WindowEventType.Resize, forceFullscreenResizeCb);
        window.addEventListener('beforeunload', foruceFullscreenBeforeClose);
        appEl.style.inset = '0 0 0 0';
        appEl.style.width = 'auto'
        appEl.style.height = 'auto';
        appEl.style.borderRadius = '0px';
      } else {
        // window.removeEventListener(WindowEventType.Resize, forceFullscreenResizeCb);
        window.removeEventListener('beforeunload', foruceFullscreenBeforeClose);
        appEl.style.inset = 'none';
        appEl.style.width = '500px';
        appEl.style.height = '500px';
        appEl.style.borderRadius = '10px';
      }
    }

    function toggleFullscreen(force: boolean = false) {
      const rect = getRect();
      const dockHeight = processManager.appsInDock.length ? DOCK_HEIGHT : 0;
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
          easing: 'cubic-bezier(0.230, 1.000, 0.320, 1.000)',
        }).addEventListener('finish', () => {
          appEl.style.left = tleft + 'px';
          appEl.style.top = ttop + 'px';
          appEl.style.width = twidth + 'px';
          appEl.style.height = theight + 'px';
          // windowEventBus.emit(WindowEventType.Resize, twidth, theight);
          onMoveCbs.forEach(cb => cb(tleft, ttop));
        });
      } else {
        appEl.style.left = tleft + 'px';
        appEl.style.top = ttop + 'px';
        appEl.style.width = twidth + 'px';
        appEl.style.height = theight + 'px';
        // windowEventBus.emit(WindowEventType.Resize, twidth, theight);
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

    async function systemFullScreen() {
      await fullscreen(appContainer);
    }

    const onResizeDebounced = debounce((width: number, height: number) => {
      windowEventBus.emit(WindowEventType.Resize, width, height);
    });
    const resizeOb = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        onResizeDebounced(width, height);
      }
    });

    resizeOb.observe(appContainer);
    windowEventBus.on(WindowEventType.BeforeClose, () => {
      appEl.removeEventListener('mousedown', _setActive, false);
      appWindow.setActive(false)
      const idx = this.windows.indexOf(appWindow);
      if (idx > -1) {
        this.windows.splice(idx, 1);
      }
      const hasOtherWindow = this.windows.find(w => w.ownerApp.name === app.name);
      if (!hasOtherWindow) {
        const proc = processManager.getAppByName(app.name);
        if (proc) {
          proc.app.exit(proc.ctx);
        }
      }
      resizeOb.disconnect();
    });

    appContainer.style.cssText = `position: absolute;
  overflow: hidden;
  background-color: var(--bg-medium-hover);
  top: 22px;
  bottom: 0;
  left: 0;
  right: 0;`;

    const noBackground = (noBg: boolean) => {
      if (noBg) {
        appContainer.style.backgroundColor = 'transparent';
      } else {
        appContainer.style.backgroundColor = 'var(--bg-medium-hover)';
      }
    };
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
      // windowEventBus.emit(WindowEventType.Resize, w, h);
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
    const _setActive = () => {
      appWindow.setActive(true);
    }
    appEl.addEventListener('mousedown', _setActive, false);
    const onBeforeClose = (cb: () => void) => {
      windowEventBus.on(WindowEventType.BeforeClose, cb);
      removeFromArray(process.windows, appWindow);
      return () => windowEventBus.off(WindowEventType.BeforeClose, cb);
    }

    let appWindow: AppWindow = {
      ownerApp: app,
      ownerProcess: process,
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
      noBackground,
      getRect,
      getPos,
      onWindowMinimize: onMinimize,
      toggleFullscreen,
      showTitleBar,
      forceFullscreen,
    };
    this.container.append(appEl);
    this.windows.push(appWindow);
    // open window animation
    appWindow.setVisible(false);
    setTimeout(() => {
      appWindow.setVisible(true);
    });

    process.windows.push(appWindow);

    return appWindow;
  }
}

export const windowManager = new WindowManager();

export interface CreateAppWindowOptions {
  actived?: boolean;
}

const createAppWindowDefaultOptions = {
  actived: true,
}

export const createAppWindow = (id?: string, options: CreateAppWindowOptions = {}) => {
  options = { ...createAppWindowDefaultOptions, ...options };
  const __createAppWindow = (window as any).__createAppWindow;
  const appWin = __createAppWindow(id, options);
  return appWin as AppWindow;
}

import { has, makeAutoObservable } from "mobx";
import { Theme } from "src/hooks/common";
import { AppContext, AppInfo, AppState, AppWindow } from '@webby/core/web-app';
import './micro-app.less';
import { debounce } from "src/utils/common";
import EventEmitter from "events";

const eventbus = new EventEmitter();
const activeZIndex = '9999';
const nonactiveZIndex = '999';

const builtinApps = [
  ['file-browser', 'Files'],
  ['test', 'Test'],
  ['book', 'Book'],
  ['files', 'Cloud'],
  ['anime', 'Anime'],
];

builtinApps.forEach(([appScriptName, appName]) => {
  installBuiltinApp(appScriptName, appName);
});

export class WindowManager {
  public openedApps: AppState[] = [];
  public checkActiveTimer: number;
  public onResize: () => void;
  public eventBus = eventbus;
  public activeApp: AppState | null = null;
  constructor(public container: HTMLElement) {
    this.checkActiveTimer = window.setInterval(() => {
      if (document.activeElement && document.activeElement.tagName.toLowerCase() === 'iframe') {
        let hasActive = false;
        this.openedApps.forEach((app) => {
          if (app.ctx.appWindow.window.contains(document.activeElement)) {
            hasActive = true;
            if (this.activeApp !== app) {
              const oldApp = this.activeApp;
              this.activeApp = app;
              this.eventBus.emit('active_app_change', app, oldApp);
            }
            app.ctx.appWindow.setActive(true);
          } else {
            app.ctx.appWindow.setActive(false);
          }
        });
        if (!hasActive && this.activeApp) {
          this.eventBus.emit('active_app_change', null, this.activeApp);
          this.activeApp = null;
        }
      }
    }, 200);
    this.onResize = debounce(() => {
      this.openedApps.forEach(app => {
        app.ctx.appWindow.checkPos();
      });
    }, 200);
    window.addEventListener('resize', this.onResize);
  }
  updateActiveApp(app: AppState | null) {
    if (this.activeApp !== app) {
      const oldApp = this.activeApp;
      this.activeApp = app;
      this.eventBus.emit('active_app_change', app, oldApp);
      app?.ctx.appWindow.setActive(true);
      app?.ctx.appWindow.focus();
      this.openedApps.forEach(otherApp => {
        if (otherApp !== app) {
          otherApp.ctx.appWindow.setActive(false);
        }
      });
    }
  }
  getAppByName(name: string) {
    return this.openedApps.find(app => app.name === name);
  }
  destroy() {
    window.clearInterval(this.checkActiveTimer);
    window.removeEventListener('resize', this.onResize);
  }
  async postMessage(appName: string, message: any) {
    const app = this.openedApps.find(app => appName === app.name);
    if (app) {
      app.channel.postMessage(message);
    } else {
      console.error('app not opened');
    }
  }
  async startApp(appName: string) {
    let existApp = this.getAppByName(appName);
    if (existApp) {
      this.updateActiveApp(existApp);
      return;
    }
    const beforeClose = (app: AppState) => {
      app.app.unmount(app.ctx);
      let idx = this.openedApps.findIndex(app => app.name === appName);
      if (idx > -1) {
        this.openedApps.splice(idx, 1);
      }
      const oldApp = this.activeApp;
      this.activeApp = null;
      this.eventBus.emit('active_app_change', null, oldApp);
    };
    const onActive = (app: AppState) => {
      console.log('active', app)
      this.updateActiveApp(app);
    }
    let app = await startApp(this.container, appName, { beforeClose, onActive });
    if (!app) return;
    app.ctx.appWindow.setActive(true);
    app.ctx.appWindow.focus();
    this.openedApps.push(app);
    this.updateActiveApp(app);
  }
  async close(appName: string) {
    const app = this.openedApps.find(app => app.name === appName);
    if (app) {
      await app.app.unmount(app.ctx);
    }
  }
  async focus(appName: string) {
    this.openedApps.forEach(app => {
      app.ctx.appWindow.setActive(false);
    });
    let app = this.openedApps.find(app => appName === app.name);
    if (!app) return;
    app.ctx.appWindow.setActive(true);
  }
  async blur() {
    this.updateActiveApp(null);
  }
}

export async function installBuiltinApp(appScriptName: string, appName: string) {
  const appScript = '/apps/' + appScriptName + '.js';
  installApp(appScript, appName);
}

export async function installApp(src: string, appName: string) {
  await loadModule(src, appName);
}

export async function startApp(container: HTMLElement, appName: string, options: {
  beforeClose?: (app: AppState) => void,
  onActive?: (app: AppState) => void
}): Promise<AppState | undefined> {

  const app = appManager.get(appName);
  if (!app) {
    console.error('app not installed');
    return;
  }

  const appWindow = createAppWindow(appName, { beforeClose: () => options.beforeClose?.(appState), onActive: () => options.onActive?.(appState) });

  appWindow.setVisible(false);
  container.appendChild(appWindow.window);
  setTimeout(() => {
    appWindow.setVisible(true);
  });


  const { ctx, sender } = createContext(appWindow, 'light');
  await app.mount(ctx);
  let appState = {
    el: appWindow.window,
    name: appName,
    app: app,
    ctx: ctx,
    isActive: false,
    channel: sender,
  };
  return appState;
}

let nextWindowOffset = 0;
export function createAppWindow(appName: string, options: { beforeClose?: () => void, onActive?: () => void }): AppWindow {
  const clientWidth = document.documentElement.clientWidth;
  const clientHeight = document.documentElement.clientHeight;

  const appEl = document.createElement('div');
  appEl.id = 'app-' + appName;
  appEl.style.width = '500px';
  appEl.style.height = '500px';
  appEl.style.position = 'fixed';
  appEl.style.left = clientWidth / 2 - 250 + nextWindowOffset + 'px';
  appEl.style.top = clientHeight / 2 - 250 + nextWindowOffset + 'px';
  appEl.style.boxShadow = 'var(--box-shadow)';
  appEl.style.borderRadius = '10px';
  appEl.style.backgroundColor = 'white';
  appEl.style.overflow = 'hidden';
  appEl.style.zIndex = activeZIndex;
  appEl.style.color = 'var(--font-color)';
  appEl.style.backgroundColor = 'var(--bg-medium-hover)';
  appEl.style.transition = 'transform 0.2s, opacity 0.2s, box-shadow 0.1s';
  appEl.style.outline = 'none';
  appEl.tabIndex = 0;

  nextWindowOffset = (nextWindowOffset + 20) % 100;

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
      appEl.style.zIndex = activeZIndex;
      appEl.style.boxShadow = 'var(--box-shadow-grow)';
    } else {
      appEl.style.zIndex = nonactiveZIndex;
      appEl.style.boxShadow = 'var(--box-shadow-shrink)';
    }
  }

  appEl.style.opacity = '0';

  appEl.style.opacity = '1';
  const titleBar = document.createElement('div');
  titleBar.style.userSelect = 'none';
  titleBar.innerHTML = `<span style="${stylus(`display: flex;
    padding: 0 10px;
    height: 22px;
    font-size: 14px;
    background-color: var(--bg-medium);
    line-height: 22px;
    user-select: none;
  `)}"><span class="app_window_close_btn" style="cursor: pointer;">X</span><span class="title_text" style="flex-grow: 1;">${appName}</span></span>`
  const closeBtn = titleBar.querySelector('.app_window_close_btn') as HTMLSpanElement;
  closeBtn.addEventListener('click', (e) => {
    options.beforeClose?.();
    setVisible(false);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    setTimeout(() => {
      appEl.parentElement?.removeChild(appEl);
    }, 400);
  });
  closeBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  })

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
    mountPoint.style.pointerEvents = 'none';
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
    const rect = appEl.getBoundingClientRect();
    if (rect.top < 25) {
      appEl.style.top = '25px';
    }
    if (rect.right < 20) {
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
    mountPoint.style.pointerEvents = 'all';
    checkPos();
    resizing = 0;
    isMouseDown = false;
  };

  let isMouseDown = false;
  let startCursorPos = [0, 0];
  let startElPos = [0, 0];
  let startElSize = [0, 0];
  titleBar.addEventListener('mousedown', (e) => {
    mountPoint.style.pointerEvents = 'none';
    isMouseDown = true;
    startCursorPos = [e.clientX, e.clientY];
    startElPos = [parseFloat(appEl.style.left), parseFloat(appEl.style.top)];
  });
  window.addEventListener('mouseup', onMouseUp);
  const onMouseMove = (e: MouseEvent) => {
    if (resizing) {
      let delta = [e.clientX - startCursorPos[0], e.clientY - startCursorPos[1]];
      if (resizing & verticalRight) {
        let w = startElSize[0] + delta[0];
        if (w >= appWindow.minWidth) {
          appEl.style.width = w + 'px';
        }
      }
      if (resizing & horizonBottom) {
        let h = startElSize[1] + delta[1];
        if (h >= appWindow.minHeight) {
          appEl.style.height = h + 'px';
        }
      }
      if (resizing & horizonTop) {
        let h = startElSize[1] - delta[1];
        if (h >= appWindow.minHeight) {
          appEl.style.height = h + 'px';
          appEl.style.top = startElPos[1] + delta[1] + 'px';
        }
      }
      if (resizing & verticalLeft) {
        let w = startElSize[0] - delta[0];
        if (w >= appWindow.minWidth) {
          appEl.style.width = w + 'px';
          appEl.style.left = startElPos[0] + delta[0] + 'px';
        }
      }
    } else if (isMouseDown) {
      let delta = [e.clientX - startCursorPos[0], e.clientY - startCursorPos[1]];
      appEl.style.left = startElPos[0] + delta[0] + 'px';
      appEl.style.top = startElPos[1] + delta[1] + 'px';
    }
  }
  window.addEventListener('mousemove', onMouseMove);

  titleBar.addEventListener('dblclick', () => {
    const rect = getRect();
    let tleft = 0;
    let ttop = 25;
    let twidth = document.documentElement.clientWidth;
    let theight = document.documentElement.clientHeight - 25;
    if (rect.width === twidth && theight === rect.height) {
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
      });
    } else {
      appEl.style.left = tleft + 'px';
      appEl.style.top = ttop + 'px';
      appEl.style.width = twidth + 'px';
      appEl.style.height = theight + 'px';
    }
  });
  const mountPoint = document.createElement('div');
  appEl.appendChild(titleBar);
  appEl.appendChild(mountPoint);

  appEl.addEventListener('mousedown', () => {
    options.onActive?.();
  });

  mountPoint.style.cssText = `position: absolute;
  background-color: var(--bg-medium-hover);
  top: 22px;
  bottom: 0;
  left: 0;
  right: 0;`;

  const titleText = titleBar.querySelector('.title_text') as HTMLSpanElement;
  const setTitle = (title: string) => {
    titleText!.innerText = title;
  };
  const focus = () => {
    appEl.focus();
  };
  const getSize = () => {
    const rect = appEl.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    }
  };
  const getRect = () => {
    return appEl.getBoundingClientRect();
  }
  let lastRect = getRect();
  const setSize = (w: number, h: number) => {
    lastRect = getRect();
    appEl.style.width = w + 'px';
    appEl.style.height = h + 'px';
  };
  const setPos = (left: number, top: number) => {
    appEl.style.left = left + 'px';
    appEl.style.top = top + 'px';
  }
  let appWindow = {
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
  };
  return appWindow;
}

export function loadModule(src: string, moduleName: string): Promise<AppDefinition | undefined> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import { unmount, mount, getAppInfo } from "${src}";
      window._apps.register('${moduleName}', {
        unmount,
        mount,
        getAppInfo,
      });
    `;
    script.addEventListener('load', () => {
      script.parentElement?.removeChild(script);
      resolve(appManager.get(moduleName));
    });
    script.addEventListener('error', (err) => {
      reject(err);
    })
    document.body.appendChild(script);
  })
}

export function createContext(appWindow: AppWindow, theme: Theme) {
  const setWindowSize = (w: number, h: number) => {
    appWindow.window.style.width = w + 'px';
    appWindow.window.style.height = h + 'px';
  };
  const channel = new MessageChannel();

  const ctx: AppContext = {
    appRoot: appWindow.body.id,
    appRootEl: appWindow.body,
    appWindow,
    theme,
    setWindowSize,
    channel: channel.port2,
    systemMenu: [],
  };
  const _ctx = makeAutoObservable(ctx);
  return {
    ctx: _ctx,
    sender: channel.port1,
  };
}

export interface AppDefinition {
  mount(ctx: AppContext): Promise<void>;
  unmount(ctx: AppContext): Promise<void>;
  getAppInfo(): AppInfo;
}

export class AppsRegister {
  apps: { [appName: string]: AppDefinition };
  constructor() {
    this.apps = {};
    makeAutoObservable(this);
  }
  register(name: string, app: AppDefinition) {
    this.apps[name] = app;
  }
  get(appName: string): undefined | AppDefinition {
    return this.apps[appName];
  };
  all() {
    return Object.keys(this.apps);
  }
}

export const appManager = new AppsRegister();
(window as any)._apps = appManager;
function stylus(s: string) {
  return s.split('\n').join('');
}
import { makeAutoObservable } from "mobx";
import { Theme } from "src/hooks/common";
import { AppContext, AppInfo, AppState, AppWindow } from '@webby/core/web-app';
import './micro-app.less';
import { debounce } from "src/utils/common";
import EventEmitter from "events";
import { http } from '@webby/core/tunnel';
import { Collection } from "@webby/core/kv-storage";
import path from "path-browserify";

const store = new Collection('app_manager');
const eventbus = new EventEmitter();

class ZIndexManager {
  public zIndex = 1;
  public mapping: ([HTMLElement, number])[] = [];
  setTop(el: HTMLElement) {
    this.zIndex += 1;
    el.style.zIndex = this.zIndex + '';
    const idx = this.mapping.findIndex(([ele]) => ele === el);

    if (idx > -1) {
      this.mapping[idx][1] = this.zIndex;
    } else {
      this.mapping.push([el, this.zIndex]);
    }

    // rerange
    this.mapping = this.mapping.filter(([el]) => {
      if (document.contains(el)) {
        return true;
      }
      return false;
    });
    this.mapping.sort((a, b) => { return a[1] - b[1] });
    this.mapping.forEach(([el], idx) => {
      this.mapping[idx][1] = idx + 1;
      el.style.zIndex = idx + 1 + '';
    });
    this.zIndex = this.mapping.length;
  }
}
const zIndexManager = new ZIndexManager();

const builtinApps = [
  ['file-browser', 'Cloud'],
  ['test', 'Test'],
  ['book', 'Book'],
  ['files', 'Files'],
  ['anime', 'Anime'],
  ['image', 'Image'],
  ['text-editor', 'TextEditor'],
];

builtinApps.forEach(([appScriptName, appName]) => {
  installBuiltinApp(appScriptName, appName);
});

export class WindowManager {
  public openedApps: AppState[] = [];
  public checkActiveTimer?: number;
  public onResize?: () => void;
  public eventBus = eventbus;
  public activeApp: AppState | null = null;
  public cacheWindowPos: { [appName: string]: { width: number, height: number, left: number, top: number } } = {};
  public container: HTMLElement = document.body;
  public isInited = false;
  init(container: HTMLElement) {
    if (this.isInited) {
      throw new Error('window manager is already inited');
    }
    store.get('cacheWindowPos').then((v) => {
      if (v) {
        this.cacheWindowPos = JSON.parse(v);
      }
    });
    this.container = container;
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
  async openFile(file: string) {
    const ext = path.parse(file).ext;
    const apps = appManager.getSupportedAppsByExt(ext);
    if (apps.length) {
      await this.openFileBy(apps[0], file);
      return true;
    }
    return false;
  }
  async openFileBy(appName: string, file: string) {
    await this.startApp(appName);
    let existApp = this.getAppByName(appName);
    if (existApp) {
      existApp.eventBus.emit('open_file', file);
      return;
    }
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
    if (this.onResize) {
      window.removeEventListener('resize', this.onResize);
    }
    this.isInited = false;
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
    let app = await startApp(this.container, appName);
    if (!app) return;
    const beforeClose = () => {
      app!.app.unmount(app!.ctx);
      let idx = this.openedApps.findIndex(app => app.name === appName);
      if (idx > -1) {
        this.openedApps.splice(idx, 1);
      }
      const oldApp = this.activeApp;
      this.activeApp = null;
      unbindMove();
      unbindResize();
      this.eventBus.emit('active_app_change', null, oldApp);
    };
    const onActive = () => {
      this.updateActiveApp(app!);
    }
    app.ctx.appWindow.onBeforeClose(beforeClose);
    app.ctx.appWindow.onActive(onActive);
    if (this.cacheWindowPos[appName]) {
      const { width, height, left, top } = this.cacheWindowPos[appName];
      app.ctx.appWindow.setPos(left, top);
      app.ctx.appWindow.setSize(width, height);
    } else {
      const s = app!.ctx.appWindow.getSize();
      const p = app!.ctx.appWindow.getPos();
      this.cacheWindowPos[appName] = {
        width: s.width, height: s.height, left: p.left, top: p.top,
      }
    }
    let unbindMove = app.ctx.appWindow.onWindowMove(debounce((left: number, top: number) => {
      this.cacheWindowPos[appName].left = left;
      this.cacheWindowPos[appName].top = top;
      store.set('cacheWindowPos', JSON.stringify(this.cacheWindowPos));
    }, 1000));
    let unbindResize = app.ctx.appWindow.onWindowResize(debounce((w: number, h: number) => {
      this.cacheWindowPos[appName].width = w;
      this.cacheWindowPos[appName].height = h;
      store.set('cacheWindowPos', JSON.stringify(this.cacheWindowPos));
    }, 1000));
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

export async function startApp(container: HTMLElement, appName: string): Promise<AppState | undefined> {

  const app = appManager.get(appName);
  if (!app) {
    console.error('app not installed');
    return;
  }

  const appWindow = createAppWindow(appName, app.container);

  appWindow.setVisible(false);
  container.appendChild(appWindow.window);
  setTimeout(() => {
    appWindow.setVisible(true);
  });

  const { ctx, sender, eventBus } = createContext(appWindow, 'light');
  await app.mount(ctx);
  let appState = {
    el: appWindow.window,
    name: appName,
    app: app,
    ctx: ctx,
    isActive: false,
    channel: sender,
    eventBus,
  };
  return appState;
}

let nextWindowOffset = 0;
export function createAppWindow(appName: string, appContainer: HTMLElement): AppWindow {
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
  appEl.style.color = 'var(--font-color)';
  appEl.style.backgroundColor = 'var(--bg-medium-hover)';
  appEl.style.transition = 'transform 0.2s, opacity 0.2s, box-shadow 0.1s';
  appEl.style.outline = 'none';
  appEl.tabIndex = 0;
  zIndexManager.setTop(appEl);

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
  titleBar.innerHTML = `<span style="${stylus(`display: flex;
    padding: 0 10px;
    height: 22px;
    font-size: 14px;
    background-image: linear-gradient(0deg, #00000042, transparent);
    line-height: 22px;
    user-select: none;
  `)}"><span class="app_window_close_btn" style="cursor: pointer;">X</span><span class="title_text" style="flex-grow: 1;">${appName}</span></span>`
  const closeBtn = titleBar.querySelector('.app_window_close_btn') as HTMLSpanElement;
  let beforeCloseCbs: (() => void)[] = [];
  closeBtn.addEventListener('click', (e) => {
    for (let cb of beforeCloseCbs) {
      cb();
    }
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
    return appEl.getBoundingClientRect();
  }
  let lastRect = getRect();
  const setSize = (w: number, h: number) => {
    lastRect = getRect();
    appEl.style.width = w + 'px';
    appEl.style.height = h + 'px';
    onResizeCbs.forEach(cb => cb(w, h));
  };
  const setPos = (left: number, top: number) => {
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
    beforeCloseCbs.push(cb);
    return () => {
      const idx = beforeCloseCbs.findIndex(c => c === cb);
      if (idx > -1) {
        beforeCloseCbs.splice(idx, 1);
      }
    }
  }
  let appWindow: AppWindow = {
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
  };
  return appWindow;
}

export function loadModule(src: string, moduleName: string): Promise<AppDefinition | undefined> {
  return new Promise(async (resolve, reject) => {
    const script = document.createElement('script');
    let scriptContent;
    if (src.startsWith('http://') || src.startsWith('https://')) {
      const resp = await http.fetch(src, { method: 'get' });
      scriptContent = await resp.text();
    } else {
      const resp = await fetch(src, { method: 'get' });
      scriptContent = await resp.text();
    }
    const escapedModuleName = JSON.stringify(moduleName);

    script.innerHTML = `
      (function() {
        
        const container = document.createElement('div');
        const shadow = container.attachShadow({mode: 'open'});
        const fakeFrame = document.createElement('div');
        const head = document.createElement('div');
        fakeFrame.appendChild(head);
        shadow.appendChild(fakeFrame);

        const fakeDocument = __createFakeDocument(fakeFrame, head);
        const scopedConsole = __createScopeConsole(${escapedModuleName});
        const fakeWindow = __createFakeWindow();

        const __module = { exports: {} };
        
        (function (window, document, console, module, exports){
          
          ${scriptContent}
  
        })(fakeWindow, fakeDocument, scopedConsole, __module, __module.exports);
        
        console.log('install app: ${escapedModuleName}', __module);
        
        window._apps.register(${escapedModuleName}, {
          unmount: __module.exports.unmount,
          mount: __module.exports.mount,
          getAppInfo: __module.exports.getAppInfo,
          container,
        });

        // document.body.appendChild(container);

      })();
    `;
    script.addEventListener('load', () => {
      script.parentElement?.removeChild(script);
      resolve(appManager.get(moduleName));
    });
    script.addEventListener('error', (err) => {
      script.parentElement?.removeChild(script);
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
  const eventBus = new EventEmitter();
  const supportExts: string[] = [];
  const registerExt = (ext: string[]) => {
    supportExts.push(...ext);
  }
  const ctx: AppContext = {
    registerExt,
    appRoot: appWindow.body.id,
    appRootEl: appWindow.body,
    appWindow,
    theme,
    setWindowSize,
    channel: channel.port2,
    systemMenu: [],
    onOpenFile(cb) {
      eventBus.on('open_file', cb);
      return () => {
        eventBus.off('open_file', cb);
      }
    },
    async openFile(file: string): Promise<boolean> {
      return await windowManager.openFile(file);
    },
    async openFileBy(appName: string, file: string) {
      windowManager.openFileBy(appName, file);
    }
  };
  const _ctx = makeAutoObservable(ctx);
  return {
    ctx: _ctx,
    sender: channel.port1,
    eventBus,
  };
}

export interface AppDefinition {
  mount(ctx: AppContext): Promise<void>;
  unmount(ctx: AppContext): Promise<void>;
  getAppInfo(): AppInfo;
  container: HTMLElement;
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
  getSupportedAppsByExt(ext: string): string[] {
    function normalize(ext: string) {
      while (ext.startsWith('.')) {
        ext = ext.slice(1);
      }
      return ext;
    }
    return Object.keys(this.apps).filter(appName => {
      const app = this.apps[appName];
      const info = app.getAppInfo();
      for (let e of info.supportExts) {
        if (normalize(e) === normalize(ext)) {
          return true;
        }
      }
      return false;
    })
  }
  all() {
    return Object.keys(this.apps);
  }
}

export const appManager = new AppsRegister();
(window as any)._apps = appManager;
function stylus(s: string) {
  return s.split('\n').join('');
}

function createFakeDocument(scope: HTMLElement, scopeHead: HTMLElement) {
  const proxy = new Proxy(document, {
    get(target, key: keyof Document) {
      if (key === 'querySelector') {
        function q(selector: string) {
          const el = document.querySelector(selector);
          if (el?.tagName.toLowerCase() === 'head') {
            return scopeHead
          }
          return scope.querySelector(selector);
        }
        return q;
      } else {
        if (typeof target[key] === 'function') {
          const d: any = target[key];
          return d.bind(target);
        } else {
          return target[key];
        }
      }
    }
  });
  return proxy
}

function createFakeWindow() {
  const fakeWindow = Object.create(null);
  const proxy = new Proxy(window, {
    get(target, key: any) {
      if (fakeWindow[key] !== undefined) {
        return fakeWindow[key];
      } else {
        if (typeof target[key] === 'function') {
          let d: any = target[key];
          return d.bind(target);
        } else {
          return target[key];
        }
      }
    },
    set(target, key, value) {
      fakeWindow[key] = value;
      return true;
    }
  });
  return proxy
}

function createScopeConsole(scope: string) {
  const proxy = new Proxy(console, {
    get(target, key: keyof Console) {
      const c = console[key]
      if (typeof c === 'function') {
        return (c as any).bind(console, `[${scope}]: `);
      }
      return c;
    }
  });
  return proxy
}
(window as any).__createFakeWindow = createFakeWindow;
(window as any).__createFakeDocument = createFakeDocument;
(window as any).__createScopeConsole = createScopeConsole;

export const windowManager = new WindowManager();
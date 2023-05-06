import EventEmitter from "events";
import { AppContext, AppMenuManager, AppState, AppWindow } from ".";
import { commonCollection } from "../kv-storage";
import style from './index.module.less';
import { transformScale, transformTranslate } from "./animation";
import { debounce } from "../utils/common";
import path from "path-browserify";
import windowManager from "./window-manager";
import { getAppManager, setSystemTitleBarFlow, systemMessage, systemSelectFile } from "../system";
import { Theme } from "../types/theme";

interface DockApp {
  app: AppState,
  el: HTMLElement
}

const store = commonCollection.processManager

export class ProcessManager {
  public openedApps: AppState[] = [];
  public checkActiveTimer?: number;
  public onResize?: () => void;
  public eventBus = new EventEmitter();
  public activeApp: AppState | null = null;
  public cacheWindowState: { [appName: string]: { width: number, height: number, left: number, top: number, open: boolean, isMinimized: boolean } } = {};
  public container: HTMLElement = document.body;
  public isInited = false;
  public dockEl = document.createElement('div');
  public appsInDock: DockApp[] = [];
  async storeWindowStatus() {
    await store.set('cacheWindowState', this.cacheWindowState);
  }
  initDock() {
    this.dockEl.className = style['app_dock_container'];
    this.container.appendChild(this.dockEl);
  }
  appendToDock(app: AppState) {
    if (this.appsInDock.findIndex(dockApp => dockApp.app === app) !== -1) return;
    app.ctx.appWindow.isMinimized = true;
    this.cacheWindowState[app.name].isMinimized = true;
    const appEl = document.createElement('div');
    appEl.className = style['app_dock_app'].trim();
    appEl.innerHTML = `
    <img src="${app.app.getAppInfo().iconUrl}">
    <span>${app.name}</span>
    `;
    console.log(appEl);
    appEl.addEventListener('click', () => {
      this.removeFromDock(app);
    });
    this.appsInDock.push({ app, el: appEl });
    this.dockEl.appendChild(appEl);
    this.appendToDockAnimation(app);
    this.dockEl.classList.remove(style['hide'].trim());
  }
  appendToDockAnimation(app: AppState) {
    const w = app.ctx.appWindow.window;
    const dockRect = this.dockEl.getBoundingClientRect();
    const wRect = w.getBoundingClientRect();
    const wRatio = dockRect.width / wRect.width;
    const hRatio = dockRect.height / wRect.height;
    const wCenterX = wRect.left + (wRect.width / 2);
    const wCenterY = wRect.top + (wRect.height / 2);
    const dockCenterX = dockRect.left + (dockRect.width / 2);
    const dockCenterY = dockRect.top + (dockRect.height / 2);
    const xMove = dockCenterX - wCenterX;
    const yMove = dockCenterY - wCenterY;
    transformTranslate(w, xMove, yMove);
    transformScale(w, wRatio, hRatio);
    w.style.transform = `translate(${xMove}px, ${yMove}px) scale(${wRatio}, ${hRatio})`;
    w.style.opacity = '0';
    w.style.pointerEvents = 'none';
  }
  restoreFromDockAnimation(app: AppState) {
    console.log('restore');
    const w = app.ctx.appWindow.window;
    transformTranslate(w, 0, 0);
    transformScale(w, 1, 1);
    w.style.opacity = '1';
    setTimeout(() => {
      w.style.pointerEvents = 'all';
    }, 200);
  }
  removeFromDock(app: AppState) {
    const idx = this.appsInDock.findIndex(dockApp => dockApp.app === app);
    this.cacheWindowState[app.name].isMinimized = false;
    this.restoreFromDockAnimation(app);
    app.ctx.appWindow.isMinimized = false;
    if (idx !== -1) {
      const [dockApp] = this.appsInDock.splice(idx, 1);
      dockApp.el.remove();
    }
    if (this.appsInDock.length === 0) {
      this.dockEl.classList.add(style['hide'].trim());
    }
    app.ctx.appWindow.setActive(true);
  }
  async init(container: HTMLElement) {
    if (this.isInited) {
      throw new Error('window manager is already inited');
    }
    this.container = container;
    this.initDock();

    this.isInited = true;

    if (window.location.hash.includes('app=')) {
      const appNameMatch = window.location.hash.match(/app=(.+)($|,)/);
      if (appNameMatch && appNameMatch[1]) {
        const appName = appNameMatch[1];
        await getAppManager().init([appName]);
        if (getAppManager().get(appName)) {
          const app = await this.startApp(appName, { resume: true });
          app?.ctx.appWindow.showTitleBar(false);
          app?.ctx.appWindow.forceFullscreen();
          setSystemTitleBarFlow(true);
          return;
        }
      }
    }
    await getAppManager().init();

    this.checkActiveTimer = window.setInterval(() => {
      if (document.activeElement && this.container.contains(document.activeElement)) {
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
    store.get<typeof this['cacheWindowState']>('cacheWindowState').then(async (v) => {
      let toDockApp: AppState[] = [];
      if (v) {
        this.cacheWindowState = v;
        let tasks = Object.keys(this.cacheWindowState).map(async appName => {
          if (!getAppManager().get(appName)) {
            delete this.cacheWindowState[appName];
          } else if (this.cacheWindowState[appName].open) {
            console.log('cache', appName, this.cacheWindowState);
            const app = await this.startApp(appName, { resume: true });
            if (app && this.cacheWindowState[appName].isMinimized) {
              toDockApp.push(app);
            }
          }
        });
        await Promise.all(tasks);
        await this.storeWindowStatus();
      }
      setTimeout(() => {
        toDockApp.forEach(app => {
          this.appendToDock(app);
        })
      }, 200);
    });
  }
  async openFile(file: string) {
    const ext = path.parse(file).ext;
    const apps = getAppManager().getSupportedAppsByExt(ext);
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
    this.eventBus.emit("destroy");
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
  async startApp(appName: string, options: { isFullscreen?: boolean, params?: Record<string, string>, resume?: boolean } = { isFullscreen: false, params: {}, resume: false }) {
    let existApp = this.getAppByName(appName);
    if (existApp) {
      this.updateActiveApp(existApp);
      const dockApp = this.appsInDock.find(dockApp => dockApp.app === existApp);
      if (dockApp) {
        this.removeFromDock(dockApp.app);
      }
      return;
    }
    let app = await startApp(this.container, appName, !!options.resume, options.params || {});
    if (options.isFullscreen) {
      app?.ctx.appWindow.showTitleBar(false);
      app?.ctx.appWindow.forceFullscreen();
      setSystemTitleBarFlow(true);
    }
    if (!app) return;
    let isClose = false;
    const beforeClose = (force = false) => {
      if (isClose) return;
      isClose = true;

      // 从dock栏删除
      this.removeFromDock(app!);

      // 从将窗口缓存状态改为已关闭
      this.cacheWindowState[appName].open = false;
      store.set('cacheWindowState', this.cacheWindowState);

      app!.app.unmount(app!.ctx);
      let idx = this.openedApps.findIndex(app => app.name === appName);
      if (idx > -1) {
        this.openedApps.splice(idx, 1);
      }
      if (force) {
        const w = app!.ctx.appWindow.window;
        w.remove();
      }
      const oldApp = this.activeApp;
      this.activeApp = null;
      unbindMove();
      unbindResize();
      unbindMin();
      this.eventBus.emit('active_app_change', null, oldApp);
    };
    const onActive = () => {
      this.updateActiveApp(app!);
    }
    const onWindowMin = () => {
      this.appendToDock(app!);
      this.storeWindowStatus();
    }
    const unbindMin = app.ctx.appWindow.onWindowMinimize(onWindowMin);
    app.ctx.appWindow.onBeforeClose(beforeClose);
    app.ctx.appWindow.onActive(onActive);
    if (this.cacheWindowState[appName]) {
      const { width, height, left, top } = this.cacheWindowState[appName];
      app.ctx.appWindow.setPos(left, top);
      app.ctx.appWindow.setSize(width, height);
    } else {
      const s = app!.ctx.appWindow.getSize();
      const p = app!.ctx.appWindow.getPos();
      this.cacheWindowState[appName] = {
        width: s.width, height: s.height, left: p.left, top: p.top, open: true, isMinimized: false,
      }
    }
    this.cacheWindowState[appName].open = true;
    this.storeWindowStatus();

    let unbindMove = app.ctx.appWindow.onWindowMove(debounce((left: number, top: number) => {
      this.cacheWindowState[appName].left = left;
      this.cacheWindowState[appName].top = top;
      this.storeWindowStatus();
    }, 1000));
    let unbindResize = app.ctx.appWindow.onWindowResize(debounce((w: number, h: number) => {
      this.cacheWindowState[appName].width = w;
      this.cacheWindowState[appName].height = h;
      this.storeWindowStatus();
    }, 1000));
    app.ctx.appWindow.setActive(true);
    app.ctx.appWindow.focus();
    this.openedApps.push(app);
    this.updateActiveApp(app);
    return app;
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

export async function startApp(container: HTMLElement, appName: string, resume: boolean, params: Record<string, string>): Promise<AppState | undefined> {

  const app = getAppManager().get(appName);
  if (!app) {
    console.error(`app not installed: ${appName}`);
    return;
  }

  const appWindow = windowManager.createWindow(appName, app.container);

  appWindow.setVisible(false);
  container.appendChild(appWindow.window);
  setTimeout(() => {
    appWindow.setVisible(true);
  });

  const { ctx, sender, eventBus } = createContext(appWindow, 'light');
  ctx.isResume = resume;
  ctx.params = params;
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
    params: {},
    setWindowSize,
    isResume: false,
    channel: channel.port2,
    systemMenu: new AppMenuManager(),
    selectFile: systemSelectFile,
    systemMessage: systemMessage,
    onOpenFile(cb) {
      eventBus.on('open_file', cb);
      return () => {
        eventBus.off('open_file', cb);
      }
    },
    async openFile(file: string): Promise<boolean> {
      return await processManager.openFile(file);
    },
    async openFileBy(appName: string, file: string) {
      processManager.openFileBy(appName, file);
    }
  };
  return {
    ctx,
    sender: channel.port1,
    eventBus,
  };
}


const processManager = new ProcessManager();
export default processManager;
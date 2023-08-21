import EventEmitter from "events";
import { AppContext, AppMenuManager, ProcessState, ScopedWindow } from ".";
import { commonCollection } from "../kv-storage";
import path from "path-browserify";
import { setSystemTitleBarFlow } from "../system";
import { CreateAppWindowOptions, windowManager } from "./window-manager";
import { appManager } from "./app-manager";
import { removeFromArray } from "../utils/array";
import { JSONValue } from "../types";

interface DockApp {
  app: ProcessState,
  el: HTMLElement
}

export interface StartAppOptions { isFullscreen?: boolean, params?: Record<string, string>, resume?: boolean }

export interface CacheWindowInfo {
  size: { w: number, h: number },
  position: { x: number, y: number },
}

const store = commonCollection.processManager

export class ProcessManager {
  public openedApps: ProcessState[] = [];
  public checkActiveTimer?: number;
  public onResize?: () => void;
  public eventBus = new EventEmitter();
  public activeApp: ProcessState | null = null;
  public cacheProcessState: { [appName: string]: { isRunning: boolean, windowsInfo: { [windowId: string]: CacheWindowInfo } } } = {};
  public isInited = false;
  public dockEl = document.createElement('div');
  public appsInDock: DockApp[] = [];
  async storeProcessStatus() {
    const _a: JSONValue = this.cacheProcessState
    await store.set('cacheProcessState', this.cacheProcessState);
  }
  async init() {
    if (this.isInited) {
      throw new Error('window manager is already inited');
    }

    this.isInited = true;

    if (window.location.hash.includes('app=')) {
      const appNameMatch = window.location.hash.match(/app=(.+)($|,)/);
      if (appNameMatch && appNameMatch[1]) {
        const appName = appNameMatch[1];
        appManager.init([appName]);
        if (appManager.get(appName)) {
          const _app = await this.startApp(appName, { resume: true });
          setSystemTitleBarFlow(true);
          return;
        }
      }
    }
    await appManager.init();


    store.get<typeof this['cacheProcessState']>('cacheProcessState').then(async (v) => {
      const _toDockApp: ProcessState[] = [];
      if (v) {
        this.cacheProcessState = v;
        const tasks = Object.keys(this.cacheProcessState).map(async appName => {
          if (!appManager.get(appName)) {
            delete this.cacheProcessState[appName];
          } else if (this.cacheProcessState[appName].isRunning) {
            console.log('cache', appName, this.cacheProcessState);
            const _app = await this.startApp(appName, { resume: true });
          }
        });
        await Promise.all(tasks);
        await this.storeProcessStatus();
      }
    });
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
    await this.startApp(appName, { params: { file } });
    const existApp = this.getAppByName(appName);
    if (existApp) {
      existApp.eventBus.emit('open_file', file);
      return;
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
  async postMessage(appName: string, message: unknown) {
    const app = this.openedApps.find(app => appName === app.name);
    if (app) {
      app.channel.postMessage(message);
    } else {
      console.error('app not opened');
    }
  }
  async startApp(appName: string, options: StartAppOptions = { isFullscreen: false, params: {}, resume: false }) {
    const existApp = this.openedApps.find(app => app.app.name === appName);
    if (existApp) {
      // if app is running, not to create process again
      existApp.ctx.params = options.params || {};
      await existApp.app.start(existApp.ctx);
      return;
    }

    const app = appManager.get(appName);
    if (!app) {
      console.error(`app not installed: ${appName}`);
      return;
    }

    const { ctx, sender, eventBus } = createContext({
      getProcess: () => processState
    });
    ctx.isResume = !!options.resume;
    ctx.params = options.params || {};
    if (options.isFullscreen) {
      setSystemTitleBarFlow(true);
    }
    let windowIdx = 0
    app.scoped.injectGlobalFunction('__createAppWindow', (id?: string, opts: CreateAppWindowOptions = {}) => {
      if (!id) {
        id = `${appName}_${windowIdx}`;
      } else {
        id = `${appName}_${id}`;
      }
      windowIdx++;
      const win = windowManager.createWindow(app, id, processState);
      if (options.isFullscreen) {
        win.forceFullscreen();
        win.showTitleBar(false);
      }
      if (opts.actived) {
        win.setActive(true);
      }
      return win;
    });
    const processState = {
      name: appName,
      app: app,
      ctx: ctx,
      isActive: false,
      channel: sender,
      eventBus,
      windows: [],
    } as ProcessState;
    await app.start(ctx);
    let isClose = false;
    const beforeClose = () => {
      if (isClose) return;
      isClose = true;

      this.cacheProcessState[appName].isRunning = false;
      processState!.app.exit(processState!.ctx);
      removeFromArray(this.appsInDock, app => app.app.name === appName);
      const oldApp = this.activeApp;
      this.activeApp = null;
      this.eventBus.emit('active_app_change', null, oldApp);
    };

    this.cacheProcessState[appName].isRunning = true;
    this.storeProcessStatus();
    this.openedApps.push(processState);
    processState.app.scoped.injectGlobalFunction('__exitApp', () => {
      beforeClose();
    });
    return processState;
  }
  async close(appName: string) {
    const app = this.openedApps.find(app => app.name === appName);
    if (app) {
      await app.app.exit(app.ctx);
    }
  }
}

export function createContext({ getProcess }: { getProcess(): ProcessState }) {
  const channel = new MessageChannel();
  const eventBus = new EventEmitter();
  const supportExts: string[] = [];
  const registerExt = (ext: string[]) => {
    supportExts.push(...ext);
  }

  const ctx: AppContext = {
    get windows() {
      return getProcess().windows;
    },
    registerExt,
    params: {},
    isResume: false,
    channel: channel.port2,
    systemMenu: new AppMenuManager(),
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
    },
    getProcess,
  };
  return {
    ctx,
    sender: channel.port1,
    eventBus,
  };
}

export const exitApp = () => {
  (window as unknown as ScopedWindow).__exitApp();
}

export const processManager = new ProcessManager();

import EventEmitter from "events";
import { AppContext, AppMenuManager, ProcessState, AppWindow } from ".";
import { commonCollection } from "../kv-storage";
import path from "path-browserify";
import { getAppManager, getWindowManager, setSystemTitleBarFlow, systemMessage, systemSelectFile } from "../system";

interface DockApp {
  app: ProcessState,
  el: HTMLElement
}

const store = commonCollection.processManager

export class ProcessManager {
  public openedApps: ProcessState[] = [];
  public checkActiveTimer?: number;
  public onResize?: () => void;
  public eventBus = new EventEmitter();
  public activeApp: ProcessState | null = null;
  public cacheProcessState: { [appName: string]: { isRunning: boolean } } = {};
  public isInited = false;
  public dockEl = document.createElement('div');
  public appsInDock: DockApp[] = [];
  async storeProcessStatus() {
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
        await getAppManager().init([appName]);
        if (getAppManager().get(appName)) {
          const app = await this.startApp(appName, { resume: true });
          setSystemTitleBarFlow(true);
          return;
        }
      }
    }
    await getAppManager().init();


    store.get<typeof this['cacheProcessState']>('cacheProcessState').then(async (v) => {
      let toDockApp: ProcessState[] = [];
      if (v) {
        this.cacheProcessState = v;
        let tasks = Object.keys(this.cacheProcessState).map(async appName => {
          if (!getAppManager().get(appName)) {
            delete this.cacheProcessState[appName];
          } else if (this.cacheProcessState[appName].isRunning) {
            console.log('cache', appName, this.cacheProcessState);
            const app = await this.startApp(appName, { resume: true });
          }
        });
        await Promise.all(tasks);
        await this.storeProcessStatus();
      }
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
    let app = await startApp(appName, !!options.resume, options.params || {});
    if (!app) return;
    let isClose = false;
    const beforeClose = (force = false) => {
      if (isClose) return;
      isClose = true;

      this.cacheProcessState[appName].isRunning = false;
      store.set('cacheProcessState', this.cacheProcessState);

      app!.app.unmount(app!.ctx);
      let idx = this.openedApps.findIndex(app => app.name === appName);
      if (idx > -1) {
        this.openedApps.splice(idx, 1);
      }
      const oldApp = this.activeApp;
      this.activeApp = null;
      this.eventBus.emit('active_app_change', null, oldApp);
    };
    if (!this.cacheProcessState[appName]) {
      this.cacheProcessState[appName] = { isRunning: true };
    }
    this.cacheProcessState[appName].isRunning = true;
    this.storeProcessStatus();
    this.openedApps.push(app);
    app.app.scoped.injectGlobalFunction('__exitApp', (id: string) => {
      beforeClose();
    });
    return app;
  }
  async close(appName: string) {
    const app = this.openedApps.find(app => app.name === appName);
    if (app) {
      await app.app.unmount(app.ctx);
    }
  }
}

export async function startApp(appName: string, resume: boolean, params: Record<string, string>): Promise<ProcessState | undefined> {

  const app = getAppManager().get(appName);
  if (!app) {
    console.error(`app not installed: ${appName}`);
    return;
  }

  const { ctx, sender, eventBus } = createContext({
    getProcess: () => processState
  });
  ctx.isResume = resume;
  ctx.params = params;
  app.scoped.injectGlobalFunction('__createAppWindow', (id: string) => {
    return getWindowManager().createWindow(app, id);
  });
  let processState = {
    name: appName,
    app: app,
    ctx: ctx,
    isActive: false,
    channel: sender,
    eventBus,
  };
  await app.mount(ctx);
  return processState;
}


export function createContext({ getProcess }: { getProcess(): ProcessState }) {
  const channel = new MessageChannel();
  const eventBus = new EventEmitter();
  const supportExts: string[] = [];
  const registerExt = (ext: string[]) => {
    supportExts.push(...ext);
  }

  const ctx: AppContext = {
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
  (window as any).__exitApp();
}

const processManager = new ProcessManager();
export default processManager;
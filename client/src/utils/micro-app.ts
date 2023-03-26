import { makeAutoObservable } from "mobx";
import { Theme } from "src/hooks/common";

export interface MicroAppContext {
  window: MicroAppWindowInfo;
  theme: Theme;
  appRoot: string;
  appRootEl: HTMLElement;
  channel: MessagePort,
  setWindowSize: (w: number, h: number) => void;
}

export interface MicroAppWindowInfo {
  width: number;
  height: number;
}

export interface MicroApp {
  mount(ctx: MicroAppContext): Promise<void>;
  unmount(ctx: MicroAppContext): Promise<void>;
  getAppInfo(): Promise<void>;
}
interface AppContextInfo {
  el: HTMLDivElement,
  name: string,
  isActive: boolean,
  app: AppDefinition,
  mountPoint: HTMLElement,
  ctx: MicroAppContext,
  channel: MessagePort,
}

const activeZIndex = '9999';
const nonactiveZIndex = '999';

const builtinApps = [
  'file-browser',
];

builtinApps.forEach(appName => {
  installBuiltinApp(appName);
});

export class WindowManager {
  public openedApps: AppContextInfo[] = [];
  constructor(public container: HTMLElement) { }
  async postMessage(appName: string, message: any) {
    const app = this.openedApps.find(app => appName === app.name);
    if (app) {
      app.channel.postMessage(message);
    } else {
      console.error('app not opened');
    }
  }
  async startApp(appName: string) {
    let isExist = false;
    this.openedApps.forEach(app => {
      if (app.name === appName) {
        isExist = true;
        app.isActive = true;
      } else {
        app.isActive = false;
      }
    });
    if (isExist) {
      return;
    }
    this.blur();
    const beforeClose = () => {
      app?.app.unmount(app.ctx);
      let idx = this.openedApps.findIndex(app => app.name === appName);
      if (idx > -1) {
        this.openedApps.splice(idx, 1);
      }
    };
    let app = await startApp(this.container, appName, beforeClose);
    if (!app) return;
    this.openedApps.push({
      ...app,
      isActive: true,
    });
  }
  async close(appName: string) {
    const app = this.openedApps.find(app => app.name === appName);
    if (app) {
      await app.app.mount(app.ctx);
    }
  }
  async focus(appName: string) {
    this.openedApps.forEach(app => {
      app.el.style.zIndex = nonactiveZIndex;
      app.isActive = false;
    });
    let app = this.openedApps.find(app => appName === app.name);
    if (!app) return;
    app.isActive = true;
    app.el.style.zIndex = activeZIndex;
  }
  async blur() {
    this.openedApps.forEach(app => {
      app.el.style.zIndex = nonactiveZIndex;
      app.isActive = false;
    });
  }
}

export async function installBuiltinApp(appName: string) {
  const appScript = process.env.PUBLIC_URL + '/static/js/apps/' + appName + '.js';
  installApp(appScript, appName);
}

export async function installApp(src: string, appName: string) {
  await loadModule(src, appName);
}

export async function startApp(container: HTMLElement, appName: string, beforeClose: () => void): Promise<AppContextInfo | undefined> {

  const app = window.apps.get(appName);
  if (!app) {
    console.error('app not installed');
    return;
  }

  const appEl = createAppWindow(appName);

  appEl.style.opacity = '0';
  appEl.style.backgroundColor = 'white';
  appEl.style.overflow = 'hidden';
  appEl.style.zIndex = activeZIndex;

  container.appendChild(appEl);
  appEl.style.opacity = '1';
  const titleBar = document.createElement('div');
  titleBar.innerHTML = `<span style="${stylus(`display: flex;
    padding: 0 10px;
    height: 22px;
    font-size: 14px;
    background-color: #eee;
    line-height: 22px;
    user-select: none;
  `)}"><span class="app_window_close_btn">X</span><span style="flex-grow: 1;">${appName}</span></span>`
  const closeBtn = titleBar.querySelector('.app_window_close_btn') as HTMLSpanElement;
  closeBtn?.addEventListener('click', () => {
    beforeClose();
    appEl.parentElement?.removeChild(appEl);
  });

  let isMouseDown = false;
  let startCursorPos = [0, 0];
  let startElPos = [0, 0];
  titleBar.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    startCursorPos = [e.clientX, e.clientY];
    startElPos = [parseFloat(appEl.style.left), parseFloat(appEl.style.top)];
  });
  window.addEventListener('mouseup', () => {
    const rect = appEl.getBoundingClientRect();
    isMouseDown = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
      let delta = [e.clientX - startCursorPos[0], e.clientY - startCursorPos[1]];
      appEl.style.left = startElPos[0] + delta[0] + 'px';
      appEl.style.top = startElPos[1] + delta[1] + 'px';
    }
  });

  const mountPoint = document.createElement('div');
  appEl.appendChild(titleBar);
  appEl.appendChild(mountPoint);
  const { ctx, sender } = createContext(500, 500, appEl.id, mountPoint, 'light');
  await app.mount(ctx);
  return {
    el: appEl,
    mountPoint,
    name: appName,
    app: app,
    ctx: ctx,
    isActive: false,
    channel: sender,
  };
}

export function createAppWindow(appName: string, width: number = 700, height: number = 600) {
  const appEl = document.createElement('div');
  appEl.id = 'app-' + appName;
  appEl.style.width = '500px';
  appEl.style.height = '500px';
  appEl.style.position = 'fixed';
  appEl.style.left = '100px';
  appEl.style.top = '20px';
  appEl.style.boxShadow = '#7367674d 2px 2px 5px 2px';
  appEl.style.borderRadius = '10px';
  return appEl;
}

export function loadModule(src: string, moduleName: string): Promise<MicroApp> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import { unmount, mount, getAppInfo } from "${src}";
      window.apps.register('${moduleName}', {
        unmount,
        mount,
        getAppInfo,
      });
    `;
    script.addEventListener('load', () => {
      script.parentElement?.removeChild(script);
    });
    script.addEventListener('error', (err) => {
      reject(err);
    })
    document.body.appendChild(script);
  })
}

export function createContext(width: number, height: number, appRoot: string, appRootEl: HTMLElement, theme: Theme) {
  const setWindowSize = (w: number, h: number) => {
    appRootEl.style.width = w + 'px';
    appRootEl.style.height = h + 'px';
  };
  const channel = new MessageChannel();
  const ctx: MicroAppContext = {
    window: {
      width,
      height,
    },
    appRoot,
    appRootEl,
    theme,
    setWindowSize,
    channel: channel.port2,
  };
  return {
    ctx,
    sender: channel.port1,
  };
}

export interface AppDefinition {
  mount(ctx: MicroAppContext): Promise<void>;
  unmount(ctx: MicroAppContext): Promise<void>;
  getAppInfo(): any;
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

window.apps = new AppsRegister();

function stylus(s: string) {
  return s.split('\n').join('');
}
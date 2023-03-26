import { makeAutoObservable } from "mobx";
import { Theme } from "src/hooks/common";
import { AppContext, AppInfo, AppState } from 'core/dist/web-app';

const activeZIndex = '9999';
const nonactiveZIndex = '999';

const builtinApps = [
  ['file-browser', 'Files'],
];

builtinApps.forEach(([appScriptName, appName]) => {
  installBuiltinApp(appScriptName, appName);
});

export class WindowManager {
  public openedApps: AppState[] = [];
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

export async function installBuiltinApp(appScriptName: string, appName: string) {
  const appScript = '/apps/' + appScriptName + '.js';
  installApp(appScript, appName);
}

export async function installApp(src: string, appName: string) {
  await loadModule(src, appName);
}

export async function startApp(container: HTMLElement, appName: string, beforeClose: () => void): Promise<AppState | undefined> {

  const app = appManager.get(appName);
  if (!app) {
    console.error('app not installed');
    return;
  }

  const appWindow = createAppWindow(appName, beforeClose);

  appWindow.setVisible(false);
  container.appendChild(appWindow.window);
  setTimeout(() => {
    appWindow.setVisible(true);
  });

  const { ctx, sender } = createContext(appWindow.window.id, appWindow.body, 'light');
  await app.mount(ctx);
  return {
    el: appWindow.window,
    name: appName,
    app: app,
    ctx: ctx,
    isActive: false,
    channel: sender,
  };
}

export function createAppWindow(appName: string, beforeClose?: () => void) {
  const appEl = document.createElement('div');
  appEl.id = 'app-' + appName;
  appEl.style.width = '500px';
  appEl.style.height = '500px';
  appEl.style.position = 'fixed';
  appEl.style.left = '100px';
  appEl.style.top = '100px';
  appEl.style.boxShadow = 'var(--box-shadow)';
  appEl.style.borderRadius = '10px';
  appEl.style.backgroundColor = 'white';
  appEl.style.overflow = 'hidden';
  appEl.style.zIndex = activeZIndex;
  appEl.style.color = 'var(--font-color)';
  appEl.style.transition = 'transform 0.2s, opacity 0.2s';

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

  appEl.style.opacity = '0';

  appEl.style.opacity = '1';
  const titleBar = document.createElement('div');
  titleBar.innerHTML = `<span style="${stylus(`display: flex;
    padding: 0 10px;
    height: 22px;
    font-size: 14px;
    background-color: var(--bg-medium);
    line-height: 22px;
    user-select: none;
  `)}"><span class="app_window_close_btn" style="cursor: pointer;">X</span><span class="title_text" style="flex-grow: 1;">${appName}</span></span>`
  const closeBtn = titleBar.querySelector('.app_window_close_btn') as HTMLSpanElement;
  closeBtn?.addEventListener('click', () => {
    beforeClose?.();
    setVisible(false);
    setTimeout(() => {
      appEl.parentElement?.removeChild(appEl);
    }, 400);
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
  return {
    window: appEl,
    body: mountPoint,
    titleBar,
    setTitle,
    setVisible
  };
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

export function createContext(appRoot: string, appRootEl: HTMLElement, theme: Theme) {
  const setWindowSize = (w: number, h: number) => {
    appRootEl.style.width = w + 'px';
    appRootEl.style.height = h + 'px';
  };
  const channel = new MessageChannel();
  const ctx: AppContext = {
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
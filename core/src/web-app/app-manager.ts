import { commonCollection } from "../kv-storage";
import { AppDefinition, AppInstallContext, GlobalSearchOptions, GlobalSearchResult, SystemHooks } from ".";
import EventEmitter from "events";
import { SystemHook } from "./system-hook";
import { systemMessage } from "../system";
import processManager from "./process-manager";
import { http } from "../tunnel";

export type AppDefinitionWithContainer = AppDefinition & {
  name: string,
  scoped: {
    window: Window,
    document: Document,
    console: Console,
    head: HTMLElement,
    injectGlobalFunction: (fnName: string, fn: (...args: any[]) => any) => void;
  },
  hooks: SystemHooks
};

const builtinApps = [
  ['book-reader', 'BookReader'],
  ['app-center', 'App Center'],
  ['vnc-viewer', 'VNCViewer'],
  ['chat-gpt', 'ChatGPT'],
  ['paint', 'Paint'],
  ['file-browser', 'Cloud'],
  ['test', 'Test'],
  ['files', 'Files'],
  ['image', 'Image'],
  ['text-editor', 'TextEditor'],
  ['setting', 'Setting'],
  ['video-player', 'VideoPlayer'],
  ['shell', 'Shell'],
  ['pdf-viewer', 'PdfViewer'],
  ['3d-editor', '3DEditor'],
];

export class AppManager {
  apps: AppDefinitionWithContainer[];
  thirdPartyApps: { name: string, src: string }[] = []
  downloadedApps: { [appName: string]: { scriptContent: string, scriptSrc: string } } = {};
  remote = commonCollection.appManager;
  eventBus = new EventEmitter();
  private readyPromise?: Promise<void>;
  constructor() {
    this.apps = [];
  }
  init(selectedApps?: string[]) {
    if(this.readyPromise) {
      return this.readyPromise;
    }
    this.readyPromise = (async () => {
      await this.installBuiltinApps(selectedApps);
      this.eventBus.emit('app_installed');
    })();
    return this.readyPromise;
  }
  ready() {
    if (!this.readyPromise) {
      throw new Error('AppsManager must be inited before using');
    }
    return this.readyPromise;
  }
  onAppInstalled(cb: (appName?: string) => void): () => void {
    this.eventBus.on('app_installed', cb);
    return () => {
      this.eventBus.off('app_installed', cb);
    }
  }
  async uninstallApp(appName: string) {
    const idx = this.thirdPartyApps.findIndex(app => app.name === appName);
    if (idx > -1) {
      this.thirdPartyApps.splice(idx, 1);
      const appIdx = this.apps.findIndex(app => app.name === appName);
      if (appIdx > -1) {
        const [app] = this.apps.splice(appIdx, 1);
        if (app) {
          this.remote.set('thridparty_apps', this.thirdPartyApps);
          await app.beforeUninstall?.();
        }
        this.eventBus.emit('app_installed');
      }
    }
  }
  async installApp(appSrc: string, appName: string) {
    if (this.apps.find(app => app.name === appName)) {
      return false;
    }
    const install = async (appScriptSrc: string, appName: string) => {
      await this.download(appName, appScriptSrc);
      await this.install(appName);
    }
    await install(appSrc, appName);
    this.thirdPartyApps.push({ name: appName, src: appSrc });
    this.remote.set('thridparty_apps', this.thirdPartyApps);
    this.eventBus.emit('app_installed', appName);
    return true;
  }
  async installBuiltinApps(selectedApps?: string[]) {
    const install = async (appScriptName: string, appName: string) => {
      try {
        const appScriptSrc = '/apps/' + appScriptName + '.js';
        await this.download(appName, appScriptSrc);
        await this.install(appName);
      } catch (err) {
        systemMessage({ title: `App ${appName}安装出现错误`, content: String(err), type: 'error', timeout: 5000 });
      }
    }

    const installPromises = [];
    for (let [appScriptName, appName] of builtinApps) {
      if (selectedApps) {
        if (selectedApps.includes(appName)) {
          const p = install(appScriptName, appName);
          installPromises.push(p);
        }
      } else {
        const p = install(appScriptName, appName);
        installPromises.push(p);
      }
    }
    await Promise.all(installPromises);

    const thirdPartyApps = await this.remote.get('thridparty_apps') as typeof this['thirdPartyApps'];
    if (thirdPartyApps) {
      const install = async (appScriptSrc: string, appName: string) => {
        await this.download(appName, appScriptSrc);
        await this.install(appName);
      }
      this.thirdPartyApps = thirdPartyApps;
      for (let app of thirdPartyApps) {
        await install(app.src, app.name);
      }
    }
  }
  async download(name: string, src: string) {
    if (this.downloadedApps[name]) {
      console.log(`${name} exists, skip download`);
      return;
    }
    async function downloadApp(src: string) {
      let scriptContent;
      if (src.startsWith('http://') || src.startsWith('https://')) {
        const resp = await http.fetch(src, { method: 'get' });
        scriptContent = await resp.text();
      } else {
        const resp = await fetch(src, { method: 'get' });
        scriptContent = await resp.text();
      }
      return scriptContent;
    }
    const appScript = await downloadApp(src);
    this.downloadedApps[name] = { scriptContent: appScript, scriptSrc: src };
  }
  async install(name: string) {
    if (this.apps.findIndex(app => app.name === name) !== -1) {
      console.log(`${name} exists, skip install`);
      return;
    };
    const appScript = this.downloadedApps[name];
    if (!appScript) {
      throw new Error(`app ${name} is not downloaded`);
    }
    try {
      const app = await loadModule(appScript, name);
      const installCtx = createAppInstallContext();
      app.hooks = installCtx.hooks;
      if (app.installed) {
        app.installed(installCtx);
      }
      this.apps.push(app);
    } catch (err) {
      throw err;
    }
  }
  get(appName: string): undefined | AppDefinitionWithContainer {
    return this.apps.find(app => app.name === appName);
  };
  getSupportedAppsByExt(ext: string): string[] {
    function normalize(ext: string) {
      while (ext.startsWith('.')) {
        ext = ext.slice(1);
      }
      return ext;
    }
    return this.apps.filter(app => {
      const info = app.getAppInfo();
      for (let e of info.supportExts) {
        if (normalize(e) === normalize(ext)) {
          return true;
        }
      }
      return false;
    }).map(app => app.name);
  }
  all() {
    return Object.keys(this.apps);
  }
}


export async function loadModule(appScript: { scriptContent: string, scriptSrc: string }, moduleName: string): Promise<AppDefinitionWithContainer> {
  const script = document.createElement('script');
  const escapedModuleName = JSON.stringify(moduleName);
  const escapedScriptSrc = JSON.stringify(appScript.scriptSrc);

  const sandbox = `
      (function() {
        
        const container = document.createElement('div');
        const shadow = container.attachShadow({mode: 'open'});
        const fakeFrame = document.createElement('div');
        const head = document.createElement('div');
        fakeFrame.appendChild(head);
        shadow.appendChild(fakeFrame);

        const fakeDocument = __createFakeDocument(fakeFrame, head, fakeFrame, ${escapedScriptSrc});
        const scopedConsole = __createScopeConsole(${escapedModuleName});
        const fakeWindow = __createFakeWindow(fakeDocument);

        const __module = { exports: {} };
        const __import = { meta: { url: ${JSON.stringify(appScript.scriptSrc)} }};
        
        (function (window, globalThis, document, console, module, exports, __import){
          try {
            
            ${appScript.scriptContent}
          
          } catch (e) {

            console.error('Error occurs in', ${escapedModuleName}, e);

          }
  
        })(fakeWindow, fakeWindow, fakeDocument, scopedConsole, __module, __module.exports, __import);
        
        const app = fakeWindow.__app || __module.exports;
        app.name = ${escapedModuleName};
        app.scoped = {
          window: fakeWindow,
          document: fakeDocument,
          console: scopedConsole,
          head,
        };
        console.log('install app: ${escapedModuleName}', app);
        
        app.container = container;
        const apps = window.__apps || {};
        apps[${escapedModuleName}] = app;
        window.__apps = apps;

        // document.body.appendChild(container);

      })();
    `;

  function loadScript(s: string): Promise<AppDefinitionWithContainer> {
    return new Promise(async (resolve, reject) => {
      const blobSrc = URL.createObjectURL(new Blob([s], { type: 'application/javascript' }));
      script.src = blobSrc;
      document.body.appendChild(script);
      script.addEventListener('load', () => {
        document.body.removeChild(script);
        URL.revokeObjectURL(blobSrc);
        const appDef = (window as any).__apps[moduleName] as AppDefinitionWithContainer;
        if (typeof appDef.mount !== 'function' || typeof appDef.getAppInfo !== 'function') {
          reject(`install app [${moduleName}] error`);
        }
        resolve(appDef);
      });
    })
  }
  let app = await loadScript(sandbox);
  app.scoped.injectGlobalFunction = (fnName: string, fn) => {
    (app.scoped.window as any)[fnName] = fn;
  }
  return app;
}

const appManager = new AppManager();
export default appManager;

function createAppInstallContext(): AppInstallContext {
  const ctx = {
    hooks: {
      globalSearch: new SystemHook<{ keyword: string; cb: (results: GlobalSearchResult[]) => void; }>('globalSearch'),
    },
    systemMessage: systemMessage,
    async openFile(file: string): Promise<boolean> {
      return await processManager.openFile(file);
    },
    async openFileBy(appName: string, file: string) {
      processManager.openFileBy(appName, file);
    }
  }
  return ctx;
}

function createFakeDocument(scope: HTMLElement, scopeHead: HTMLElement, mountPoint: HTMLElement, scriptSrc: string) {
  const proxy = new Proxy(document, {
    get(target, key: keyof Document) {
      if (key === 'querySelector') {
        function q(selector: string) {
          const el = document.querySelector(selector);
          if (el?.tagName.toLowerCase() === 'head') {
            return scopeHead
          }
          if (el?.tagName.toLowerCase() === 'body') {
            return mountPoint
          }
          return scope.querySelector(selector);
        }
        return q;
      } else if (key === 'head') {
        return scopeHead;
      } else if (key === 'documentElement') {
        return scope;
      } else if (key === 'body') {
        return mountPoint;
      } else if (key === 'currentScript') {
        return {
          src: scriptSrc,
          type: 'application/javascript',
          charset: 'utf-8',
          async: false,
          defer: false,
        };
      } else {
        let v;
        if (typeof target[key] === 'function') {
          const d: any = target[key];
          v = d.bind(target);
        } else {
          v = target[key];
        }
        return v;
      }
    }
  });
  return proxy
}

function createFakeWindow(fakeDocument: Document) {
  const fakeWindow = Object.create(null);
  const cacheFn = Object.create(null);
  const proxy = new Proxy(window, {
    get(target, key: any) {
      if (key === 'sharedScope') {
        return window.sharedScope;
      }
      if (cacheFn[key]) return cacheFn[key];
      if (key === 'document') {
        return fakeDocument;
      }
      let d: any = target[key];
      if (typeof d === 'function') {
        const pd = new Proxy(d, {
          set(target, p, newValue, receiver) {
            return Reflect.set(target, p, newValue, receiver);
          },
          get(target, key, receiver) {
            return Reflect.get(target, key, receiver);
          },
          apply(target, _thisArg, argArray) {
            return Reflect.apply(target, window, argArray);
          },
        });
        cacheFn[key] = pd;
        return pd;
      }
      if (fakeWindow[key]) {
        return fakeWindow[key];
      }
      return d;
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

import { commonCollection } from "../kv-storage";
import { AppDefinition, AppInstallContext, GlobalSearchResult, SystemHooks } from ".";
import EventEmitter from "events";
import { SystemHook } from "./system-hook";
import { systemMessage } from "../system";
import processManager from "./process-manager";
import { http } from "../tunnel";

export type AppDefinitionWithContainer = AppDefinition & {
  container: HTMLElement;
};

const builtinApps = [
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
  apps: { [appName: string]: AppDefinitionWithContainer };
  downloadedApps: { [appName: string]: { scriptContent: string, scriptSrc: string } } = {};
  remote = commonCollection.appManager;
  eventBus = new EventEmitter();
  hooks = {
    globalSearch: new SystemHook<Parameters<SystemHooks['onGlobalSearch']>[0]>('globalSearch'),
  }
  private readyPromise?: Promise<void>;
  constructor() {
    this.apps = {};
  }
  init(selectedApps?: string[]) {
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
  onAppInstalled(cb: (appName: string) => void): () => void {
    this.eventBus.on('app_installed', cb);
    return () => {
      this.eventBus.off('app_installed', cb);
    }
  }
  async installBuiltinApps(selectedApps?: string[]) {
    const install = async (appScriptName: string, appName: string) => {
      const appScriptSrc = '/apps/' + appScriptName + '.js';
      await this.download(appName, appScriptSrc);
      await this.install(appName);
    }

    for (let [appScriptName, appName] of builtinApps) {
      if (selectedApps) {
        if (selectedApps.includes(appName)) {
          await install(appScriptName, appName);
        }
      } else {
        await install(appScriptName, appName);
      }
    }
  }
  async download(name: string, src: string) {
    if (this.downloadedApps[name]) {
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
    const appScript = this.downloadedApps[name];
    if (!appScript) {
      throw new Error(`app ${name} is not downloaded`);
    }
    const app = await loadModule(appScript, name);
    if (app.installed) {
      const installCtx = createAppInstallContext(name);
      app.installed(installCtx);
    }
    this.apps[name] = app;
  }
  get(appName: string): undefined | AppDefinitionWithContainer {
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


export async function loadModule(appScript: { scriptContent: string, scriptSrc: string }, moduleName: string): Promise<AppDefinitionWithContainer> {
  const script = document.createElement('script');
  const escapedModuleName = JSON.stringify(moduleName);
  const escapedScriptSrc = JSON.stringify(appScript.scriptSrc);

  const m = (window as any).__modules;
  (window as any).__modules = m || {};
  (window as any).__modules[moduleName] = { exports: {} };

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

        const __module = window.__modules[${escapedModuleName}];
        const __import = { meta: { url: ${JSON.stringify(appScript.scriptSrc)} }};
        
        (function (window, globalThis, document, console, module, exports, __import){
          try {
            
            ${appScript.scriptContent}
          
          } catch (e) {

            console.error('Error occurs in', ${escapedModuleName}, e);

          }
  
        })(fakeWindow, fakeWindow, fakeDocument, scopedConsole, __module, __module.exports, __import);
        
        console.log('install app: ${escapedModuleName}', __module);
        
        __module.exports.container = container;

        // document.body.appendChild(container);

      })();
    `;

  const noSandbox = `
      (function() {
        
        const container = document.createElement('div');
        const shadow = container.attachShadow({mode: 'open'});
        const fakeFrame = document.createElement('div');
        const head = document.createElement('div');
        fakeFrame.appendChild(head);
        shadow.appendChild(fakeFrame);

        const scopedConsole = __createScopeConsole(${escapedModuleName});

        const __module = window.__modules[${escapedModuleName}];
        const __import = { meta: { url: ${JSON.stringify(appScript.scriptSrc)} }};
        
        (function (console, module, exports, __import){
          try {
            
            ${appScript.scriptContent}
          
          } catch (e) {

            console.error('Error occurs in', ${escapedModuleName}, e);

          }
  
        })(scopedConsole, __module, __module.exports, __import);
        
        console.log('install app: ${escapedModuleName}', __module);
        
        __module.exports.container = container;

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
        const __module = (window as any).__modules[moduleName];
        const appDef = __module.exports as AppDefinitionWithContainer;
        if (typeof appDef.mount !== 'function' || typeof appDef.getAppInfo !== 'function') {
          reject(`install app [${moduleName}] error`);
        }
        resolve(appDef);
      });
    })
  }
  let app = await loadScript(sandbox);
  if (app.getAppInfo().noSandbox) {
    app = await loadScript(noSandbox);
  }
  return app;
}

const appManager = new AppManager();
export default appManager;

function createAppInstallContext(appName: string): AppInstallContext {
  const ctx = {
    hooks: {
      onGlobalSearch(cb: (keyword: string) => Promise<GlobalSearchResult[]>) {
        appManager.hooks.globalSearch.register(appName, cb);
      }
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
        let k = d.bind(target);
        cacheFn[key] = k;
        return k;
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

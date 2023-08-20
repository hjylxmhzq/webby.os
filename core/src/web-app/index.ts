import EventEmitter from 'events';
import { ProcessManager, processManager } from "./process-manager";
import { WindowManager, windowManager } from "./window-manager";
import { AppDefinitionWithContainer, AppManager, appManager } from "./app-manager";
import { SystemHook } from "./system-hook";

export { ProcessManager } from './process-manager';
export { AppManager, AppDefinitionWithContainer } from './app-manager';
export { WindowManager, createAppWindow } from './window-manager';

export interface SelectFileOptions {
  allowFile?: boolean;
  allowDirectory?: boolean;
  allowedExts?: string[];
  multiple?: boolean;
}

export interface AppContext {
  channel: MessagePort,
  systemMenu: AppMenuManager,
  isResume: boolean, // 是否从未unmount的状态恢复
  params: Record<string, string>,
  windows: AppWindow[];
  onOpenFile(cb: (file: string) => void): () => void;
  openFile(file: string): Promise<boolean>;
  openFileBy(appName: string, file: string): Promise<void>;
  registerExt(ext: string[]): void;
  getProcess(): ProcessState;
}

export class AppMenuManager {
  constructor() { }
  private menu: AppActionMenu[] = [];
  set(menu: AppMenu[]) {
    const eventBus = new EventEmitter();
    function convert(menus: AppMenu[], parent: AppActionMenu | null = null): AppActionMenu[] {
      const actionMenus: AppActionMenu[] = [];
      for (const menu of menus) {
        const actionMenu: AppActionMenu = {
          ...menu,
          children: [],
          parent() {
            return parent;
          },
          setChildren(menu: AppMenu[]) {
            const m = new AppMenuManager();
            m.set(menu);
            actionMenu.children = m.get();
            eventBus.emit('change', actionMenu);
          },
          setChecked(checked: boolean, onlyOne = false) {
            if (onlyOne) {
              actionMenus.forEach(m => m.checked = false);
            }
            actionMenu.checked = checked;
            eventBus.emit('change', actionMenu);
          },
          setName(name: string) {
            actionMenu.name = name;
            eventBus.emit('change', actionMenu);
          },
          onChange(cb) {
            eventBus.on('change', cb);
            return () => eventBus.off('change', cb);
          }
        };
        if (menu.children?.length) {
          actionMenu.children = convert(menu.children, actionMenu);
        }
        actionMenus.push(actionMenu);
      }
      return actionMenus;
    }
    this.menu = convert(menu);
  }
  getByName(name: string) {
    const queue = [...this.menu];
    while (queue.length) {
      const m = queue.shift();
      if (m?.name === name) {
        return m;
      }
      queue.push(...m?.children || []);
    }
    return null;
  }
  getById(id: string): AppActionMenu | null {
    const queue = [...this.menu];
    while (queue.length) {
      const m = queue.shift();
      if (m?.id && m.id === id) {
        return m;
      }
      queue.push(...m?.children || []);
    }
    return null;
  }
  getByPath(path: string): AppActionMenu | null {
    const pathList = path.split('.');
    let curMenu = this.menu;
    for (let i = 0; i < pathList.length; i++) {
      const p = pathList[i];
      const next = curMenu.find(m => m.name === p);
      if (!next) return null;
      if (i === pathList.length - 1) {
        return next;
      }
      curMenu = next.children || [];
    }
    return null;
  }
  get(): AppActionMenu[] {
    return this.menu;
  }
}

export interface SystemHooks {
  globalSearch: SystemHook<{ keyword: string, cb: (results: GlobalSearchResult[]) => void }>,
}

export interface AppInstallContext {
  hooks: SystemHooks,
  openFile(file: string): Promise<boolean>;
  openFileBy(appName: string, file: string): Promise<void>;
  systemMessage(message: SystemMessage, onClose?: () => void): SystemMessageHandle;
}

export interface SystemMessageHandle {
  isClosed: boolean;
  close(): void;
  setMessage(msg: SystemMessage): void;
}

export interface AppDefinition {
  start(ctx: AppContext): Promise<void>;
  exit(ctx: AppContext): Promise<void>;
  getAppInfo(): AppInfo;
  installed?(ctx: AppInstallContext): Promise<void>;
  beforeUninstall?(): Promise<void>;
}

export interface AppInfo {
  width: number,
  height: number,
  name: string,
  iconUrl: string,
  supportExts: string[],
  noSandbox?: boolean,
}

export interface GlobalSearchResult {
  title: string,
  subTitle?: string,
  content?: string,
  icon?: string,
  pre?: string,
  isHtml?: boolean,
  autoClose?: boolean,
  thumbnails?: string[],
  onClick?: () => void;
}

export interface GlobalSearchOptions {
  lazy: boolean;
}

export interface AppWindow {
  id: string,
  ownerProcess: ProcessState,
  ownerApp: AppDefinitionWithContainer,
  minWidth: number,
  minHeight: number,
  window: HTMLElement,
  body: HTMLElement,
  titleBar: HTMLElement,
  setTitle: (v: string) => void;
  setVisible: (v: boolean) => void;
  setActive: (v: boolean) => void;
  focus: () => void;
  setPos(left: number, top: number): void;
  setSize(w: number, h: number): void;
  getSize(): { width: number, height: number };
  getRect(): DOMRect;
  getPos(): { left: number, top: number };
  checkPos(): void;
  onBeforeClose(cb: () => void): () => void;
  onActive(cb: () => void): () => void;
  onWindowMove(cb: (left: number, top: number) => void): () => void;
  onWindowResize(cb: (w: number, h: number) => void): () => void;
  onWindowMinimize(cb: () => void): () => void;
  showTitleBar(show?: boolean): void;
  toggleFullscreen(force?: boolean): void;
  forceFullscreen(fullscreen?: boolean): void;
  noBackground(noBg: boolean): void;
  isMinimized: boolean;
}
export interface ProcessState {
  name: string,
  isActive: boolean,
  app: AppDefinitionWithContainer,
  ctx: AppContext,
  channel: MessagePort,
  eventBus: EventEmitter,
  windows: AppWindow[],
}

export interface AppMenu {
  id?: string;
  name: string;
  checked?: boolean;
  icon?: string,
  onClick?(name: AppActionMenu): void;
  children?: AppMenu[];
  shortcut?: string[];
}

export type AppActionMenu = Omit<AppMenu, 'children'> & {
  parent(): AppActionMenu | null;
  setName(name: string): void;
  onChange(cb: (menu: AppActionMenu) => void): () => void;
  setChecked(checked: boolean, onlyOne?: boolean): void;
  setChildren(menu: AppMenu[]): void;
  children?: AppActionMenu[];
}

export interface AppControlMenu {
  icon?: string | URL | HTMLElement,
  onClick?(name: string): void;
  children?: AppMenu[];
  shortcut?: string[];
}

export interface SystemMessage {
  type?: 'info' | 'error',
  title: string,
  content: string,
  timeout?: number,
  isHtml?: boolean,
  progress?: number,
}

export interface SelectFileProps {
  allowFile?: boolean;
  allowDirectory?: boolean;
  multiple?: boolean;
  allowedExts?: string[];
}

export interface PromptContent {
  title: string;
  records?: {
    name: string,
    type?: 'text' | 'number',
    pattern?: RegExp,
  }[];
}

export interface PromptResult {
  [key: string]: string,
}

export interface SystemSharedScope {
  systemSelectFile?(app: AppDefinitionWithContainer, options: SelectFileProps): Promise<string[] | null>,
  systemMessage?(app: AppDefinitionWithContainer, msg: SystemMessage, onClose?: () => void): SystemMessageHandle,
  systemPrompt?(app: AppDefinitionWithContainer, prompt: PromptContent): Promise<PromptResult | null>,
  setSystemTitleBarFlow?(isFlow: boolean): void;
  processManager: ProcessManager,
  windowManager: WindowManager,
  appManager: AppManager,
}

export interface SharedScope {
  system: SystemSharedScope,
  shared: { [key: string]: unknown }
}

declare global {
  interface Window { sharedScope: SharedScope; __apps: Record<string, AppDefinition> }
}

export type ScopedWindow = Window & { __app: AppDefinition, __exitApp: () => void, _scoped: true, [key: string]: unknown };

export function initSharedScope(system: Pick<SystemSharedScope, 'setSystemTitleBarFlow' | 'systemSelectFile' | 'systemMessage' | 'systemPrompt'>) {
  Object.assign(window.sharedScope.system, system);
}

export function ensureSharedScope() {
  window.sharedScope = window.sharedScope || {};
  window.sharedScope.shared = window.sharedScope.shared || {};
  window.sharedScope.system = window.sharedScope.system || {};
  const system = window.sharedScope.system;
  system.appManager = system.appManager || appManager;
  system.processManager = system.processManager || processManager;
  system.windowManager = system.windowManager || windowManager;
}

ensureSharedScope();

export function getAppManager() {
  const sc = window.sharedScope;
  const appManager = sc.system.appManager;
  return appManager;
}

export function getWindowManager() {
  const sc = window.sharedScope;
  const windowManager = sc.system.windowManager;
  return windowManager;
}

export function getProcessManager() {
  const sc = window.sharedScope;
  const processManager = sc.system.processManager;
  return processManager;
}

export function setSystemTitleBarFlow(isFlow: boolean) {
  const sc = window.sharedScope;
  const ret = sc.system.setSystemTitleBarFlow!(isFlow);
  return ret;
}

export function getSharedScope() {
  return window.sharedScope;
}

export interface App {
  start?(ctx: AppContext): Promise<void>;
  exit?(ctx: AppContext): Promise<void>;
  installed?(ctx: AppInstallContext): Promise<void>;
  getAppInfo(): AppInfo;
}

export function defineApp(app: AppDefinition) {
  (window as unknown as ScopedWindow).__app = app;
}

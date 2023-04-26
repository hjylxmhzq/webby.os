import { Theme } from "../types/theme";
import EventEmitter from 'events';
import processManager, { ProcessManager } from "./process-manager";
import windowManager, { WindowManager } from "./window-manager";
import appManager, { AppManager } from "./app-manager";

export * from './process-manager';
export * from './app-manager';
export * from './window-manager';

export {
  processManager,
  windowManager,
  appManager,
};

export interface SelectFileOptions {
  allowFile?: boolean;
  allowDirectory?: boolean;
  allowedExts?: string[];
  multiple?: boolean;
}

export interface AppContext {
  theme: Theme;
  appRoot: string;
  appRootEl: HTMLElement;
  channel: MessagePort,
  appWindow: AppWindow,
  systemMenu: AppMenuManager,
  isResume: boolean, // 是否从未unmount的状态恢复
  params: Record<string, string>,
  selectFile(options: SelectFileOptions): Promise<string[] | null>
  setWindowSize: (w: number, h: number) => void;
  onOpenFile(cb: (file: string) => void): () => void;
  openFile(file: string): Promise<boolean>;
  openFileBy(appName: string, file: string): Promise<void>;
  registerExt(ext: string[]): void;
  systemMessage(message: SystemMessage, onClose?: () => void): SystemMessageHandle;
}

export class AppMenuManager {
  constructor() { }
  private menu: AppActionMenu[] = [];
  set(menu: AppMenu[]) {
    const eventBus = new EventEmitter();
    function convert(menus: AppMenu[], parent: AppActionMenu | null = null): AppActionMenu[] {
      const actionMenus: AppActionMenu[] = [];
      for (let menu of menus) {
        const actionMenu: AppActionMenu = {
          ...menu,
          children: [],
          parent() {
            return parent;
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

export interface AppInstallContext {
  hooks: SystemHooks,
  openFile(file: string): Promise<boolean>;
  openFileBy(appName: string, file: string): Promise<void>;
  systemMessage(message: SystemMessage, onClose?: () => void): SystemMessageHandle;
}

export interface SystemMessageHandle {
  isClosed: boolean;
  close(): void;
}

export interface AppDefinition {
  mount(ctx: AppContext): Promise<void>;
  unmount(ctx: AppContext): Promise<void>;
  getAppInfo(): AppInfo;
  installed?(ctx: AppInstallContext): Promise<void>;
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
  onClick?: () => void;
}

export interface SystemHooks {
  onGlobalSearch(cb: (keyword: string) => Promise<GlobalSearchResult[]>): void;
}

export type SystemHookType = keyof SystemHooks;

export interface AppWindow {
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
export interface AppState {
  el: HTMLElement,
  name: string,
  isActive: boolean,
  app: AppDefinition,
  ctx: AppContext,
  channel: MessagePort,
  eventBus: EventEmitter,
}

export interface AppMenu {
  id?: string;
  name: string;
  checked?: boolean;
  icon?: string | URL | HTMLElement,
  onClick?(name: AppActionMenu): void;
  children?: AppMenu[];
  shortcut?: string[];
}

export type AppActionMenu = Omit<AppMenu, 'children'> & {
  parent(): AppActionMenu | null;
  setName(name: string): void;
  onChange(cb: (menu: AppActionMenu) => void): () => void;
  setChecked(checked: boolean, onlyOne?: boolean): void;
  children?: AppActionMenu[];
}

export interface AppControlMenu {
  icon?: string | URL | HTMLElement,
  onClick?(name: string): void;
  children?: AppMenu[];
  shortcut?: string[];
}

export interface SystemMessage {
  type: 'info' | 'error',
  title: string,
  content: string,
  timeout: number,
  isHtml?: boolean
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
  systemSelectFile(options: SelectFileProps): Promise<string[] | null>,
  systemMessage(msg: SystemMessage, onClose?: () => void): SystemMessageHandle,
  systemPrompt(prompt: PromptContent): Promise<PromptResult | null>,
  setSystemTitleBarFlow(isFlow: boolean): void;
  processManager: ProcessManager,
  windowManager: WindowManager,
  appManager: AppManager,
}

export interface SharedScope {
  system: SystemSharedScope,
}

declare global {
  interface Window { sharedScope: SharedScope; }
}

export function initSharedScope(system: Pick<SystemSharedScope, 'setSystemTitleBarFlow' | 'systemSelectFile' | 'systemMessage' | 'systemPrompt'>) {
  const sharedScope: SharedScope = {
    system: {
      appManager: appManager,
      windowManager: windowManager,
      processManager: processManager,
      ...system,
    }
  }
  window.sharedScope = sharedScope;
}

export interface App {
  mount?(ctx: AppContext): Promise<void>;
  unmount?(ctx: AppContext): Promise<void>;
  installed?(ctx: AppInstallContext): Promise<void>;
  getAppInfo(): AppInfo;
}

export function defineApp(app: App) {
  (window as any).__app = app;
}

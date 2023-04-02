import { Theme } from "../types/theme";
import type EventEmitter from 'events';

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
  systemMenu: AppMenu[],
  isResume: boolean, // 是否从未unmount的状态恢复
  params: Record<string, string>,
  selectFile(options: SelectFileOptions): Promise<string[] | null>
  setWindowSize: (w: number, h: number) => void;
  onOpenFile(cb: (file: string) => void): () => void;
  openFile(file: string): Promise<boolean>;
  openFileBy(appName: string, file: string): Promise<void>;
  registerExt(ext: string[]): void;
  systemMessage(message: SystemMessage): Promise<void>;
}

export interface AppDefinition {
  mount(ctx: AppContext): Promise<void>;
  unmount(ctx: AppContext): Promise<void>;
  getAppInfo(): AppInfo;
}

export interface AppInfo {
  width: number,
  height: number,
  name: string,
  iconUrl: string,
  supportExts: string[],
  noSandbox?: boolean,
}

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
  name: string;
  icon?: string | URL | HTMLElement,
  onClick?(name: AppMenu): void;
  children?: AppMenu[];
  shortcut?: string[];
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
}

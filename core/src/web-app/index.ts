import { Theme } from "../types/theme";

export interface AppContext {
  theme: Theme;
  appRoot: string;
  appRootEl: HTMLElement;
  channel: MessagePort,
  appWindow: AppWindow,
  systemMenu: AppMenu[],
  setWindowSize: (w: number, h: number) => void;
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
  checkPos(): void;
  onBeforeClose(cb: () => void): () => void;
  onActive(cb: () => void): () => void;
  onWindowMove(cb: (left: number, top: number) => void): () => void;
  onWindowResize(cb: (w: number, h: number) => void): () => void;
}
export interface AppState {
  el: HTMLElement,
  name: string,
  isActive: boolean,
  app: AppDefinition,
  ctx: AppContext,
  channel: MessagePort,
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
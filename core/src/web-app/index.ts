import { Theme } from "../types/theme";

export interface AppContext {
  theme: Theme;
  appRoot: string;
  appRootEl: HTMLElement;
  channel: MessagePort,
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

export interface AppState {
  el: HTMLDivElement,
  name: string,
  isActive: boolean,
  app: AppDefinition,
  ctx: AppContext,
  channel: MessagePort,
}

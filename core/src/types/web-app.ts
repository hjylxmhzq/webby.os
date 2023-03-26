import { Theme } from "./theme";

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

export interface AppDefinition {
  mount(ctx: MicroAppContext): Promise<void>;
  unmount(ctx: MicroAppContext): Promise<void>;
  getAppInfo(): any;
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
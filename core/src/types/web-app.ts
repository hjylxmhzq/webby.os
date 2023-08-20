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

export interface MicroApp {
  mount(ctx: MicroAppContext): Promise<void>;
  unmount(ctx: MicroAppContext): Promise<void>;
  getAppInfo(): Promise<void>;
}

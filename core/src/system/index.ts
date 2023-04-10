import path from "path-browserify";
import { SelectFileOptions } from "../web-app";
import { SystemMessageHandle } from "../web-app";
import { SystemMessage } from "../web-app";

export function systemMessage(message: SystemMessage, onClose?: () => void): SystemMessageHandle {
  const sc = (window as any).sharedScope;
  return sc.system.systemMessage(message, onClose);
}

export function systemSelectFile(options: SelectFileOptions): Promise<string[] | null> {
  const sc = (window as any).sharedScope;
  return sc.system.systemSelectFile(options);
}

export async function openFile(file: string): Promise<boolean> {
  const sc = (window as any).sharedScope;
  const appManager = sc.system.appManager;
  const windowManager = sc.system.windowManager;
  
  const ext = path.parse(file).ext;
  const apps = appManager.getSupportedAppsByExt(ext);
  if (apps.length) {
    await windowManager.openFileBy(apps[0], file);
    return true;
  }
  return false;
}

export async function openFileBy(appName: string, file: string): Promise<void> {
  const sc = (window as any).sharedScope;
  const windowManager = sc.system.windowManager;
  await windowManager.startApp(appName);
  let existApp = windowManager.getAppByName(appName);
  if (existApp) {
    existApp.eventBus.emit('open_file', file);
    return;
  }
}
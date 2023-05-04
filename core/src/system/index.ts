import path from "path-browserify";
import { SelectFileOptions, SharedScope, processManager } from "../web-app";
import { SystemMessageHandle } from "../web-app";
import { SystemMessage } from "../web-app";

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

export function systemMessage(message: SystemMessage, onClose?: () => void): SystemMessageHandle {
  const sc = (window as any).sharedScope as SharedScope;;
  return sc.system.systemMessage!(message, onClose);
}

export function setSystemTitleBarFlow(isFlow: boolean): void {
  const sc = (window as any).sharedScope as SharedScope;
  return sc.system.setSystemTitleBarFlow!(isFlow);
}

export function systemPrompt(prompt: PromptContent): Promise<PromptResult | null> {
  const sc = (window as any).sharedScope as SharedScope;;
  return sc.system.systemPrompt!(prompt);
}

export function systemSelectFile(options: SelectFileOptions): Promise<string[] | null> {
  const sc = (window as any).sharedScope as SharedScope;;
  return sc.system.systemSelectFile!(options);
}

export async function openFile(file: string): Promise<boolean> {
  const sc = (window as any).sharedScope as SharedScope;;
  const appManager = sc.system.appManager;
  const windowManager = sc.system.windowManager;

  const ext = path.parse(file).ext;
  const apps = appManager.getSupportedAppsByExt(ext);
  if (apps.length) {
    await processManager.openFileBy(apps[0], file);
    return true;
  }
  return false;
}

export async function openFileBy(appName: string, file: string): Promise<void> {
  const sc = (window as any).sharedScope as SharedScope;;
  const windowManager = sc.system.windowManager;
  await processManager.startApp(appName);
  let existApp = processManager.getAppByName(appName);
  if (existApp) {
    existApp.eventBus.emit('open_file', file);
    return;
  }
}

export function getAppManager() {
  const sc = window.sharedScope;
  const appManager = sc.system.appManager;
  return appManager;
}

export function getWindowManager() {
  const sc = (window as any).sharedScope as SharedScope;;
  const windowManager = sc.system.windowManager;
  return windowManager;
}
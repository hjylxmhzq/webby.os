import path from "path-browserify";
import { ScopedWindow, SelectFileOptions, SharedScope, getProcessManager } from "../web-app";
import { SystemMessageHandle } from "../web-app";
import { SystemMessage } from "../web-app";
import { AppDefinitionWithContainer } from "../web-app/app-manager";

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
  const w = (window as unknown as ScopedWindow)
  const app = w.__app as AppDefinitionWithContainer;
  const sc = w.sharedScope as SharedScope;
  return sc.system.systemMessage!(app, message, onClose);
}

export function setSystemTitleBarFlow(isFlow: boolean): void {
  const w = (window as unknown as ScopedWindow)
  const sc = w.sharedScope as SharedScope;
  return sc.system.setSystemTitleBarFlow!(isFlow);
}

export function systemPrompt(prompt: PromptContent): Promise<PromptResult | null> {
  const w = (window as unknown as ScopedWindow)
  const app = w.__app as AppDefinitionWithContainer;
  const sc = w.sharedScope as SharedScope;
  return sc.system.systemPrompt!(app, prompt);
}

export function systemSelectFile(options: SelectFileOptions): Promise<string[] | null> {
  const w = (window as unknown as ScopedWindow)
  const app = w.__app as AppDefinitionWithContainer;
  const sc = w.sharedScope as SharedScope;
  return sc.system.systemSelectFile!(app, options);
}

export async function openFile(file: string): Promise<boolean> {
  const w = (window as unknown as ScopedWindow)
  const sc = w.sharedScope as SharedScope;
  const appManager = sc.system.appManager;

  const ext = path.parse(file).ext;
  const apps = appManager.getSupportedAppsByExt(ext);
  const processManager = getProcessManager();
  if (apps.length) {
    await processManager.openFileBy(apps[0], file);
    return true;
  }
  return false;
}

export async function openFileBy(appName: string, file: string): Promise<void> {
  const processManager = getProcessManager();
  await processManager.startApp(appName);
  const existApp = processManager.getAppByName(appName);
  if (existApp) {
    existApp.eventBus.emit('open_file', file);
    return;
  }
}

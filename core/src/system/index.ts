import path from "path-browserify";
import { SelectFileOptions, SharedScope, getProcessManager } from "../web-app";
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
  const app = (window as any).__app as AppDefinitionWithContainer;
  const sc = (window as any).sharedScope as SharedScope;
  return sc.system.systemMessage!(app, message, onClose);
}

export function setSystemTitleBarFlow(isFlow: boolean): void {
  const sc = (window as any).sharedScope as SharedScope;
  return sc.system.setSystemTitleBarFlow!(isFlow);
}

export function systemPrompt(prompt: PromptContent): Promise<PromptResult | null> {
  const app = (window as any).__app as AppDefinitionWithContainer;
  const sc = (window as any).sharedScope as SharedScope;
  return sc.system.systemPrompt!(app, prompt);
}

export function systemSelectFile(options: SelectFileOptions): Promise<string[] | null> {
  const app = (window as any).__app as AppDefinitionWithContainer;
  const sc = (window as any).sharedScope as SharedScope;;
  return sc.system.systemSelectFile!(app, options);
}

export async function openFile(file: string): Promise<boolean> {
  const sc = (window as any).sharedScope as SharedScope;;
  const appManager = sc.system.appManager;
  const windowManager = sc.system.windowManager;

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
  const sc = (window as any).sharedScope as SharedScope;;
  const windowManager = sc.system.windowManager;
  const processManager = getProcessManager();
  await processManager.startApp(appName);
  let existApp = processManager.getAppByName(appName);
  if (existApp) {
    existApp.eventBus.emit('open_file', file);
    return;
  }
}

import { AppContext, AppInfo, createAppWindow, defineApp } from '@webby/core/web-app';

import iconUrl from './icon.svg';

export async function mount(ctx: AppContext) {
  let key = Math.random().toString(16).substring(2);

  const appWindow = createAppWindow();
  const root = appWindow.body;
  root.style.position = 'absolute';
  root.style.inset = '0';
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.boxSizing = 'border-box';
  iframe.style.border = '0';
  root.appendChild(iframe);
  iframe.src = '/apps/vnc-viewer/index.html';
}

export async function unmount(ctx: AppContext) {

}

export function getAppInfo(): AppInfo {
  return {
    name: 'VNC Viewer',
    iconUrl,
    width: 500,
    height: 500,
    supportExts: [],
  }
}

defineApp({
  start: mount,
  exit: unmount,
  getAppInfo
})
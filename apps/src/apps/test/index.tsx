import { AppContext, AppInfo, AppInstallContext, createAppWindow, defineApp } from '@webby/core/web-app';
import iconUrl from './icon.svg';

export async function mount(ctx: AppContext) {
  const systemMenu = [{
    name: 'test',
  }, {
    name: 'websites',
    children: [
      {
        name: 'anylib',
        onClick() {
          iframe.src = 'https://www.anylib.cc';
        },
      },
      {
        name: 'cloud',
        onClick() {
          iframe.src = 'https://cloud.anylib.cc';
        },
      },
      {
        name: 'book',
        onClick() {
          iframe.src = 'https://m.xbiquge.so';
        },
      }
    ]
  }];
  ctx.systemMenu.set(systemMenu);

  const appWindow = createAppWindow();
  const root = appWindow.body;
  root.style.position = 'absolute';
  root.style.inset = '0';
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.boxSizing = 'border-box';
  root.appendChild(iframe);
  iframe.src = 'https://www.anylib.cc';
  ctx.onOpenFile((file) => {
    iframe.src = file;
    console.log('open: ', file);
  });
}

export async function unmount(ctx: AppContext) {
}

export function getAppInfo(): AppInfo {
  return {
    name: 'Baidu',
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
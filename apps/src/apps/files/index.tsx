import { AppContext, AppInfo, AppWindow, createAppWindow, defineApp } from '@webby/core/web-app';
import path from 'path-browserify';
import React from 'react';
import ReactDom from 'react-dom/client';
import FilePage from './src/file-page';
import iconUrl from './icon.ico';
import { CachedEventEmitter } from '../../utils/events';
import { systemMessage } from '@webby/core/system';

let root: ReactDom.Root;
export async function mount(ctx: AppContext) {
  if (ctx.windows.length > 0) {
    ctx.windows[0].setActive(true);
    return;
  }
  const appWindow = createAppWindow();
  appWindow.setSize(800, 600);
  appWindow.setPos(100, 200);
  const rootEl = appWindow.body;
  rootEl.style.position = 'absolute';
  rootEl.style.inset = '0';

  root = ReactDom.createRoot(appWindow.body);
  const openFile = async (file: string) => {
    const is_open = await ctx.openFile(file);
    if (!is_open) {
      const ext = path.parse(file).ext;
      systemMessage({ title: '无法打开文件', content: `未找到可打开${ext}后缀文件的App`, timeout: 0, type: 'error' });
    }
  };
  ctx.onOpenFile((file) => {
    eventBus.emit('open_dir', file);
  });
  const eventBus = new CachedEventEmitter();
  root.render(
    <FilePage
      ctx={ctx}
      eventBus={eventBus}
      openFile={openFile}
    />,
  );
}

export async function unmount(ctx: AppContext) {
  root?.unmount();
}

export function getAppInfo(): AppInfo {
  return {
    name: 'Files',
    iconUrl,
    width: 500,
    height: 500,
    supportExts: [],
  };
}

defineApp({
  start: mount,
  exit: unmount,
  getAppInfo,
});

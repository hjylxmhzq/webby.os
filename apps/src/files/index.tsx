import { AppContext, AppInfo } from '@webby/core/web-app';
import React from 'react';
import ReactDom from 'react-dom/client';
import FilePage from './src/file-page';

const iconUrl = 'https://cloud.anylib.cc/favicon.ico';

let root: ReactDom.Root;
export async function mount(ctx: AppContext) {
  ctx.appWindow.setSize(800, 600);
  ctx.appWindow.setPos(100, 200);
  root = ReactDom.createRoot(ctx.appRootEl);
  const openFile = (file: string) => ctx.openFileBy('Image', file);
  root.render(<FilePage openFile={openFile}/>)
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
  }
}

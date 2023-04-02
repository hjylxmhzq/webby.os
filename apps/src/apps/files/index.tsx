import { AppContext, AppInfo } from '@webby/core/web-app';
import path from 'path-browserify';
import React from 'react';
import ReactDom from 'react-dom/client';
import FilePage from './src/file-page';
import iconUrl from './icon.ico';

let root: ReactDom.Root;
export async function mount(ctx: AppContext) {
  ctx.appWindow.setSize(800, 600);
  ctx.appWindow.setPos(100, 200);
  root = ReactDom.createRoot(ctx.appRootEl);
  const openFile = async (file: string) => {
    const is_open = await ctx.openFile(file);
    if (!is_open) {
      const ext = path.parse(file).ext;
      ctx.systemMessage({ title: '无法打开文件', content: `未找到可打开${ext}后缀文件的App`, timeout: 3000, type: 'error' });
    }
  };
  root.render(<FilePage openFile={openFile} />)
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
  }
}

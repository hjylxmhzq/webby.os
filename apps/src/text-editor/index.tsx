import { read_file } from '@webby/core/fs';
import { AppContext, AppInfo } from '@webby/core/web-app';
import iconUrl from './icon.svg';
import ReactDom from 'react-dom/client';
import React from 'react';
import TextEditor from './editor';

let root: ReactDom.Root;
export async function mount(ctx: AppContext) {
  const rootEl = ctx.appRootEl;
  rootEl.style.position = 'absolute';
  rootEl.style.inset = '0';

  ctx.onOpenFile(async (file) => {
    const content = await read_file(file);
    const ab = await content.arrayBuffer();
    const td = new TextDecoder();
    const c = td.decode(ab);
    console.log('open: ', file);
  });

  root = ReactDom.createRoot(ctx.appRootEl);
  root.render(<TextEditor />);
}

export async function unmount(ctx: AppContext) {
  root?.unmount();
}

export function getAppInfo(): AppInfo {
  return {
    name: 'TextEditor',
    iconUrl,
    width: 500,
    height: 500,
    supportExts: ['txt', 'json', 'md', 'toml', 'js', 'py', 'ts'],
  }
}

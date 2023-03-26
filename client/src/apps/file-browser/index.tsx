import React from 'react';
import ReactDOM from 'react-dom/client';
import FileBrowserApp from 'src/apps/file-browser/file-browser';
import { MicroAppContext } from 'src/utils/micro-app';

export function getAppInfo() {
  return {
    icon: '',
    name: 'FileBrowser',
  }
}

let root: ReactDOM.Root;
export async function mount(ctx: MicroAppContext) {
  ctx.channel.start();
  root = ReactDOM.createRoot(ctx.appRootEl)
  root.render(<FileBrowserApp ctx={ctx} />)
}

export async function unmount(ctx: MicroAppContext) {
  if (root) {
    root.unmount();
  }
}

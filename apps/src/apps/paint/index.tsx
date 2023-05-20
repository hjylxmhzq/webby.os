import { AppContext, AppInfo, defineApp } from '@webby/core/web-app';
import iconUrl from './icon.svg';

export async function mount(ctx: AppContext) {
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.boxSizing = 'border-box';
  iframe.style.border = '0';
  root.appendChild(iframe);
  iframe.src = '/apps/paint/index.html';
  ctx.onOpenFile((file) => {
    iframe.src = file;
    console.log('open: ', file);
  });
}

export async function unmount(ctx: AppContext) {
  ctx.appRootEl.innerHTML = '';
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
  mount,
  unmount,
  getAppInfo
})
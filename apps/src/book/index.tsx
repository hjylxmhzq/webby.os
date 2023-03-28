import { AppContext, AppInfo } from '@webby/core/web-app';

const iconUrl = 'https://m.xbiquge.so/favicon.ico';

export async function mount(ctx: AppContext) {
  
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.boxSizing = 'border-box';
  root.appendChild(iframe);
  iframe.src = 'https://m.xbiquge.so';
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

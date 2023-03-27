import { AppContext, AppInfo } from '@webby/core/web-app';

const iconUrl = 'https://v1.vuepress.vuejs.org/hero.png';

export async function mount(ctx: AppContext) {
  ctx.systemMenu = [{
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
  }]
  const root = ctx.appRootEl;
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.boxSizing = 'border-box';
  root.appendChild(iframe);
  iframe.src = 'https://www.anylib.cc';
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
  }
}

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
          img.src = 'https://www.anylib.cc';
        },
      },
      {
        name: 'cloud',
        onClick() {
          img.src = 'https://cloud.anylib.cc';
        },
      },
      {
        name: 'book',
        onClick() {
          img.src = 'https://m.xbiquge.so';
        },
      }
    ]
  }]
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
  const img = document.createElement('img');
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.boxSizing = 'border-box';
  img.style.objectFit = 'contain';
  root.appendChild(img);
  img.src = 'https://v1.vuepress.vuejs.org/hero.png';
  ctx.onOpenFile((file) => {
    img.src = file;
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
  }
}

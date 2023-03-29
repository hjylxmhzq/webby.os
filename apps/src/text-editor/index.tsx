import { read_file } from '@webby/core/fs';
import { AppContext, AppInfo } from '@webby/core/web-app';
import iconUrl from './icon.svg';

export async function mount(ctx: AppContext) {
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
  const text = document.createElement('textarea');
  text.style.width = '100%';
  text.style.height = '100%';
  text.style.boxSizing = 'border-box';
  root.appendChild(text);
  ctx.onOpenFile(async (file) => {
    const content = await read_file(file);
    const ab = await content.arrayBuffer();
    const td = new TextDecoder();
    const c = td.decode(ab);
    text.value = c;
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
    supportExts: ['txt', 'json', 'md', 'toml', 'js', 'py', 'ts'],
  }
}

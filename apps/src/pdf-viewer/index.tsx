import { AppContext, AppInfo } from '@webby/core/web-app';
import ReactDom from 'react-dom/client';
import PdfViewer from './pdf-viewer';
import iconUrl from './icon.svg';
import { Collection } from '@webby/core/kv-storage';

let reactRoot: ReactDom.Root;

function debounce<T extends Function>(fn: T, delay = 500, mw?: (...args: any[]) => any) {
  let timer: number | undefined;
  return (...args: any[]) => {
    let v: any;
    if (mw) {
      v = mw(...args);
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn(...args, v);
    }, delay);
  }
}

const scrollListener = debounce((e: MouseEvent) => {
  let st = root.scrollTop || 0;
  store.set('page_scroll_top', st + '');
}, 1000);

let root: HTMLElement;

const store = new Collection('pdf-viewer-store');
export async function mount(ctx: AppContext) {
  root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.overflow = 'auto';

  root.addEventListener('scroll', scrollListener);
  let openCb: ((file: string, pageIdx: number) => void) | undefined;
  let cacheFile = '';
  const onOpenFile = (cb: (file: string, pageIdx: number) => void) => {
    openCb = cb;
    if (cacheFile) {
      store.set('last_open_file', cacheFile);
      openCb(cacheFile, 0);
      cacheFile = '';
    }
  };

  ctx.onOpenFile((file) => {
    if (openCb) {
      store.set('last_open_file', file);
      openCb(file, 0);
    } else {
      cacheFile = file;
    }
  });

  if (ctx.isResume) {
    (async () => {
      const st = await store.get('page_scroll_top');
      const f = await store.get('last_open_file');
      if (f && openCb) {
        openCb(f, 0);
      }
      if (!st) return;
      let scrollTop = parseFloat(st);
      if (!Number.isNaN(scrollTop)) {
        setTimeout(() => {
          root.scrollTop = scrollTop;
        }, 300);
      }
    })();
  }

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<PdfViewer onFileOpen={onOpenFile} />)

}

export async function unmount(ctx: AppContext) {
  await store.remove('last_open_file');
  const root = ctx.appRootEl;
  root.removeEventListener('scroll', scrollListener);
  reactRoot.unmount();
}

export function getAppInfo(): AppInfo {
  return {
    name: 'Image',
    iconUrl,
    width: 800,
    height: 500,
    supportExts: ['pdf'],
  }
}

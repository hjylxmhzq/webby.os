import { AppContext, AppInfo, AppInstallContext, defineApp } from '@webby/core/web-app';
import ReactDom from 'react-dom/client';
import PdfViewer from './pdf-viewer';
import iconUrl from './icon.svg';
import { Collection } from '@webby/core/kv-storage';
import { useEffect, useLayoutEffect, useState } from 'react';
import { debounce, debounceThrottle } from './utils';
import { CachedEventEmitter } from '../../utils/events';
import { systemSelectFile } from '@webby/core/system';

let reactRoot: ReactDom.Root;

let root: HTMLElement;

const store = new Collection('pdf-viewer-store');
let recentOpenFiles: string[] = [];
export async function mount(ctx: AppContext) {
  root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.overflow = 'auto';

  ctx.appWindow.noBackground(true);
  store.get<string[]>('recent_files').then(files => {
    if (files) {
      recentOpenFiles = files;
    }
  });

  reactRoot = ReactDom.createRoot(root);

  const eventBus = new CachedEventEmitter();

  const systemMenu = [
    {
      name: '文件',
      children: [
        {
          name: '打开',
          async onClick() {
            const file = await systemSelectFile({ allowedExts: ['pdf'] });
            if (file && file.length) {
              eventBus.emit('openfile', file[0]);
            }
          }
        }
      ]
    }
  ];
  ctx.systemMenu.set(systemMenu);

  ctx.onOpenFile(async (file) => {
    if (file) {
      console.log('openfile', file);
      eventBus.emit('openfile', file);
      await store.set('last_open_file', file);
    }
  });
  ctx.appWindow.onWindowResize(debounceThrottle((_w: number, _h: number, cw: number) => {
    // eventBus.emit("resize", cw);
  }, 1000, (w: number) => {
    return w;
  }));

  if (ctx.isResume) {
    console.log('resume');
    store.get('last_open_file').then(f => {
      if (f) {
        eventBus.emit('openfile', f);
      }
    })
  }

  function Index() {
    const [file, setFile] = useState('');
    const [pageIdx, setPageIdx] = useState(0);
    const [width, setWidth] = useState(600);
    useEffect(() => {
      eventBus.on("openfile", (file) => {
        recentOpenFiles.push(file);
        recentOpenFiles = [...new Set(recentOpenFiles)];
        store.set('recent_files', recentOpenFiles);
        setFile(file)
      });
      store.get('last_width').then((v: any) => {
        const w = parseFloat(v);
        if (!Number.isNaN(w)) {
          setWidth(w);
        }
      });
    }, []);
    const onLoaded = async (el: HTMLDivElement) => {
      const st = await store.get<string>('last_scroll_top');
      if (st) {
        const scrollTop = parseFloat(st);
        if (!Number.isNaN(scrollTop)) {
          el.scrollTop = scrollTop;
        }
      }
    }

    const onScroll = debounceThrottle(async (_: number, st: number) => {
      await store.set('last_scroll_top', st + '');
    }, 3000, (st: number) => st);

    const onResize = async (w: number) => {
      await store.set('last_width', w + '');
    }

    return <PdfViewer onResize={onResize} onScroll={onScroll} onLoaded={onLoaded} file={file} pageIdx={pageIdx} width={width} />
  }

  reactRoot.render(<Index />)
}

export async function unmount(ctx: AppContext) {
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

export async function installed(ctx: AppInstallContext) {
  recentOpenFiles = await store.get('recent_files') || [];
  ctx.hooks.globalSearch.register(async ({ keyword: search, cb }) => {
    const files = recentOpenFiles.filter(f => f.toLocaleLowerCase().includes(search));
    cb(files.map(f => ({
      title: f,
      content: '最近打开的文件',
      onClick: () => ctx.openFileBy('PdfViewer', f),
    })));
  });
}

defineApp({
  mount,
  unmount,
  installed,
  getAppInfo
})
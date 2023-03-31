import { AppContext, AppInfo } from '@webby/core/web-app';
import ReactDom from 'react-dom/client';
import PdfViewer from './pdf-viewer';
import iconUrl from './icon.svg';
import { Collection } from '@webby/core/kv-storage';
import { useEffect, useLayoutEffect, useState } from 'react';
import { debounce, debounceThrottle } from './utils';
import { CachedEventEmitter } from '../../utils/events';

let reactRoot: ReactDom.Root;

let root: HTMLElement;

const store = new Collection('pdf-viewer-store');
export async function mount(ctx: AppContext) {
  root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.overflow = 'auto';

  reactRoot = ReactDom.createRoot(root);

  const eventBus = new CachedEventEmitter();

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
      eventBus.on("openfile", (file) => setFile(file));
      eventBus.on("resize", (w) => {
        setWidth(w);
      });
      store.get('last_width').then((v: any) => {
        const w = parseFloat(v);
        if (!Number.isNaN(w)) {
          setWidth(width);
        }
      });
    }, []);

    const onLoaded = async (el: HTMLDivElement) => {
      const st = await store.get('last_scroll_top');
      if (st) {
        const scrollTop = parseFloat(st);
        if (!Number.isNaN(scrollTop)) {
          el.scrollTop = scrollTop;
        }
      }
    }

    const onScroll = async (st: number) => {
      await store.set('last_scroll_top', st + '');
    }

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

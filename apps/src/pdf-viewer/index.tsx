import { AppContext, AppInfo } from '@webby/core/web-app';
import ReactDom from 'react-dom/client';
import PdfViewer from './pdf-viewer';
import iconUrl from './icon.svg';

let reactRoot: ReactDom.Root;

export async function mount(ctx: AppContext) {
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.overflow = 'auto';
  let openCb: (file: string) => void;
  let cacheFile = '';
  const onOpenFile = (cb: (file: string) => void) => {
    openCb = cb;
    if (cacheFile) {
      openCb(cacheFile);
      cacheFile = '';
    }
  };

  ctx.onOpenFile((file) => {
    if (openCb) {
      openCb(cacheFile);
    } else {
      cacheFile = file;
    }
  });

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<PdfViewer onFileOpen={onOpenFile} />)

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

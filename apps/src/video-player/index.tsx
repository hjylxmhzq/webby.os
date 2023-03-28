import React, { useEffect, useState } from 'react';
import ReactDom from 'react-dom/client';
import { AppContext, AppInfo } from '@webby/core/web-app';
import { create_download_link_from_file_path } from '@webby/core/fs';
import VideoPreview from './video-player';
import iconUrl from './icon.svg';

let reactRoot: ReactDom.Root;

export async function mount(ctx: AppContext) {
  ctx.systemMenu = [{
    name: 'File',
    children: [
      {
        name: 'open',
        children: [
          {
            name: 'open file',
            onClick() {
              ctx.openFileBy('Files', '');
            }
          }
        ]
      }
    ]
  }];
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
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
      openCb(file);
    } else {
      cacheFile = file;
    }
  });

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<Index onOpenFile={onOpenFile} />)

}

function Index(props: { onOpenFile: (cb: (file: string) => void) => void }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    props.onOpenFile(async (file) => {
      const src = create_download_link_from_file_path(file);
      setSrc(src);
      console.log('open video: ', file);
    });
  }, []);

  return <div style={{ position: 'absolute', inset: 0 }}>
    <VideoPreview src={src} />
  </div>
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
    supportExts: ['mp4', 'mpeg', 'mkv', 'avi'],
  }
}

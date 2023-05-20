import React, { useEffect, useState } from 'react';
import ReactDom from 'react-dom/client';
import { AppContext, AppInfo, defineApp } from '@webby/core/web-app';
import { create_download_link_from_file_path } from '@webby/core/fs';
import VideoPreview from './video-player';
import iconUrl from './icon.svg';
import style from './video-player.module.less';
import { systemSelectFile } from '@webby/core/system';
import { Collection } from '@webby/core/kv-storage';

let reactRoot: ReactDom.Root;

let state: { state: { recentFiles: string[] } };
export async function mount(ctx: AppContext) {
  const systemMenu = [{
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
  ctx.systemMenu.set(systemMenu);

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
  const store = new Collection('video_player');
  state = await store.getReactiveState('recent_files', { recentFiles: [] as string[] });
  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<Index onOpenFile={onOpenFile} />)
}

function Index(props: { onOpenFile: (cb: (file: string) => void) => void }) {
  const [src, setSrc] = useState('');
  const [recentFiles, setRecentFiles] = useState<string[]>([]);

  const openFile = async (file: string) => {
    const newRecentFiles = [...new Set([file, ...state.state.recentFiles])];
    state.state.recentFiles = newRecentFiles;
    setRecentFiles(state.state.recentFiles);
    const src = create_download_link_from_file_path(file);
    setSrc(src);
    console.log('open video: ', file);
  }

  useEffect(() => {
    setRecentFiles(state.state.recentFiles);
    props.onOpenFile(async (file) => {
      openFile(file);
    });
  }, []);

  const onClick = async (file?: string) => {
    if (!file) {
      const files = await systemSelectFile({ allowedExts: ['mp4', 'mpeg', 'mkv', 'avi'] });
      if (files?.length) {
        openFile(files[0]);
      }
    } else {
      openFile(file);
    }
  }

  const onClear = () => {
    state.state.recentFiles = [];
    setRecentFiles([]);
  }

  return <div style={{ position: 'absolute', inset: 0 }}>
    {
      src ?
        <VideoPreview src={src} />
        : <OpenFile onClear={onClear} onClick={onClick} recentFiles={recentFiles}></OpenFile>
    }
  </div>
}

function OpenFile(props: { onClick: (file?: string) => void, recentFiles: string[], onClear: () => void }) {
  return <div className={style['home-container']}>
    <div className={style['open-btn']} onClick={() => props.onClick()}>
      <span>Open File</span>
    </div>
    <div className={style['recent-files-title']}>最近打开的文件<span className={style.clear} onClick={props.onClear}>清空</span></div>
    <div className={style['recent-files']}>
      {
        props.recentFiles.map(f => {
          return <div className={style['recent-file']} onClick={() => props.onClick(f)} key={f}>{f}</div>
        })
      }
    </div>
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

defineApp({
  mount,
  unmount,
  getAppInfo
})
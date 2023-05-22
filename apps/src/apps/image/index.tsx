import React, { useEffect, useState } from 'react';
import ReactDom from 'react-dom/client';
import { AppContext, AppInfo, AppWindow, SelectFileOptions, createAppWindow, defineApp } from '@webby/core/web-app';
import ImagePreview from './image-viewer';
import { FileStat, readdir } from '@webby/core/fs';
import path from 'path-browserify';
import iconUrl from './icon.svg';
import { CachedEventEmitter } from '../../utils/events';
import style from './image-viewer.module.less';
import { systemMessage, systemSelectFile } from '@webby/core/system';

let reactRoot: ReactDom.Root;
let eventBus = new CachedEventEmitter();
let appWindow: AppWindow;
export async function mount(ctx: AppContext) {
  if (appWindow) {
    appWindow.setActive(true);
    return;
  }
  appWindow = createAppWindow();
  const systemMenu = [{
    name: 'File',
    children: [
      {
        name: 'Open File',
        async onClick() {
          const files = await systemSelectFile({ allowedExts });
          if (files && files.length) {
            systemMessage({ title: `打开文件`, content: files[0], timeout: 2000, type: 'info' });
            eventBus.emit('openfile', files[0]);
          }
        }
      }
    ]
  }];
  ctx.systemMenu.set(systemMenu);

  const root = appWindow.body;
  root.style.position = 'absolute';
  root.style.inset = '0';

  const onOpenFile = (cb: (file: string) => void) => {
    eventBus.on('openfile', cb);
  };

  ctx.onOpenFile((file) => {
    eventBus.emit('openfile', file);
  });

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<Index ctx={ctx} onOpenFile={onOpenFile} />);
}

function Index(props: { ctx: AppContext, onOpenFile: (cb: (file: string) => void) => void }) {
  const [file_path, setFilePath] = useState('');
  const [file, setFile] = useState<FileStat>();
  const [files, setFiles] = useState<FileStat[]>([]);

  async function loadImage(file: string) {
    const dir = path.parse(file).dir;
    const filename = path.basename(file);
    const files = await readdir(dir);
    let f = files.find(f => f.name === filename);
    setFiles(files);
    setFile(f);
    setFilePath(file);
    console.log('open image: ', file);
  }

  useEffect(() => {
    props.onOpenFile(async (file) => {
      await loadImage(file);
    });
  }, []);

  return <div style={{ position: 'absolute', inset: 0 }}>
    {
      file ? <ImagePreview appWindow={appWindow} ctx={props.ctx} files={files} file={file} dir={path.parse(file_path).dir} />
        : <OpenFile onClick={async () => {
          const files = await systemSelectFile({ allowedExts });
          console.log(files);
          if (files && files.length) {
            await loadImage(files[0]);
          }
        }} />
    }
  </div>
}

function OpenFile(props: { onClick: () => void }) {
  return <div className={style['open-btn']} onClick={props.onClick}>Open File</div>;
}

export async function unmount(ctx: AppContext) {
  reactRoot.unmount();
}

const allowedExts = ['jpg', 'jpeg', 'png', 'webp']

export function getAppInfo(): AppInfo {
  return {
    name: 'Image',
    iconUrl,
    width: 500,
    height: 500,
    supportExts: allowedExts,
  }
}

defineApp({
  mount,
  unmount,
  getAppInfo
})
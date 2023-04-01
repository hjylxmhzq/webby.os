import React, { useEffect, useState } from 'react';
import ReactDom from 'react-dom/client';
import { AppContext, AppInfo, SelectFileOptions } from '@webby/core/web-app';
import ImagePreview from './image-viewer';
import { FileStat, readdir } from '@webby/core/fs';
import path from 'path-browserify';
import iconUrl from './icon.svg';
import { CachedEventEmitter } from '../../utils/events';
import style from './image-viewer.module.less';

let reactRoot: ReactDom.Root;
let eventBus = new CachedEventEmitter();
export async function mount(ctx: AppContext) {
  ctx.systemMenu = [{
    name: 'File',
    children: [
      {
        name: 'Open File',
        async onClick() {
          const files = await ctx.selectFile({ allowedExts });
          if (files && files.length) {
            eventBus.emit('openfile', files[0]);
          }
        }
      }
    ]
  }];

  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';

  const onOpenFile = (cb: (file: string) => void) => {
    eventBus.on('openfile', cb);
  };

  ctx.onOpenFile((file) => {
    eventBus.emit('openfile', file);
  });

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<Index onOpenFile={onOpenFile} selectFile={ctx.selectFile} />)

}

function Index(props: { onOpenFile: (cb: (file: string) => void) => void, selectFile: (options: SelectFileOptions) => Promise<string[] | null> }) {
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
      file ? <ImagePreview files={files} file={file} dir={path.parse(file_path).dir} />
        : <OpenFile onClick={async () => {
          const files = await props.selectFile({ allowedExts });
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

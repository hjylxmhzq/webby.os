import React, { useEffect, useState } from 'react';
import ReactDom from 'react-dom/client';
import { AppContext, AppInfo } from '@webby/core/web-app';
import ImagePreview from './image-viewer';
import { FileStat, readdir } from '@webby/core/fs';
import path from 'path-browserify';

const iconUrl = 'https://v1.vuepress.vuejs.org/hero.png';

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
  const [file_path, setFilePath] = useState('');
  const [file, setFile] = useState<FileStat>();
  const [files, setFiles] = useState<FileStat[]>([]);

  useEffect(() => {
    props.onOpenFile(async (file) => {
      const dir = path.parse(file).dir;
      const filename = path.basename(file);
      const files = await readdir(dir);
      let f = files.find(f => f.name === filename);
      setFiles(files);
      setFile(f);
      setFilePath(file);
      console.log('open image: ', file);
    });
  }, []);

  return <div style={{ position: 'absolute', inset: 0 }}>
    {
      file && <ImagePreview files={files} file={file} dir={path.parse(file_path).dir} />
    }
  </div>
}

export async function unmount(ctx: AppContext) {
  reactRoot.unmount();
}

export function getAppInfo(): AppInfo {
  return {
    name: 'Image',
    iconUrl,
    width: 500,
    height: 500,
    supportExts: ['jpg', 'jpeg', 'png', 'webp'],
  }
}

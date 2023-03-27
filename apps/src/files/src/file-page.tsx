import { create_download_link_from_file_path, FileStat, readdir } from "@webby/core/fs"
import { useEffect, useState } from "react";
import style from './file-page.module.less';
import path from 'path-browserify';

export default function FilePage(props: { openFile: (file: string) => void }) {
  const [dir, setDir] = useState('');
  const onClick = (file: FileStat) => {
    if (file.is_dir) {
      setDir(path.join(dir, file.name));
    } else {
      const file_path = path.join(dir, file.name);
      const link = create_download_link_from_file_path(file_path);
      props.openFile(link);
      console.log('click file: ', file);
    }
  }
  return <div>
    <FileList dir={dir} onClick={onClick} />
  </div>
}

function FileList(props: { dir: string, onClick: (name: FileStat) => void }) {
  const [files, setFiles] = useState<FileStat[]>([]);
  const gotoDir = async (dir: string) => {
    const _files = await readdir(props.dir);
    setFiles(_files);
  }
  useEffect(() => {
    (async () => {
      await gotoDir(props.dir);
    })();
  }, [props.dir]);

  const parent: FileStat = { name: '..', is_dir: true, is_file: false, created: 0, modified: 0, size: 0, accessed: 0 };

  return <div className={style['file-page']}>
    {
      props.dir !== '' && props.dir !== '.' &&
      <div onClick={() => props.onClick(parent)} key='..' className={style['file-item']}>..</div>
    }
    {
      files.map(file => {
        return <div onClick={() => props.onClick(file)} key={file.name} className={style['file-item']}>{file.name}</div>
      })
    }
  </div>
}
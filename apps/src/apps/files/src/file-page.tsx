import { create_download_link_from_file_path, delete_files, FileStat, readdir, upload } from "@webby/core/fs"
import { useEffect, useState } from "react";
import style from './file-page.module.less';
import path from 'path-browserify';
import { formatFileSize, formatTime } from "./utils";
import Button from "./components/button";
import Checkbox from "./components/checkbox";

export default function FilePage(props: { openFile: (file: string) => void }) {
  const [dir, setDir] = useState('');
  const onClick = (file: FileStat) => {
    if (file.is_dir) {
      setDir(path.join(dir, file.name));
    } else {
      const file_path = path.join(dir, file.name);
      props.openFile(file_path);
      console.log('click file: ', file);
    }
  }
  return <div style={{ height: '100%', overflow: 'auto' }}>
    <FileList dir={dir} onClick={onClick} />
  </div>
}

function FileList(props: { dir: string, onClick: (name: FileStat) => void }) {
  const [files, setFiles] = useState<FileStat[]>([]);
  const [checkList, setCheckList] = useState<boolean[]>([]);
  const gotoDir = async (dir: string) => {
    const _files = await readdir(props.dir);
    setCheckList([]);
    setFiles(_files);
  }
  useEffect(() => {
    (async () => {
      await gotoDir(props.dir);
    })();
  }, [props.dir]);

  const parent: FileStat = { name: '..', is_dir: true, is_file: false, created: 0, modified: 0, size: 0, accessed: 0 };

  return <div className={style['file-page']}>
    <div className={style['file-page-title-bar']}>
      <span className={style.left}>
        {props.dir.split('/').join(' / ')}
      </span>
      <span className={style.right}>
        <Button onClick={async () => {
          await upload(props.dir, { mulitple: true });
          await gotoDir(props.dir);
        }}>上传</Button>
        {
          checkList.some(c => c) &&
          <Button onClick={async () => {
            const checked_files = [];
            for (let i in checkList) {
              if (checkList[i]) {
                checked_files.push(path.join(props.dir, files[i].name));
              }
            }
            await delete_files(checked_files);
            await gotoDir(props.dir);
          }}>删除</Button>
        }
      </span>
    </div>
    {
      props.dir !== '' && props.dir !== '.' &&
      <div onClick={() => props.onClick(parent)} key='..' className={style['file-item']}>..</div>
    }
    {
      files.map((file, idx) => {
        return <div key={file.name} className={style['file-item']}>
          <span className={style.left}>
            <Checkbox checked={!!checkList[idx]} onChange={checked => {
              checkList[idx] = checked;
              setCheckList([...checkList]);
            }} />
            <span className={style.filename} onClick={() => props.onClick(file)} >
              {file.name}
            </span>
          </span>
          <span className={style.right}>
            <span>
              {formatTime(file.modified)}
            </span>
            <span>
              {formatFileSize(file.size)}
            </span>
          </span>
        </div>
      })
    }
  </div>
}
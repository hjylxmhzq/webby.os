import { create_compression_download_link, create_download_link, create_download_link_from_file_path, delete_files, FileStat, readdir, upload } from "@webby/core/fs"
import { useEffect, useRef, useState } from "react";
import style from './file-page.module.less';
import path from 'path-browserify';
import { formatFileSize, formatTime } from "./utils";
import Button from "./components/button";
import Checkbox from "./components/checkbox";
import { CachedEventEmitter } from "src/utils/events";

export default function FilePage(props: { openFile: (file: string) => void, eventBus: CachedEventEmitter }) {
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
  useEffect(() => {
    const setDirCb = (dir: string) => {
      setDir(dir);
    }
    props.eventBus.on('open_dir', setDirCb);
    return () => {
      props.eventBus.off('open_dir', setDirCb);
    };
  }, []);

  return <div style={{ height: '100%', overflow: 'auto' }}>
    <FileList dir={dir} onClick={onClick} />
  </div>
}

function FileList(props: { dir: string, onClick: (name: FileStat) => void }) {
  const [files, setFiles] = useState<FileStat[]>([]);
  const [checkList, setCheckList] = useState<boolean[]>([]);
  const seqRef = useRef(0);
  const gotoDir = async (dir: string) => {
    seqRef.current += 1;
    let seq = seqRef.current;
    const _files = await readdir(dir);
    // 如果在等待期间gotoDir再次被执行，则放弃这次结果，直接采用最后一次请求的结果
    if (seq !== seqRef.current) return;
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
        const create_link = file.is_dir ? create_compression_download_link : create_download_link;
        const downloadName = file.is_dir ? file.name + '.zip' : file.name;
        const link = create_link(props.dir, file.name);
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
          <a className={style.download} href={link} download={downloadName}>下载</a>
        </div>
      })
    }
  </div>
}
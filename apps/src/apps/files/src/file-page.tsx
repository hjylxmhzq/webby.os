import { create_compression_download_link, create_download_link, create_download_link_from_file_path, delete_files, FileStat, readdir, upload } from "@webby/core/fs"
import { useEffect, useRef, useState } from "react";
import style from './file-page.module.less';
import path from 'path-browserify';
import { formatFileSize, formatTime } from "./utils";
import Button from "../../../components/button";
import Checkbox from "./components/checkbox";
import { CachedEventEmitter } from "../../../utils/events";
import { AppContext } from "@webby/core/web-app";
import { makedir } from "@webby/core/fs";
import { AnimationButton } from "../../../components/button";
import { UploadProgress } from "../../../components/progress";

export default function FilePage(props: { ctx: AppContext, openFile: (file: string) => void, eventBus: CachedEventEmitter }) {
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
    <FileList dir={dir} onClick={onClick} ctx={props.ctx} />
  </div>
}

function FileList(props: { ctx: AppContext, dir: string, onClick: (name: FileStat) => void }) {
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

  interface UploadInfo {
    [id: string]: {
      total: number,
      uploaded: number,
      text: string,
    }
  }
  const [uploadInfo, setUploaded] = useState({} as UploadInfo);
  const uploadInfoRef = useRef(uploadInfo);
  uploadInfoRef.current = uploadInfo;

  return <div className={style['file-page']}>
    {
      Object.keys(uploadInfo).sort().map((key) => {
        const info = uploadInfo[key];
        return <UploadProgress key={key} uploaded={info.uploaded} total={info.total} text={info.text} />
      })
    }
    <div className={style['file-page-title-bar']}>
      <span className={style.left}>
        {props.dir.split('/').join(' / ')}
      </span>
      <span className={style.right}>
        <Button className={style['title-btn']} style={{ width: 90 }} onClick={async () => {
          const dirName = prompt('文件夹名称');
          if (dirName) {
            const dir = path.join(props.dir, dirName);
            await makedir(dir);
            await gotoDir(props.dir);
          } else {
            props.ctx.systemMessage({ type: 'error', title: '文件名错误', content: '文件名不能为空', timeout: 3000 });
          }
        }}>新建文件夹</Button>
        <Button className={style['title-btn']} onClick={async () => {
          const id = Math.random().toString();
          await upload(props.dir, {
            mulitple: true,
            directory: true,
            onUploadProgress(e, info) {
              setUploaded({
                ...uploadInfoRef.current,
                [id]: {
                  total: e.total || 0,
                  uploaded: e.loaded,
                  text: info.text,
                }
              })
            },
          });
          delete uploadInfoRef.current[id];
          setUploaded({
            ...uploadInfoRef.current,
          });
          await gotoDir(props.dir);
        }}>上传文件夹</Button>
        <Button className={style['title-btn']} onClick={async () => {
          const id = Math.random().toString();
          await upload(props.dir, {
            mulitple: true,
            onUploadProgress(e, info) {
              setUploaded({
                ...uploadInfoRef.current,
                [id]: {
                  total: e.total || 0,
                  uploaded: e.loaded,
                  text: info.text,
                }
              })
            },
          });
          delete uploadInfoRef.current[id];
          setUploaded({
            ...uploadInfoRef.current,
          });
          await gotoDir(props.dir);
        }}>上传</Button>
        {
          checkList.some(c => c) &&
          <AnimationButton
            className={style['title-btn']}
            onClick={async () => {
              const checked_files = [];
              for (let i in checkList) {
                if (checkList[i]) {
                  checked_files.push(path.join(props.dir, files[i].name));
                }
              }
              await delete_files(checked_files);
              await gotoDir(props.dir);
            }}>删除</AnimationButton>
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
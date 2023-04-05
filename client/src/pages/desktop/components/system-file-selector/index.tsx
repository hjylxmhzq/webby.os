import { FileStat, readdir } from "@webby/core/fs"
import { useCallback, useEffect, useState } from "react";
import style from './index.module.less';
import path from 'path-browserify';
import { formatFileSize, formatTime } from "@utils/formatter";
import Button from "@components/button";
import Checkbox from "@components/checkbox";
import classNames from "classnames";
import Icon, { FileThumbnailIcon } from "@components/icon/icon";

export interface SelectFileProps {
  allowFile?: boolean;
  allowDirectory?: boolean;
  multiple?: boolean;
  allowedExts?: string[];
}

export default function SystemFileSelector(props: { onSelection: (files: string[] | null) => void, options: SelectFileProps }) {
  const [dir, setDir] = useState('');
  const options: Required<SelectFileProps> = {
    allowFile: true,
    allowDirectory: false,
    multiple: false,
    allowedExts: [],
    ...props.options,
  };
  const onSelection = (files: FileStat[] | null) => {
    if (!files) return props.onSelection(null);
    const _files = files.map(f => path.join(dir, f.name));
    props.onSelection(_files);
  };
  const onClick = (file: FileStat) => {
    if (file.is_dir) {
      setDir(path.join(dir, file.name));
    } else if (!options.multiple) {
      props.onSelection([path.join(dir, file.name)]);
    }
  };
  return <div className={style['file-selector']}>
    <FileList dir={dir} onSelection={onSelection} options={options} onClick={onClick} />
  </div>
}

function FileList(props: { dir: string, onClick: (file: FileStat) => void, onSelection: (name: FileStat[] | null) => void, options: Required<SelectFileProps> }) {
  const [files, setFiles] = useState<FileStat[]>([]);
  const [allowedFiles, setAllowFiles] = useState<string[]>([]);
  const [checkList, setCheckList] = useState<Set<string>>(new Set());
  const [listType, setListType] = useState<'list' | 'card'>('list');
  const gotoDir = useCallback(async (dir: string) => {
    const _files = await readdir(props.dir);
    setCheckList(new Set());
    const _allowedFiles = _files.filter(f => {
      let allowed = true;
      if (!props.options.allowFile && f.is_file) {
        allowed = false;
      }
      if (!props.options.allowDirectory && f.is_dir) {
        allowed = false;
      }
      if (props.options.allowedExts.length && !props.options.allowedExts.some(ext => f.name.endsWith(ext))) {
        allowed = false;
      }
      return allowed;
    }).map(f => f.name);
    setAllowFiles(_allowedFiles);
    setFiles(_files);
  }, [props.dir, props.options.allowDirectory, props.options.allowFile, props.options.allowedExts]);
  useEffect(() => {
    (async () => {
      await gotoDir(props.dir);
    })();
  }, [props.dir, gotoDir]);
  const parent: FileStat = { name: '..', is_dir: true, is_file: false, created: 0, modified: 0, size: 0, accessed: 0 };

  return <div className={style['file-page']}>
    <div className={style['file-page-title-bar']}>
      <span className={style.left}>
        {props.dir.split('/').map(seg => seg === '.' || seg === '' ? '/' : seg).join(' / ')}
      </span>
      <span className={style.right}>
        <Icon onClick={() => setListType(listType === 'list' ? 'card' : 'list')} className={style.icon} name={listType === 'list' ? 'list' : 'all'}></Icon>
        <Button
          className={style.btn}
          onClick={async () => {
            const selected = files.filter((f) => checkList.has(f.name));
            props.onSelection(selected);
          }}>确定</Button>
        <Button
          className={style.btn}
          onClick={async () => {
            props.onSelection(null);
          }}>取消</Button>
      </span>
    </div>
    {
      props.dir !== '' && props.dir !== '.' &&
      <div onClick={() => props.onClick(parent)} key='..' className={style['file-item']}>..</div>
    }
    {
      listType === 'list' ?
        <FileRowList files={files} allowedFiles={allowedFiles} checkList={checkList} setCheckList={setCheckList} dir={props.dir} onClick={props.onClick} options={props.options} />
        : <FileCardList files={files} allowedFiles={allowedFiles} checkList={checkList} setCheckList={setCheckList} dir={props.dir} onClick={props.onClick} options={props.options} />
    }
  </div>
}

interface FileListProps {
  files: FileStat[];
  dir: string;
  onClick: (file: FileStat) => void;
  options: Required<SelectFileProps>;
  setCheckList: (l: Set<string>) => void;
  checkList: Set<string>;
  allowedFiles: string[];
}

function FileRowList(props: FileListProps) {
  const { checkList, setCheckList, allowedFiles } = props;

  return <div className={classNames(style['file-list'], 'scrollbar')}>
    {
      props.files.map((file, idx) => {

        const canSelect = checkList.has(file.name) ||
          (props.options.multiple && allowedFiles.includes(file.name)) ||
          (!props.options.multiple && checkList.size === 0 && allowedFiles.includes(file.name));

        const canClick = canSelect || file.is_dir;

        return <div key={file.name} className={style['file-item']}>
          <span className={style.left}>
            <Checkbox disabled={!canSelect} checked={checkList.has(file.name)} onChange={checked => {
              if (checked) {
                checkList.add(file.name);
              } else {
                checkList.delete(file.name);
              }
              setCheckList(new Set(checkList));
            }} />
            <span className={classNames(style.filename, { [style.disabled]: !canClick })} onClick={() => {
              canClick && props.onClick(file);
            }} title={file.name}>
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

function FileCardList(props: FileListProps) {
  const { checkList, setCheckList, allowedFiles } = props;

  return <div className={classNames(style['file-card-list'], 'scrollbar')}>
    {
      props.files.map((file, idx) => {

        const canSelect = checkList.has(file.name) ||
          (props.options.multiple && allowedFiles.includes(file.name)) ||
          (!props.options.multiple && checkList.size === 0 && allowedFiles.includes(file.name));

        const canClick = canSelect || file.is_dir;
        const onClick = () => {
          canClick && props.onClick(file);
        };

        return <div title={file.name} onClick={onClick} key={file.name} className={style['file-card-item']}>
          <Checkbox onClick={e => e.stopPropagation()} className={style['file-card-checkbox']} disabled={!canSelect} checked={checkList.has(file.name)} onChange={checked => {
            if (checked) {
              checkList.add(file.name);
            } else {
              checkList.delete(file.name);
            }
            setCheckList(new Set(checkList));
          }} />
          <div className={style['file-icon']}>
            {
              <FileThumbnailIcon file={file} dir={props.dir} size={60} imgWidth={90} imgHeight={65} className={classNames(style['img-icon'], { [style.disabled]: !canClick })} />
            }
          </div>
          <div className={style['file-card-botton']}>
            <span className={classNames(style.filename, { [style.disabled]: !canClick })} title={file.name}>
              {file.name}
            </span>
          </div>
        </div>
      })
    }
  </div>
}
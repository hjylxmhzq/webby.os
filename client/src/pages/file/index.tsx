import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { create_compression_download_link, create_dir, create_download_link, delete_file, delete_files, FileStat, read_dir, send_to_aria2, upload } from "@apis/file";
import path from 'path-browserify';
import style from './index.module.less';
import Preview from "./components/preview";
import { Popover } from "@components/popover";
import { useRefresh } from "@hooks/common";
import LoadingBar from "./components/loading-bar";
import moment from 'moment';
import { formatFileSize } from "@utils/formatter";
import classnames from 'classnames';
import { useLocation, useNavigate } from 'react-router-dom';
import Button, { AnimationButton } from "@components/button";
import { UploadProgress } from "@components/progress";
import { AxiosProgressEvent } from "axios";
import Modal from "@components/modal";
import { FileIcon } from "@components/icon/icon";
import Checkbox from "@components/checkbox";
import { setting } from "@store";
import SearchInput from "./components/search-input";
import classNames from "classnames";

export default function FilePage() {
  let [files, setFiles] = useState<any[]>([]);
  const [signal, reloadFiles] = useRefresh();
  let [isLoading, setIsLoading] = useState(false);
  let [progress, setProgress] = useState<{ total: number, uploaded: number, text: string, id: string }[]>([]);
  const modalRef = useRef<{ show: () => Promise<string> }>(null);
  const uploadId = useRef(0);

  const location = useLocation();
  const currentDir = location.state?.currentDir || '';
  const previewing = location.state?.previewing;
  const history = useNavigate();

  const gotoDir = useCallback((dir: string = currentDir) => {
    if (dir === '.') {
      dir = ''
    }
    history('/', { state: { currentDir: dir } });
  }, [currentDir, history]);

  const reload = async (dir: string = currentDir) => {
    setIsLoading(true);
    let data = await read_dir(dir);
    setIsLoading(false);
    setFiles(data);
  };

  const setPreviewing = (file: FileStat) => {
    history('/', { state: { previewing: file, currentDir: currentDir } });
  }

  useEffect(() => {
    gotoDir('');
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line
  }, [signal]);

  useEffect(() => {
    (async () => {
      const state = location.state;
      if (state && state.currentDir !== undefined) {
        await reload(state.currentDir);
      }
    })();
    // eslint-disable-next-line
  }, [location]);

  const onClickFile = (file: FileStat) => {
    if (file.is_dir) {
      gotoDir(path.join(currentDir, file.name));
    } else {
      setPreviewing(file);
    }
  };

  const currentPath = previewing ? path.join(currentDir, previewing.name) : currentDir;
  const onUploadProgressFac = (id: string, abort: AbortSignal) => {
    abort.addEventListener('abort', () => {
      setProgress((progress) => {
        let p = progress.findIndex(p => p.id === id);
        console.log('aborttt', p);
        if (p === -1) return [...progress];
        progress.splice(p);
        return [...progress];
      })
    }, false);
    return (e: AxiosProgressEvent, info: { text: string }) => {
      setProgress(progress => {
        let p = progress.find(p => p.id === id);
        if (!p) return [...progress, { total: e.total || 0, uploaded: e.loaded, text: info.text + ' ', id }];
        p.total = e.total || 0;
        p.uploaded = e.loaded;
        return [...progress];
      })
    }
  };

  const [checkedFiles, setCheckFiles] = useState<Map<string, FileStat>>(new Map());
  const [showDeleteComfirmModal, setShowDeleteComfirmModal] = useState(false);

  const onFileChecked = useCallback((checkedFiles: Map<string, FileStat>) => {
    setCheckFiles(checkedFiles);
  }, []);
  const fileList = useMemo(() => {
    return <FileList onFileChecked={onFileChecked} onReload={reloadFiles} files={files} currentDir={currentDir} onClickFile={onClickFile} />;
    // eslint-disable-next-line
  }, [files, currentDir]);

  const showAddFolder = () => {
    if (modalRef.current) {
      modalRef.current.show();
    }
  }
  const onAddFolderFinished = async (folder: string) => {
    await create_dir(currentDir, folder);
    reloadFiles();
  };

  const [tab, setTab] = useState<'file' | 'favorite' | 'share'>('file');

  let content = <EmptyList />;
  if (tab === 'file') {
    if (files.length > 0) {
      content = fileList;
    }
  }

  return <div className={style['file-page']}>
    <Modal mask show={showDeleteComfirmModal}>
      <div className={style['delete-comfirm-modal']}>
        <div>确认删除 <strong>{checkedFiles.keys().next().value}</strong> 等 <strong>{checkedFiles.size}</strong> 个文件吗?</div>
        <div>
          <Button type="danger" onClick={async () => {
            await delete_files(currentDir, [...checkedFiles.keys()]);
            setShowDeleteComfirmModal(false);
            reloadFiles();
          }}>删除</Button>
          <Button onClick={() => setShowDeleteComfirmModal(false)}>取消</Button>
        </div>
      </div>
    </Modal>
    <AddFolderModal ref={modalRef} onFinished={onAddFolderFinished} />
    {
      !previewing ?
        <div>
          {
            progress.map(progress => {
              return <UploadProgress key={progress.id} total={progress.total} uploaded={progress.uploaded} text={progress.text} />
            })
          }
          <LoadingBar loading={isLoading} />
          <div className={style['header-bar']}>
            <Breadcumb onJumpPath={(p) => gotoDir(p)} currentPath={currentPath} />
            <div className={style['header-actions']}>
              <SearchInput onClick={file => gotoDir(file.dir)} />
              <Button onClick={async () => {
                showAddFolder();
              }}>新建文件夹</Button>
              <Button onClick={async () => {
                const abort = new AbortController();
                try {
                  await upload(currentDir, { onUploadProgress: onUploadProgressFac(uploadId.current++ + '', abort.signal), mulitple: true });
                } catch (_) {
                  console.error('upload error');
                }
                abort.abort();
                reloadFiles();
              }}>上传</Button>
              <Button onClick={async () => {
                const abort = new AbortController();
                try {
                  await upload(currentDir, { onUploadProgress: onUploadProgressFac(uploadId.current++ + '', abort.signal), mulitple: true, directory: true });
                } catch (_) {
                  console.error('upload error');
                }
                abort.abort();
                reloadFiles();
              }}>上传文件夹</Button>

              {
                checkedFiles.size !== 0 &&
                <>
                  <AnimationButton type="danger" onClick={async () => {
                    setShowDeleteComfirmModal(true);
                  }}
                  >删除</AnimationButton>
                </>
              }
            </div>
          </div>
          <div className={style['file-content']}>
            <div className={style['file-left-menu']}>
              <div className={classNames(style['menu-item'], { [style.active]: tab === 'file' })} onClick={() => setTab('file')}>文件目录</div>
              <div className={classNames(style['menu-item'], { [style.active]: tab === 'favorite' })} onClick={() => setTab('favorite')}>个人收藏</div>
              <div className={classNames(style['menu-item'], { [style.active]: tab === 'share' })} onClick={() => setTab('share')}>已分享</div>
            </div>
            {content}
          </div>
        </div>
        : <Preview file={previewing} files={files} dir={currentDir} onClose={gotoDir} />
    }
  </div>
}

function Breadcumb({ onJumpPath, currentPath }: { onJumpPath: (p: string) => void, currentPath: string }) {
  let acc = '';
  return <div className={style.breadcumb}>
    <span className={style['breadcumb-item']} onClick={() => onJumpPath('')}>Home</span>
    {
      currentPath && currentPath.split('/').map((p, i) => {
        acc = acc + (i === 0 ? '' : '/') + p;
        const cur_path = acc;
        return <React.Fragment key={cur_path}>
          <span className={style['breadcumb-item-sep']}>/</span>
          <span title={p} className={style['breadcumb-item']} key={cur_path} onClick={() => {
            onJumpPath(cur_path);
          }}>
            {p}
          </span>
        </React.Fragment>;
      })
    }
  </div>
}

const AddFolderModal = forwardRef<{ show: () => void }, { onFinished?: (folder: string) => void }>((props, ref) => {

  const [show, setShow] = useState(false);
  if (ref && typeof ref === 'function') {
    ref({ show: () => setShow(true) })
  } else if (ref) {
    ref.current = {
      show: async () => {
        setShow(true);
      }
    };
  }

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show && inputRef.current) {
      let el = inputRef.current;
      el.focus();
      el.select();
    }
  }, [show]);


  const [newName, setNewName] = useState('未命名文件夹');
  return <Modal mask show={show}>
    <div>
      <div className={style['modal-title']}>新建文件夹</div>
      <input ref={inputRef} className={style['text-input']} type='text' value={newName} onChange={(e) => setNewName(e.target.value)}></input>
      <Button onClick={() => {
        setShow(false);
        props.onFinished?.(newName);
      }}>确定</Button>
      <Button onClick={() => {
        setShow(false);
      }}>取消</Button>
    </div>
  </Modal>
});

function FileList({ onFileChecked, files, onClickFile, currentDir, onReload }: { onFileChecked?: (checkedFiles: Map<string, FileStat>) => void, files: FileStat[], onClickFile: (file: FileStat) => void, currentDir: string, onReload: () => void }) {

  const actionsMenu = (file: FileStat) => <div className={style['action-menu']}>
    <div className={style['action-btn']}>
      <DeleteBtn dir={currentDir} file={file} onDeleteFinish={onReload} />
    </div>
    {
      file.is_file ?
        <a
          className={style['action-btn']}
          download={file.name}
          target="_blank"
          rel="noreferrer"
          href={create_download_link(currentDir, file.name)}>
          下载
        </a>
        : setting.download.zipDownloadEnabled ? <a
          className={style['action-btn']}
          download={file.name}
          target="_blank"
          rel="noreferrer"
          href={create_compression_download_link(currentDir, file.name)}>
          下载Zip
        </a>
          : ''
    }
    {
      !!setting.download.aria2Enabled && !!file.is_file &&
      <button
        className={style['action-btn']}
        onClick={(e) => {
          e.preventDefault();
          send_to_aria2(currentDir, [file.name])
        }}
      >
        发送至Aria2
      </button>
    }
  </div>;

  let copiedFiles = useMemo(() => files.slice(), [files]);

  let [sortKey, setSortKey] = useState<keyof FileStat | undefined>();
  let [sortType, setSortType] = useState<-1 | 1>(1);
  let [checkedFiles, setCheckedFiles] = useState<Map<string, FileStat>>(new Map());

  if (sortKey) {
    copiedFiles.sort((a, b) => {
      return a[sortKey!] < b[sortKey!] ? -1 * sortType : 1 * sortType;
    });
  }

  const [animationClass, setAnimationClass] = useState<'left' | 'right' | 'right1' | 'left1'>('left');

  const setSort = (key?: keyof FileStat) => {
    if (sortKey === key) {
      if (sortType === 1) {
        setSortType(-1);
      } else {
        setSortKey(undefined);
      }
    } else {
      setSortType(1);
      setSortKey(key);
    }
  }

  const lastDir = useRef(currentDir);

  useEffect(() => {
    onFileChecked?.(checkedFiles);
  }, [checkedFiles, onFileChecked]);

  useEffect(() => {
    const empty = new Map();
    setCheckedFiles(empty);
    if (currentDir.length > lastDir.current.length) {
      if (animationClass === 'right') {
        setAnimationClass('right1');
      } else {
        setAnimationClass('right');
      }
    } else {
      if (animationClass === 'left') {
        setAnimationClass('left1');
      } else {
        setAnimationClass('left');
      }
    }
    lastDir.current = currentDir;
    // eslint-disable-next-line
  }, [files]);

  const [, startTransition] = useTransition();

  const onCheck = (file: FileStat) => {
    if (checkedFiles.has(file.name)) {
      checkedFiles.delete(file.name);
    } else {
      checkedFiles.set(file.name, file);
    }
    startTransition(() => {
      const m = new Map(checkedFiles);
      setCheckedFiles(m);
    });
  }

  const checkAll = () => {
    if (checkedFiles.size === files.length) {
      setCheckedFiles(new Map());
    } else {
      const entries: [string, FileStat][] = files.map(f => [f.name, f]);
      setCheckedFiles(new Map(entries));
    }
  }

  return <div className={classnames(style['file-list'], style['fade-in-start'], style['ease-in-' + animationClass])}>
    <div className={style['file-head']}>
      <div onClick={() => setSort('name')}>
        <span onClick={(e) => {
          e.stopPropagation();
          checkAll();
        }}>
          <Checkbox checked={checkedFiles.size === files.length} className={style['checkall']} />
        </span>
        文件名
        {sortKey === 'name' && <span className={classnames(style['sort-icon'], { [style['revert-icon']]: sortType === -1 })}>&gt;</span>}
      </div>
      <div onClick={() => setSort('created')}>
        创建时间
        {sortKey === 'created' && <span className={classnames(style['sort-icon'], { [style['revert-icon']]: sortType === -1 })}>&gt;</span>}
      </div>
      <div onClick={() => setSort('size')}>
        大小
        {sortKey === 'size' && <span className={classnames(style['sort-icon'], { [style['revert-icon']]: sortType === -1 })}>&gt;</span>}
      </div>
    </div>
    <div>
      {
        copiedFiles.map(file => {
          return <div
            className={style['file-item']}
            key={file.name}
            data-filename={file.name}
            data-isdir={file.is_dir}
          >
            <div
              className={style['left-area']}>
              <span className={style['title-area']} onClick={() => onCheck(file)}>
                <Checkbox className={style['checkbox']} checked={checkedFiles.has(file.name)} />
                <FileIcon size={18} className={style['file-icon']} file={file} />
                <span
                  onClick={(e) => { e.stopPropagation(); onClickFile(file) }}
                >
                  {file.name}
                </span>
              </span>
              <Popover auto={true} content={actionsMenu(file)}>
                <span>...</span>
              </Popover>
            </div>
            <div className={style['right-area']}>
              {moment.unix(file.created / 1000 >> 0).format('YYYY/MM/DD')}
            </div>
            <div>
              {file.is_file ? formatFileSize(file.size) : '-'}
            </div>
          </div>
        })
      }
    </div>
  </div>
}


function DeleteBtn({ dir, file, onDeleteFinish }: { dir: string, file: FileStat, onDeleteFinish: () => void }) {

  const [showDeleteComfirm, setShowDeleteComfirm] = useState(false);

  useEffect(() => {
    const onClick = () => {
      setShowDeleteComfirm(false);
    };
    window.addEventListener('click', onClick, false);
    return () => {
      window.removeEventListener('click', onClick, false);
    };
  }, []);

  const comfirmContent = <div onClick={e => e.stopPropagation()} className={style['comfirm-content']}>
    <span className={style['comfirm-content-text']}>确认删除 <strong>{file.name}</strong></span>
    <Button
      height={25}
      onClick={async () => {
        await delete_file(dir, file.name);
        onDeleteFinish();
        setShowDeleteComfirm(false);
      }}>OK</Button>
  </div>;

  return <Popover content={comfirmContent} show={showDeleteComfirm}>
    <span
      style={{ width: '100%', display: 'block' }}
      className={style['action-btn']}
      onClick={(e) => {
        e.stopPropagation();
        setShowDeleteComfirm(true);
      }}
    >
      删除
    </span>
  </Popover>
}

function EmptyList() {
  return <div className={style['empty-list']}>No file in this directory</div>
}

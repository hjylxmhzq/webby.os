import { useEffect, useRef, useState, useCallback } from "react"
import { FileStatWithDir, search_files as _search_files } from '@webby/core/fs';
import style from './index.module.less';
import classNames from "classnames";
import { debounce } from "src/utils/common";
import LoadingBar from "src/pages/file/components/loading-bar";
import { windowManager } from "src/utils/micro-app";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { FileThumbnailIcon } from "src/components/icon/icon";

export function GlobalSearch(props: { onClose?(): void }) {
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<FileStatWithDir[]>([]);
  const [fileLoading, setFileLoading] = useState(false);

  // eslint-disable-next-line
  const search_files = useCallback(debounce(
    async function (search: string) {
      if (search) {
        setFileLoading(true);
        try {
          const files = await _search_files(search);
          files.sort((l, r) => l.name < r.name ? -1 : 1);
          setFiles(files);
        } finally {
          setFileLoading(false);
        }
      } else {
        setFiles([]);
      }
    },
    300
  ), []);

  useEffect(() => {
    search_files(search);
    // eslint-disable-next-line
  }, [search]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  const els = search ? [
    <CSSTransition key='files' timeout={{ enter: 300, exit: 300 }} onExited={() => setFiles([])}>
      <div className={classNames(style.list, 'scrollbar')}>
        <div className={style.title}>
          <LoadingBar loading={fileLoading} />
          <div className={style.section}>文件</div>
        </div>
        <div className={style['list-box']}>
          {
            files.map((l, idx) => {
              return <div key={idx + l.name + '_' + l.dir} className={style['list-item']} onClick={async () => {
                await windowManager.openFileBy('Files', l.dir);
                props.onClose?.();
              }}>
                <span className={style['list-item-left']}>
                  <span className={style.icon}>
                    <FileThumbnailIcon imgStyle={{ display: 'inline-block', verticalAlign: 'bottom' }} dir={l.dir} file={{ name: l.name, is_dir: l.is_dir }} />
                  </span>
                  <span title={l.name}>{l.name}</span>
                </span>
                <span title={l.dir}>{l.dir}</span>
              </div>
            })
          }
          {
            !files.length && <div>无搜索结果</div>
          }
        </div>
      </div>
    </CSSTransition>
  ] : [];

  return <div tabIndex={0} onKeyDown={e => e.key === 'Escape' && props.onClose?.()} onMouseDown={e => e.stopPropagation()}>
    <input ref={inputRef} className={style['search-input']} onChange={(e) => setSearch(e.target.value)} value={search} placeholder="全局搜索"></input>
    <TransitionGroup>
      {
        els
      }
    </TransitionGroup>
  </div>
}
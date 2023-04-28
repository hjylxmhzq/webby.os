import { useEffect, useRef, useState, useCallback } from "react"
import { FileStatWithDir, search_files as _search_files } from '@webby/core/fs';
import style from './index.module.less';
import classNames from "classnames";
import { debounce } from "src/utils/common";
import LoadingBar from "src/pages/file/components/loading-bar";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { FileThumbnailIcon } from "@webby/components";
import { GlobalSearchResult, appManager, processManager } from "@webby/core/web-app";
import { xssFilter } from "src/utils/xss-filter";

export function GlobalSearch(props: { onClose?(): void }) {
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<FileStatWithDir[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [appsSearchResult, setAppsSearchResult] = useState<{ [appName: string]: GlobalSearchResult[] }>({});
  const [appsSearchLoading, setAppsSearchLoading] = useState<{ [appName: string]: boolean }>({});
  const appsSearchResultRef = useRef(appsSearchResult);
  const appsSearchLoadingRef = useRef(appsSearchLoading);
  appsSearchResultRef.current = appsSearchResult;
  appsSearchLoadingRef.current = appsSearchLoading;

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

  // eslint-disable-next-line
  const searchByApps = useCallback(debounce(
    async function (search: string) {
      Object.keys(appManager.hooks.globalSearch.callbacks).forEach(async appName => {
        const cbs = appManager.hooks.globalSearch.callbacks;
        const hook = cbs[appName][0];
        if (hook && appManager.hooks.globalSearch.isEnabled(appName)) {
          const cb = hook;
          setAppsSearchResult((state) => ({
            ...state,
            [appName]: [],
          }));
          setAppsSearchLoading((state) => ({
            ...state,
            [appName]: true,
          }));
          const result = await cb(search) as GlobalSearchResult[];
          setAppsSearchResult(state => ({
            ...state,
            [appName]: result,
          }));

          setAppsSearchLoading(state => ({
            ...state,
            [appName]: false,
          }));
        }
      })
    }
  ), []);

  useEffect(() => {
    search_files(search);
    searchByApps(search);
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
                await processManager.openFileBy('Files', l.dir);
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
    </CSSTransition>,
    ...Object.entries(appsSearchResult).map(([appName, results]) => {
      return <CSSTransition key={appName} timeout={{ enter: 300, exit: 300 }} onExited={() => setFiles([])}>
        <div className={classNames(style.list, 'scrollbar')}>
          <div className={style.title}>
            <LoadingBar loading={appsSearchLoading[appName]} />
            <div className={style.section}>{appName}</div>
          </div>
          <div className={style['list-box']}>
            {
              results.map((l, idx) => {
                return <div key={idx + l.title + '_' + l.subTitle || ''} className={style['list-item']} onClick={async () => {
                  l.onClick?.();
                  props.onClose?.();
                }}>
                  {
                    l.isHtml ?
                      <>
                        <span className={style['list-item-left']}>
                          <span title={l.title} dangerouslySetInnerHTML={{ __html: xssFilter(l.title) }}></span>
                        </span>
                        <span title={l.content} dangerouslySetInnerHTML={{ __html: xssFilter(l.content || '') }}></span>
                        {
                          l.pre && <div className={style.pre} dangerouslySetInnerHTML={{ __html: xssFilter(l.pre) }}></div>
                        }
                      </>
                      :
                      <>
                        <span className={style['list-item-left']}>
                          <span title={l.title}>{l.title}</span>
                        </span>
                        <span title={l.content}>{l.content}</span>
                        {
                          l.pre && <div className={style.pre}>{l.pre}</div>
                        }
                      </>
                  }
                </div>
              })
            }
            {
              !results.length && <div>无搜索结果</div>
            }
          </div>
        </div>
      </CSSTransition>
    })
  ] : [];

  return <div tabIndex={0} onKeyDown={e => e.key === 'Escape' && props.onClose?.()} onMouseDown={e => e.stopPropagation()}>
    <input ref={inputRef} className={style['search-input']} onChange={(e) => setSearch(e.target.value)} value={search} placeholder="全局搜索"></input>
    <div className={classNames(style['search-result-box'], 'noscrollbar')}>
      <TransitionGroup>
        {
          els
        }
      </TransitionGroup>
    </div>
  </div>
}
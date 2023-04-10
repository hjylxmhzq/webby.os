import { useEffect, useRef, useState } from "react"
import { FileStatWithDir, search_files as _search_files } from '@webby/core/fs';
import style from './index.module.less';
import classNames from "classnames";
import { debounce } from "src/utils/common";
import LoadingBar from "src/pages/file/components/loading-bar";
import { windowManager } from "src/utils/micro-app";

interface SearchResult {
  title: string,
  subtitle: string,
  onClick(): void,
}

export function GlobalSearch(props: { onClose?(): void }) {
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<FileStatWithDir[]>([]);
  const [fileLoading, setFileLoading] = useState(false);

  const search_files = debounce(
    async function search_files(search: string) {
      if (search) {
        setFileLoading(true);
        try {
          const files = await _search_files(search);
          files.sort((l, r) => l.name < r.name ? -1 : 1);
          setFiles(files);
        } finally {
          setFileLoading(false);
        }
      }
    },
    100
  );

  useEffect(() => {
    search_files(search);
    // eslint-disable-next-line
  }, [search]);

  const nameMap = {
    files: '文件'
  };

  const lists = { files: [] as SearchResult[] };

  type Keys = keyof typeof lists;

  files.forEach(file => {
    lists.files.push({
      title: file.name,
      subtitle: file.dir,
      async onClick() {
        await windowManager.openFileBy('Files', file.dir);
      }
    });
  });

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  return <div tabIndex={0} onKeyDown={e => e.key === 'Escape' && props.onClose?.()} onMouseDown={e => e.stopPropagation()}>
    <input ref={inputRef} className={style['search-input']} onChange={(e) => setSearch(e.target.value)} value={search} placeholder="全局搜索"></input>
    {
      Object.keys(lists).map((key) => {
        const list = lists[key as Keys]
        return <div key={key} className={classNames(style.list, { [style.hide]: !search })}>
          <LoadingBar loading={fileLoading} />
          <div className={style.section}>{nameMap[key as Keys]}</div>
          {
            list.map((l, idx) => {
              return <div key={idx + l.title + '_' + l.subtitle} className={style['list-item']} onClick={async () => {
                l.onClick();
                props.onClose?.();
              }}>
                <span title={l.title}>{l.title}</span>
                <span title={l.subtitle}>{l.subtitle}</span>
              </div>
            })
          }
          {
            !list.length && <div>无搜索结果</div>
          }
        </div>
      })
    }
  </div>
}
import classNames from 'classnames';
import path from 'path-browserify';
import { useEffect, useState } from 'react';
import { search_files, search_files_content } from '@apis/file';
import { FileIcon } from '@components/icon/icon';
import { useDebounceValue } from '@hooks/common';
import LoadingBar from './loading-bar';
import style from './search-input.module.less';

interface IProps {
  onClick?: (file: { name: string, dir: string, is_dir: boolean }) => void;
}

export default function SearchInput(props: IProps) {
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, pending] = useDebounceValue(keyword);
  const [loading, setLoading] = useState(false);

  const [files, setFiles] = useState<any[]>([]);
  const [filesContent, setFilesContent] = useState<any[]>([]);
  async function search(keyword: string) {
    setLoading(true);
    try {
      const files = await search_files(keyword);
      if (keyword) {
        setFiles(files);
      }
      await searchContent(keyword);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }
  async function searchContent(keyword: string) {
    setLoading(true);
    try {
      const files = await search_files_content(keyword);
      if (keyword) {
        const ret = files.map((f: any) => {
          return {
            file_name: f.field_values[0].value,
            file_path: f.field_values[1].value,
            content: highlightMaxLen(f.field_values[2].value, keyword),
          }
        });
        setFilesContent(ret);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!keyword) {
      setFiles([]);
      setLoading(false);
    }
  }, [keyword]);
  useEffect(() => {
    if (!debouncedKeyword) return;
    search(debouncedKeyword);
    // eslint-disable-next-line
  }, [debouncedKeyword]);

  function highlightMaxLen(name: string, kw: string, maxLen = 100) {
    let idx = name.indexOf(kw);
    console.log(idx)
    if (idx !== -1) {
      let half = Math.round(maxLen / 2);
      let start = idx - half;
      start = start < 0 ? 0 : start;
      let end = idx + half;
      end = end > (name.length - 1) ? name.length - 1 : end;
      name = name.substring(start, end + 1);
    } else {
      name = name.substring(0, maxLen);
    }

    let segs = name.split(kw).map((v, idx) => {
      return <span key={idx}>{v}</span>
    });
    let newSegs = [];
    for (let i = 0; i < segs.length; i++) {
      newSegs.push(segs[i]);
      if (i !== segs.length - 1) {
        const kwEl = <span key={'h-' + i} className={style.highlight}>{kw}</span>
        newSegs.push(kwEl);
      }
    }
    return newSegs;
  }

  function highlight(name: string, kw: string) {
    let segs = name.split(kw).map((v, idx) => {
      return <span key={idx}>{v}</span>
    });
    let newSegs = [];
    for (let i = 0; i < segs.length; i++) {
      newSegs.push(segs[i]);
      if (i !== segs.length - 1) {
        const kwEl = <span key={'h-' + i} className={style.highlight}>{kw}</span>
        newSegs.push(kwEl);
      }
    }
    return newSegs;
  }

  return <div className={style['container']} >
    <LoadingBar loading={(pending && !!keyword) || loading} />
    <input className={style['search']} type="text" placeholder='搜索' onChange={e => setKeyword(e.target.value)}></input>
    {
      !!keyword && <div tabIndex={0} className={classNames(style.list, 'scrollbar')}>
        {
          files.map((file) => {
            return <div onClick={() => {
              if (props.onClick) {
                props.onClick({ name: file.file_name, dir: path.dirname(file.file_path), is_dir: file.is_dir })
              }
            }} className={style.item} key={file.file_path}>
              <span className={style.left}>
                <FileIcon className={style['file-icon']} size={14} file={{ name: file.file_name, is_dir: file.is_dir }} />
                <span title={file.file_name} className={style.name}>{highlight(file.file_name, keyword)}</span>
              </span>
              <span className={style.right}>
                <span title={file.file_path} className={style.dir}>{file.file_path}</span>
              </span>
            </div>
          })
        }
        {
          filesContent.map((file) => {
            return <div onClick={() => {
              if (props.onClick) {
                props.onClick({ name: file.name, dir: path.dirname(file.file_path), is_dir: false })
              }
            }} className={classNames(style.item, style['item-with-content'])} key={file.file_path}>
              <span className={style.left}>
                <FileIcon className={style['file-icon']} size={14} file={{ name: file.file_name, is_dir: false }} />
                <span title={file.file_name} className={style.name}>{highlight(file.file_name, keyword)}</span>
              </span>
              <div className={style.content}>
                <span title={file.file_path} className={style.dir}>{file.content}</span>
              </div>
            </div>
          })
        }
        {(files.length === 0 && filesContent.length === 0 && !pending && !loading && !!keyword) && <div className={style['no-result']}>无搜索结果</div>}
      </div>
    }
  </div>
}

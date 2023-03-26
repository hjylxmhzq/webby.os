import { useEffect, useState } from "react"
import { FileStat, read_zip_entries } from "@apis/file";
import style from './zip-viewer.module.less';

export default function ZipPreview({ dir, file }: { dir: string, file: FileStat }) {

  const [tree, setTree] = useState<FileStatTree | null>(null);

  useEffect(() => {
    read_zip_entries(dir, file.name).then(tree => {
      setTree(tree);
    })
  }, [dir, file.name]);

  return <div style={{ textAlign: 'left', padding: '30px 100px' }} >
    <div style={{ width: '100%' }}>
      <div>Files in {file.name}</div>
      {
        tree &&
        <FileTree tree={tree} deep={0} />
      }
    </div>
  </div>
}


interface FileStatTree {
  file: FileStat;
  children: FileStatTree[];
}
export function FileTree({ tree, deep }: { tree: FileStatTree, deep: number }) {
  if (tree.file.is_dir && deep > 0) {
    return <details>
      <summary className={style.item}>
        {tree.file.name}
      </summary>
      {
        !!tree.children.length && <div className={style.tree}>
          {
            tree.children.map((node) => {
              return <FileTree key={node.file.name} tree={node} deep={deep + 1} />
            })
          }
        </div>
      }
    </details>
  }
  return <div>
    <div>
      {tree.file.name}
    </div>
    {
      !!tree.children.length && <div className={style.tree}>
        {
          tree.children.map((node) => {
            return <FileTree key={node.file.name} tree={node} deep={deep + 1} />
          })
        }
      </div>
    }
  </div>
}
import { useEffect, useState } from "react"
import { FileStat, read_text_file } from "@apis/file";

export default function TextPreview({ dir, file }: { dir: string, file: FileStat }) {

  const [content, setContent] = useState('');

  useEffect(() => {
    read_text_file(dir, file.name).then(content => {
      setContent(content);
    })
  }, [dir, file.name]);

  return <div style={{ textAlign: 'left' }} >
    <div style={{ whiteSpace: 'pre', width: '100%' }}>{content}</div>
  </ div>
}
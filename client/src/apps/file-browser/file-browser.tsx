import { useEffect, useState } from "react";
import { MicroAppContext } from "src/utils/micro-app";

export default function FileBrowserApp(props: { ctx: MicroAppContext }) {
  const [defaultPath, setDefaultPath] = useState('/');
  useEffect(() => {
    props.ctx.channel.addEventListener('message', e => {
      const defaultPath = e.data.path;
      if (defaultPath) {
        setDefaultPath(defaultPath);
      }
    });
  }, [props.ctx]);
  return <div>{defaultPath}</div>
}

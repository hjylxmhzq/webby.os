import Header from "./components/header";
import style from './index.module.less';
import { AppDefinition, WindowManager } from "src/utils/micro-app";
import { useEffect, useRef, useState } from "react";
import { autorun } from "mobx";


export function HomePage() {
  const mountPoint = useRef<HTMLDivElement>(null);
  const wm = useRef<WindowManager>();
  const [apps, setApps] = useState<{ [appName: string]: AppDefinition }>({});

  useEffect(() => {
    autorun(() => {
      const apps = window.apps.apps;
      setApps({ ...apps });
    });
    if (!mountPoint.current) return;
    wm.current = new WindowManager(mountPoint.current);
    (window as any).wm = wm.current;
  }, []);
  return <div>
    <Header></Header>
    <div className={style['main-window']}>
      <div ref={mountPoint}></div>
      <div className={style['icons-grid']}>
        {
          Object.keys(apps).map(app => {
            return <div key={app} className={style['app-icon']} onDoubleClick={() => {
              if (mountPoint.current) {
                wm.current?.startApp(app);
              }
            }}>{app}</div>
          })
        }
      </div>
    </div>
  </div>
}
